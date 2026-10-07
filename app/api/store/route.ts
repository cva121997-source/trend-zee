import {NextResponse} from 'next/server';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {seedProducts,Product} from '@/lib/catalog';
import {database,row,save,list,read,cookie,digest,secret,isAdmin,adminToken,sessionCookie,checkOrigin} from '@/lib/store-server';

export const dynamic='force-dynamic';

const clean=(v:unknown,max=200)=>String(v??'').trim().slice(0,max);
const number=(v:unknown,fallback=0)=>Number.isFinite(Number(v))?Number(v):fallback;
const defaultSettings={
  announcement:'Thoughtful essentials for every chapter.',
  supportEmail:'',
  supportPhone:'',
  supportHours:'Mon–Sat · 10:00–18:00',
  returnsWindowDays:7,
  lowStockThreshold:5,
  shippingNote:'Delivery availability, charges and ETA are confirmed before a paid order is accepted.',
  taxNote:'Applicable taxes will be shown once tax rules are configured.',
  storeStatus:'Preview',
};

async function catalog():Promise<Product[]>{
  const db=database();
  if(!await row('catalog-initialized')){
    const now=new Date().toISOString();
    await db.batch([
      ...seedProducts.map(p=>db.prepare('INSERT OR IGNORE INTO products (id,data,archived) VALUES (?,?,0)').bind(p.id,JSON.stringify(p))),
      db.prepare('INSERT OR IGNORE INTO records (id,kind,owner,data,created,updated) VALUES (?,?,?,?,?,?)').bind('catalog-initialized','system','system','{}',now,now),
    ]);
  }
  return (await db.prepare('SELECT data FROM products WHERE archived=0').all<{data:string}>()).results.map(r=>JSON.parse(r.data));
}
async function archivedCatalog():Promise<Product[]>{
  await catalog();
  return (await database().prepare('SELECT data FROM products WHERE archived=1').all<{data:string}>()).results.map(r=>JSON.parse(r.data));
}


async function identity(req:Request){
  const user=await getChatGPTUser();
  const raw=cookie(req,'tz_bag');
  const anon=/^[a-f0-9-]{36}$/.test(raw)?raw:crypto.randomUUID();
  return {user,owner:user?.userId||'guest:'+anon,anon};
}

async function cart(owner:string){return read(await row('cart:'+owner),{items:[],saved:[]});}
async function settings(){return {...defaultSettings,...read(await row('settings:store'),{})};}
async function audit(action:string,entity:string,details:Record<string,unknown>={}){
  await save('audit:'+crypto.randomUUID(),'audit','admin',{action,entity,actor:'Admin',details,at:new Date().toISOString()});
}

async function validatedItems(input:any){
  if(!Array.isArray(input)||input.length>50)throw new Error('Invalid shopping bag.');
  const products=await catalog();
  const counts=new Map<string,number>();
  return input.map((i:any)=>{
    const p=products.find(x=>x.id===i.productId);
    const quantity=Number(i.quantity);
    counts.set(i.productId,(counts.get(i.productId)||0)+quantity);
    if(!p||!Number.isInteger(quantity)||quantity<1||quantity>10||(counts.get(i.productId)||0)>p.stock||!p.sizes.includes(i.size)||!p.colors.includes(i.color)){
      throw new Error('A product, size, colour or quantity is unavailable. Please update your bag.');
    }
    return {productId:p.id,name:p.name,size:i.size,color:i.color,quantity,price:p.price,image:p.images[0]};
  });
}

function validateProfile(b:any){
  const p={
    name:clean(b.name,100),mobile:clean(b.mobile,20),email:clean(b.email),address:clean(b.address,1000),
    city:clean(b.city,100),pincode:clean(b.pincode,6),location:clean(b.location,100),
  };
  if(!p.name||!/^[+]?[-0-9\s]{10,16}$/.test(p.mobile)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email))throw new Error('Enter a name, valid email and mobile number.');
  return p;
}

async function discountFor(value:any,subtotal:number){
  const code=clean(value,30).toUpperCase();
  if(!code)return {code:'',discount:0};
  const c=read(await row('coupon:'+code));
  if(!c||!c.active||c.expires<new Date().toISOString().slice(0,10))throw new Error('This coupon is unavailable or has expired.');
  if(subtotal<c.minOrder)throw new Error('This coupon needs a minimum order of INR '+c.minOrder);
  return {code,discount:Math.round(subtotal*c.percent/100)};
}

export async function GET(req:Request){
  try{
    if(new URL(req.url).searchParams.get('view')==='admin'){
      if(!await isAdmin(req))return NextResponse.json({error:'Please sign in as admin.'},{status:401});
      return NextResponse.json({
        products:await catalog(),archivedProducts:await archivedCatalog(),orders:await list('order'),customers:await list('profile'),leads:await list('lead'),
        feedback:await list('feedback'),coupons:await list('coupon'),returns:await list('return'),support:await list('support'),
        reviews:await list('review'),inventory:await list('inventory'),audit:await list('audit'),settings:await settings(),
      },{headers:{'Cache-Control':'no-store'}});
    }

    const {user,owner,anon}=await identity(req);
    let profile=read(await row('profile:'+owner));
    if(user){
      profile={...(profile||{name:user.fullName||'',email:user.email,mobile:'',address:'',city:'',pincode:''}),verified:true,lastLogin:new Date().toISOString()};
      await save('profile:'+owner,'profile',owner,profile);
    }
    const reviews=(await list('review')).filter((r:any)=>r.status==='Published').map((r:any)=>({productId:r.productId,rating:r.rating,title:r.title,message:r.message,name:r.name,created:r.created}));
    const result=NextResponse.json({
      products:await catalog(),
      user:user||(profile?.mobile?{userId:owner,email:profile.email||'',displayName:profile.name||'Guest',guest:true}:null),
      profile,cart:await cart(owner),orders:(user||profile?.mobile)?await list('order',owner):[],
      support:(user||profile?.mobile)?await list('support',owner):[],returns:(user||profile?.mobile)?await list('return',owner):[],reviews,settings:await settings(),
    },{headers:{'Cache-Control':'no-store'}});
    if(!cookie(req,'tz_bag'))result.headers.append('Set-Cookie',sessionCookie(req,'tz_bag',anon,2592000));
    return result;
  }catch(e){
    console.error(e);
    return NextResponse.json({error:'The store could not load. Please try again shortly.'},{status:503});
  }
}

export async function POST(req:Request){
  try{
    checkOrigin(req);
    const raw=await req.text();
    if(raw.length>100000)throw new Error('Request too large.');
    const b=JSON.parse(raw);
    const action=clean(b.action);

    if(action==='adminLogin'){
      const key='rate:'+await digest(req.headers.get('cf-connecting-ip')||'local');
      const prev=read(await row(key),{count:0,until:0});
      if(prev.until>Date.now()&&prev.count>=8)return NextResponse.json({error:'Too many attempts. Try again in 15 minutes.'},{status:429});
      const hash=secret('ADMIN_PASSWORD_HASH');
      if(!hash)throw new Error('Admin sign-in is not configured.');
      if(b.username!=='Admin'||await digest(String(b.password))!==hash){
        await save(key,'rate','system',{count:prev.until>Date.now()?prev.count+1:1,until:Date.now()+900000});
        return NextResponse.json({error:'Username or password is incorrect.'},{status:401});
      }
      await database().prepare('DELETE FROM records WHERE id=?').bind(key).run();
      const response=NextResponse.json({ok:true});
      response.headers.set('Set-Cookie',sessionCookie(req,'tz_admin',await adminToken()));
      return response;
    }

    if(action==='adminLogout'){
      const response=NextResponse.json({ok:true});
      response.headers.set('Set-Cookie',sessionCookie(req,'tz_admin','',0));
      return response;
    }

    if(action.startsWith('admin')){
      if(!await isAdmin(req))return NextResponse.json({error:'Please sign in as admin.'},{status:401});

      if(action==='adminCoupon'){
        const c=b.coupon||{};
        const code=clean(c.code,30).toUpperCase();
        const percent=number(c.percent,-1),minOrder=number(c.minOrder,-1);
        const expires=clean(c.expires,10);
        if(!/^[A-Z0-9_-]{3,30}$/.test(code)||percent<1||percent>80||minOrder<0||!/^\d{4}-\d{2}-\d{2}$/.test(expires)||expires<new Date().toISOString().slice(0,10))throw new Error('Check coupon code, discount (1-80%), minimum order and a valid future expiry.');
        await save('coupon:'+code,'coupon','admin',{code,percent,minOrder,expires,active:!!c.active});
        await audit('Promotion saved',code,{percent,minOrder,active:!!c.active});
        return NextResponse.json({ok:true});
      }

      if(action==='adminProduct'){
        const p=b.product||{};
        const data:Product={
          id:clean(p.id)||crypto.randomUUID(),name:clean(p.name),category:clean(p.category),type:clean(p.type),brand:clean(p.brand),
          price:Number(p.price),stock:Number(p.stock),colors:p.colors?.map((x:any)=>clean(x)).filter(Boolean),sizes:p.sizes?.map((x:any)=>clean(x)).filter(Boolean),
          images:p.images?.map((x:any)=>clean(x,2000)).filter(Boolean),description:clean(p.description,2000),specifications:clean(p.specifications,2000),tag:clean(p.tag),
        };
        if(!data.name||!data.category||!data.type||!data.brand||!Number.isFinite(data.price)||data.price<1||data.price>1000000||!Number.isInteger(data.stock)||data.stock<0||!data.colors?.length||!data.sizes?.length||!data.images?.length||data.images.length>5||!data.images.every(x=>x.startsWith('/images/')||x.startsWith('/api/image/')||/^https:\/\//.test(x)))throw new Error('Check product name, category, type, brand, price, stock, variants and 1-5 image URLs.');
        const previous=await database().prepare('SELECT data FROM products WHERE id=?').bind(data.id).first<{data:string}>();
        const oldProduct=previous?JSON.parse(previous.data):null;
        await database().prepare('INSERT INTO products (id,data,archived) VALUES (?,?,0) ON CONFLICT(id) DO UPDATE SET data=excluded.data,archived=0').bind(data.id,JSON.stringify(data)).run();
        if(oldProduct&&number(oldProduct.stock)!==data.stock){
          await save('inventory:'+crypto.randomUUID(),'inventory','admin',{productId:data.id,productName:data.name,before:number(oldProduct.stock),after:data.stock,adjustment:data.stock-number(oldProduct.stock),reason:'Product edit',at:new Date().toISOString()});
        }
        await audit(oldProduct?'Product updated':'Product created',data.id,{name:data.name,stock:data.stock,price:data.price});
        return NextResponse.json({ok:true,id:data.id});
      }

      if(action==='adminInventory'){
        const id=clean(b.id,100),reason=clean(b.reason,500);
        const desired=Number(b.stock);
        if(!id||!Number.isInteger(desired)||desired<0||desired>100000)throw new Error('Enter a valid non-negative stock quantity.');
        if(!reason)throw new Error('Add a reason for this inventory adjustment.');
        const record=await database().prepare('SELECT data FROM products WHERE id=? AND archived=0').bind(id).first<{data:string}>();
        if(!record)throw new Error('Product not found.');
        const p:Product=JSON.parse(record.data),before=number(p.stock);
        const updated={...p,stock:desired};
        await database().prepare('UPDATE products SET data=? WHERE id=?').bind(JSON.stringify(updated),id).run();
        await save('inventory:'+crypto.randomUUID(),'inventory','admin',{productId:id,productName:p.name,before,after:desired,adjustment:desired-before,reason,at:new Date().toISOString()});
        await audit('Inventory adjusted',id,{before,after:desired,reason});
        return NextResponse.json({ok:true});
      }

      if(action==='adminDelete'){
        const id=clean(b.id);
        if(!id)throw new Error('Product not found.');
        const existing=await database().prepare('SELECT data FROM products WHERE id=? AND archived=0').bind(id).first<{data:string}>();
        if(!existing)throw new Error('Product not found or already archived.');
        await database().prepare('UPDATE products SET archived=1 WHERE id=?').bind(id).run();
        await audit('Product archived',id,{});
        return NextResponse.json({ok:true});
      }

      if(action==='adminRestoreProduct'){
        const id=clean(b.id);
        if(!id)throw new Error('Product not found.');
        const existing=await database().prepare('SELECT data FROM products WHERE id=? AND archived=1').bind(id).first<{data:string}>();
        if(!existing)throw new Error('Archived product not found.');
        await database().prepare('UPDATE products SET archived=0 WHERE id=?').bind(id).run();
        await audit('Product restored',id,{});
        return NextResponse.json({ok:true});
      }

      if(action==='adminSettings'){
        const current=await settings();
        const next={
          ...current,
          announcement:clean(b.settings?.announcement,180),supportEmail:clean(b.settings?.supportEmail,200),supportPhone:clean(b.settings?.supportPhone,40),
          supportHours:clean(b.settings?.supportHours,120),returnsWindowDays:Math.max(0,Math.min(60,Math.round(number(b.settings?.returnsWindowDays,current.returnsWindowDays)))),
          lowStockThreshold:Math.max(0,Math.min(1000,Math.round(number(b.settings?.lowStockThreshold,current.lowStockThreshold)))),
          shippingNote:clean(b.settings?.shippingNote,500),taxNote:clean(b.settings?.taxNote,500),storeStatus:['Preview','Live','Maintenance'].includes(b.settings?.storeStatus)?b.settings.storeStatus:current.storeStatus,
        };
        if(next.supportEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.supportEmail))throw new Error('Enter a valid support email or leave it blank.');
        await save('settings:store','settings','admin',next);
        await audit('Store settings updated','settings:store',{storeStatus:next.storeStatus,returnsWindowDays:next.returnsWindowDays,lowStockThreshold:next.lowStockThreshold});
        return NextResponse.json({ok:true,settings:next});
      }

      const r=await row(clean(b.id));
      if(!r)throw new Error('Record not found.');
      const old=read(r);

      if(action==='adminOrder'&&r.kind==='order'){
        const allowed=old.paymentStatus==='Paid'?['Processing','Dispatched','Delivered','Cancelled']:['Awaiting payment','Cancelled'];
        if(!allowed.includes(b.status))throw new Error('Only paid orders can be dispatched. Connect verified payments first.');
        const now=new Date().toISOString();
        const next={...old,status:b.status,tracking:clean(b.tracking),courier:clean(b.courier),...(b.status==='Processing'&&!old.processingAt?{processingAt:now}:{}),...(b.status==='Dispatched'&&!old.dispatchedAt?{dispatchedAt:now}:{}),...(b.status==='Delivered'&&!old.deliveredAt?{deliveredAt:now}:{}),...(b.status==='Cancelled'&&!old.cancelledAt?{cancelledAt:now}:{})};
        await save(r.id,r.kind,r.owner,next);
        await audit('Order updated',r.id,{status:next.status,courier:next.courier,tracking:next.tracking});
        return NextResponse.json({ok:true});
      }

      if(action==='adminFeedback'&&r.kind==='feedback'){
        const next={...old,status:b.status==='Resolved'?'Resolved':'New',reply:clean(b.reply,2000)};
        await save(r.id,r.kind,r.owner,next);
        await audit('Feedback updated',r.id,{status:next.status});
        return NextResponse.json({ok:true});
      }

      if(action==='adminLead'&&r.kind==='lead'){
        const next={...old,note:clean(b.note,2000),contacted:!!b.contacted};
        await save(r.id,r.kind,r.owner,next);
        await audit('Checkout lead updated',r.id,{contacted:next.contacted});
        return NextResponse.json({ok:true});
      }

      if(action==='adminSupport'&&r.kind==='support'){
        const allowed=['New','In progress','Waiting customer','Resolved','Closed'];
        if(!allowed.includes(b.status))throw new Error('Choose a valid support status.');
        const status=b.status;
        const next={...old,status,internalNote:clean(b.internalNote,3000)};
        await save(r.id,r.kind,r.owner,next);
        await audit('Support ticket updated',r.id,{status});
        return NextResponse.json({ok:true});
      }

      if(action==='adminReturn'&&r.kind==='return'){
        const allowed=['Requested','Approved','Rejected','Item received','Refund pending','Closed'];
        if(!allowed.includes(b.status))throw new Error('Choose a valid return status.');
        const status=b.status;
        const next={...old,status,internalNote:clean(b.internalNote,3000),refundAmount:Math.min(number(old.total,0),Math.max(0,number(b.refundAmount,old.refundAmount||0)))};
        await save(r.id,r.kind,r.owner,next);
        await audit('Return case updated',r.id,{status,orderId:old.orderId,refundAmount:next.refundAmount});
        return NextResponse.json({ok:true});
      }

      if(action==='adminReview'&&r.kind==='review'){
        if(!['Pending','Published','Rejected'].includes(b.status))throw new Error('Choose a valid review status.');
        const status=b.status;
        await save(r.id,r.kind,r.owner,{...old,status,moderationNote:clean(b.moderationNote,2000)});
        await audit('Product review moderated',r.id,{status,productId:old.productId});
        return NextResponse.json({ok:true});
      }

      throw new Error('Unknown admin action.');
    }

    const {user,owner}=await identity(req);

    if(action==='coupon'){
      const c=await cart(owner),items=await validatedItems(c.items);
      return NextResponse.json(await discountFor(b.code,items.reduce((sum:number,i:any)=>sum+i.price*i.quantity,0)));
    }

    if(action==='cart'){
      const items=await validatedItems(b.items);
      const saved=Array.isArray(b.saved)?b.saved.filter((x:any)=>typeof x==='string').slice(0,100):[];
      await save('cart:'+owner,'cart',owner,{items,saved});
      const lead=await row('lead:'+owner);
      if(lead){
        const old=read(lead);
        await save(lead.id,lead.kind,owner,{...old,items,total:items.reduce((sum:number,i:any)=>sum+i.price*i.quantity,0),status:items.length?'Bag started':old.status});
      }
      return NextResponse.json({cart:{items,saved}});
    }

    if(action==='mobile'){
      const mobile=clean(b.mobile,16);
      if(!/^\+?[0-9]{10,13}$/.test(mobile))throw new Error('Enter a valid mobile number.');
      if(b.consent!==true)throw new Error('Please agree to save your contact details.');
      const existing=read(await row('profile:'+owner),{});
      await save('profile:'+owner,'profile',owner,{...existing,mobile,verified:false,lastLogin:new Date().toISOString()});
      const c=await cart(owner);
      await save('lead:'+owner,'lead',owner,{mobile,name:existing.name||'',email:existing.email||'',items:c.items,total:c.items.reduce((sum:number,i:any)=>sum+(i.price||0)*i.quantity,0),status:'Mobile shared',consent:true,consentAt:new Date().toISOString()});
      return NextResponse.json({ok:true});
    }

    const guest=read(await row('profile:'+owner));
    if(!user&&!guest?.mobile)return NextResponse.json({error:'Enter your mobile number to continue.'},{status:401});

    if(action==='profile'){
      const profile=validateProfile(b.profile);
      await save('profile:'+owner,'profile',owner,{...profile,verified:!!user,lastLogin:new Date().toISOString()});
      return NextResponse.json({ok:true,profile});
    }

    if(action==='feedback'){
      if(!clean(b.message,2000)||!Number.isInteger(b.rating)||b.rating<1||b.rating>5)throw new Error('Choose a rating and write your feedback.');
      await save(crypto.randomUUID(),'feedback',owner,{name:guest?.name||user?.displayName||'Guest',email:guest?.email||user?.email||'',mobile:guest?.mobile||'',rating:b.rating,message:clean(b.message,2000),status:'New',reply:''});
      return NextResponse.json({ok:true});
    }

    if(action==='support'){
      const subject=clean(b.subject,160),message=clean(b.message,3000),category=clean(b.category,60)||'General';
      if(!subject||!message)throw new Error('Add a subject and message.');
      const id='SUP-'+crypto.randomUUID().slice(0,8).toUpperCase();
      await save(id,'support',owner,{name:guest?.name||user?.displayName||'Guest',email:guest?.email||user?.email||'',mobile:guest?.mobile||'',category,subject,message,status:'New',internalNote:''});
      return NextResponse.json({ok:true,id});
    }

    if(action==='cancelOrder'){
      const orderId=clean(b.id,100),r=await row(orderId);
      if(!r||r.kind!=='order'||r.owner!==owner)throw new Error('Order not found.');
      const old=read(r);
      if(old.paymentStatus==='Paid'||old.status!=='Awaiting payment')throw new Error('This order can no longer be cancelled here. Please contact support.');
      await save(r.id,r.kind,r.owner,{...old,status:'Cancelled',cancelReason:clean(b.reason,500)||'Cancelled by customer',cancelledAt:old.cancelledAt||new Date().toISOString()});
      return NextResponse.json({ok:true});
    }

    if(action==='returnRequest'){
      const orderId=clean(b.id,100),r=await row(orderId);
      if(!r||r.kind!=='order'||r.owner!==owner)throw new Error('Order not found.');
      const old=read(r),cfg=await settings();
      if(!clean(b.reason,1000))throw new Error('Tell us why you would like to return the order.');
      if(old.paymentStatus!=='Paid'||old.status!=='Delivered')throw new Error('Returns become available after a paid order is delivered.');
      const deliveredAt=new Date(old.deliveredAt||r.updated).getTime();
      if(Date.now()-deliveredAt>number(cfg.returnsWindowDays,7)*86400000)throw new Error(`The ${cfg.returnsWindowDays}-day return window has ended.`);
      const existing=(await list('return',owner)).find((x:any)=>x.orderId===orderId&&!['Rejected','Closed'].includes(x.status));
      if(existing)return NextResponse.json({ok:true,id:existing.id});
      const id='RET-'+crypto.randomUUID().slice(0,8).toUpperCase();
      await save(id,'return',owner,{orderId,reason:clean(b.reason,1000),status:'Requested',items:old.items,total:old.total,refundAmount:old.total,name:old.name,email:old.email,mobile:old.mobile,internalNote:''});
      return NextResponse.json({ok:true,id});
    }

    if(action==='review'){
      const orderId=clean(b.orderId,100),productId=clean(b.productId,100),r=await row(orderId);
      if(!r||r.kind!=='order'||r.owner!==owner)throw new Error('Order not found.');
      const order=read(r);
      if(order.paymentStatus!=='Paid'||order.status!=='Delivered'||!(order.items||[]).some((i:any)=>i.productId===productId))throw new Error('Reviews are available for delivered paid purchases.');
      const rating=Number(b.rating);
      if(!Number.isInteger(rating)||rating<1||rating>5||!clean(b.message,2000))throw new Error('Choose a rating and write your review.');
      const duplicate=(await list('review',owner)).find((x:any)=>x.orderId===orderId&&x.productId===productId);
      if(duplicate)throw new Error('You already reviewed this product from this order.');
      const id='REV-'+crypto.randomUUID().slice(0,8).toUpperCase();
      await save(id,'review',owner,{orderId,productId,name:order.name||guest?.name||'Customer',rating,title:clean(b.title,120),message:clean(b.message,2000),status:'Pending',moderationNote:''});
      return NextResponse.json({ok:true,id});
    }

    if(action==='checkoutStart'||action==='order'){
      const cfg=await settings();
      if(cfg.storeStatus==='Maintenance')throw new Error('Checkout is temporarily unavailable while the store is in maintenance mode.');
      const profile=validateProfile(b.profile);
      if(!profile.address||!profile.city||!/^\d{6}$/.test(profile.pincode))throw new Error('Complete the delivery address and six-digit PIN code.');
      if(b.consent!==true)throw new Error('Please agree to save checkout details.');
      const key='order-key:'+owner+':'+clean(b.key,100);
      if(action==='order'){
        if(!clean(b.key,100))throw new Error('Missing order reference.');
        const existing=read(await row(key));
        if(existing)return NextResponse.json({ok:true,id:existing.id});
      }
      const c=await cart(owner),items=await validatedItems(c.items);
      if(!items.length)throw new Error('Your shopping bag is empty.');
      const subtotal=items.reduce((sum:number,i:any)=>sum+i.price*i.quantity,0);
      const discount=await discountFor(b.coupon,subtotal);
      const total=subtotal-discount.discount;
      await save('profile:'+owner,'profile',owner,{...profile,verified:!!user,lastLogin:new Date().toISOString()});
      const leadId='lead:'+owner,prior=read(await row(leadId),{});
      await save(leadId,'lead',owner,{...prior,...profile,items,total,consent:true,consentAt:prior.consentAt||new Date().toISOString(),status:action==='order'?'Submitted':'Checkout started'});
      if(action==='checkoutStart')return NextResponse.json({ok:true,total,subtotal,discount:discount.discount,coupon:discount.code});
      if(!['UPI','Credit card','Debit card'].includes(b.method))throw new Error('Choose a payment method.');
      const id='TZ-'+crypto.randomUUID().slice(0,8).toUpperCase(),now=new Date().toISOString();
      await database().batch([
        database().prepare('INSERT INTO records (id,kind,owner,data,created,updated) VALUES (?,?,?,?,?,?)').bind(id,'order',owner,JSON.stringify({...profile,items,total,subtotal,discount:discount.discount,coupon:discount.code,note:clean(b.note,1000),method:b.method,status:'Awaiting payment',paymentStatus:'Not paid',courier:'',tracking:''}),now,now),
        database().prepare('INSERT INTO records (id,kind,owner,data,created,updated) VALUES (?,?,?,?,?,?)').bind(key,'idempotency',owner,JSON.stringify({id}),now,now),
        database().prepare('UPDATE records SET data=?,updated=? WHERE id=?').bind(JSON.stringify({...c,items:[]}),now,'cart:'+owner),
      ]);
      return NextResponse.json({ok:true,id});
    }

    throw new Error('Unknown action.');
  }catch(e){
    console.error(e);
    return NextResponse.json({error:e instanceof Error?e.message:'Unable to save. Please try again.'},{status:400});
  }
}
