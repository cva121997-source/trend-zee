import {NextResponse} from 'next/server';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {seedProducts,Product} from '@/lib/catalog';
import {defaultHomepageSections,defaultCollections,defaultCampaigns,defaultCategories,isScheduleActive,HomepageSection,Collection,Campaign,CategoryContent} from '@/lib/content';
import {Section,cleanSection,defaultSections,isLive} from '@/lib/home';
import {quoteShipping} from '@/lib/shipping';
import {calculateTax} from '@/lib/tax';
import {database,row,save,list,read,cookie,digest,secret,isAdmin,adminRole,adminToken,sessionCookie,checkOrigin} from '@/lib/store-server';
import {canAdmin,normalizeAdminRole,rolePermissions,ADMIN_ROLES} from '@/lib/roles';
import {listAnalyticsEvents} from '@/lib/analytics';
import {notificationStatus,notifyOrderEvent} from '@/lib/notifications';
import {paymentProvider} from '@/lib/payments';
import {syncCustomer,syncAddress,syncProductVariants,syncOrder} from '@/lib/commerce-sync';
import {shippingProvider} from '@/lib/shipping';
import {taxProvider} from '@/lib/tax';

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
  brandTagline:'Wear your next chapter.',
  freeShippingThreshold:1999,
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


async function ensureContent<T extends {id:string}>(kind:string,prefix:string,defaults:T[]){
  for(const item of defaults){
    const id=prefix+item.id;
    if(!await row(id))await save(id,kind,'admin',item);
  }
  return list(kind);
}
async function contentData(){
  const [homepageSections,collections,campaigns,categories]=await Promise.all([
    ensureContent<HomepageSection>('homepage_section','homepage:',defaultHomepageSections),
    ensureContent<Collection>('collection','collection:',defaultCollections),
    ensureContent<Campaign>('campaign','campaign:',defaultCampaigns),
    ensureContent<CategoryContent>('category','category:',defaultCategories),
  ]);
  return {
    homepageSections:homepageSections.sort((a:any,b:any)=>number(a.sortOrder)-number(b.sortOrder)),
    collections:collections.sort((a:any,b:any)=>number(a.sortOrder)-number(b.sortOrder)),
    campaigns,
    categories:categories.sort((a:any,b:any)=>number(a.sortOrder)-number(b.sortOrder)),
  };
}
function publicContent(data:any){
  return {
    homepageSections:(data.homepageSections||[]).filter((s:any)=>s.visible!==false&&isScheduleActive(s.scheduleStart||'',s.scheduleEnd||'')),
    collections:(data.collections||[]).filter((s:any)=>s.visible!==false&&isScheduleActive(s.scheduleStart||'',s.scheduleEnd||'')),
    campaigns:(data.campaigns||[]).filter((s:any)=>(s.status==='live'||s.status==='scheduled')&&isScheduleActive(s.startDate||'',s.endDate||'')),
    categories:(data.categories||[]).filter((s:any)=>s.visible!==false),
  };
}

async function storedSections():Promise<Section[]>{
  const rows=await list('section') as any[];
  return rows.map(({owner,created,updated,...r})=>({...r,id:String(r.id).replace(/^section:/,'')} as Section)).sort((a,b)=>a.order-b.order);
}
async function homeSections():Promise<{sections:Section[];isDefault:boolean}>{
  const stored=await storedSections();
  return stored.length?{sections:stored,isDefault:false}:{sections:defaultSections,isDefault:true};
}
async function materializeSections(){
  const stored=await storedSections();
  if(stored.length)return stored;
  for(const section of defaultSections)await save('section:'+section.id,'section','admin',section);
  return defaultSections;
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
    const variantKey=[String(i.size??''),String(i.color??'')].join('::').slice(0,220);
    const countKey=p?.id+'::'+variantKey;
    const available=p?.variantStock?.[variantKey] ?? p?.stock ?? 0;
    counts.set(countKey,(counts.get(countKey)||0)+quantity);
    if(!p||!Number.isInteger(quantity)||quantity<1||quantity>10||(counts.get(countKey)||0)>available||!p.sizes.includes(i.size)||!p.colors.includes(i.color)){
      throw new Error('A product, size, colour or quantity is unavailable. Please update your bag.');
    }
    return {productId:p.id,name:p.name,size:i.size,color:i.color,variantKey,quantity,price:p.price,image:p.images[0]};
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

async function discountFor(value:any,subtotal:number,items:any[]=[],owner=''){
  const code=clean(value,30).toUpperCase();
  if(!code)return {code:'',discount:0};
  const c=read(await row('coupon:'+code));
  const today=new Date().toISOString().slice(0,10);
  if(!c||!c.active||c.expires<today||(c.startsAt&&c.startsAt>today))throw new Error('This coupon is unavailable or has expired.');
  if(subtotal<c.minOrder)throw new Error('This coupon needs a minimum order of INR '+c.minOrder);
  const eligible=items.length?items.filter((i:any)=>!(c.productIds?.length||c.categories?.length)||c.productIds?.includes(i.productId)||c.categories?.includes(i.category)):items;
  if((c.productIds?.length||c.categories?.length)&&!eligible.length)throw new Error('This coupon does not apply to the products in your bag.');
  const uses=(await list('order')).filter((o:any)=>o.coupon===code);
  if(c.usageLimit>0&&uses.length>=c.usageLimit)throw new Error('This coupon has reached its usage limit.');
  if(owner&&c.perUserLimit>0){const userUses=uses.filter((o:any)=>o.owner===owner);if(userUses.length>=c.perUserLimit)throw new Error('This coupon has reached its per-customer limit.');}
  const eligibleSubtotal=eligible.reduce((s:number,i:any)=>s+Number(i.price||0)*Number(i.quantity||0),0);
  const raw=c.discountType==='fixed'?Math.max(0,Number(c.fixedAmount||0)):Math.round(eligibleSubtotal*Number(c.percent||0)/100),discount=c.maxDiscount>0?Math.min(raw,c.maxDiscount):raw;
  return {code,discount};
}

export async function GET(req:Request){
  try{
    const view=new URL(req.url).searchParams.get('view');
    if(view==='content-admin'){
      const role=await adminRole(req);if(!role)return NextResponse.json({error:'Please sign in as admin.'},{status:401});
      if(!canAdmin(role,'adminContent'))return NextResponse.json({error:'Your admin role cannot manage Content Studio.'},{status:403});
      return NextResponse.json(await contentData(),{headers:{'Cache-Control':'no-store'}});
    }
    if(view==='admin'){
      const role=await adminRole(req);if(!role)return NextResponse.json({error:'Please sign in as admin.'},{status:401});
      const commerceContent=await contentData();
      const home=await homeSections();
      const team=(await list('admin_user')).map((x:any)=>{const {passwordHash,...safe}=x;return safe;});
      return NextResponse.json({
        products:await catalog(),archivedProducts:await archivedCatalog(),orders:await list('order'),customers:await list('profile'),leads:await list('lead'),
        feedback:await list('feedback'),coupons:await list('coupon'),returns:await list('return'),support:await list('support'),
        reviews:await list('review'),inventory:await list('inventory'),audit:await list('audit'),settings:await settings(),content:commerceContent,homeSections:home.sections,homeIsDefault:home.isDefault,
        analyticsEvents:await listAnalyticsEvents(3000),team,adminRole:role,integrations:{payment:paymentProvider(),shipping:shippingProvider(),tax:taxProvider(),notifications:notificationStatus()},
      },{headers:{'Cache-Control':'no-store'}});
    }

    const {user,owner,anon}=await identity(req);
    let profile=read(await row('profile:'+owner));
    if(user){
      profile={...(profile||{name:user.fullName||'',email:user.email,mobile:'',address:'',city:'',pincode:''}),verified:true,lastLogin:new Date().toISOString()};
      await save('profile:'+owner,'profile',owner,profile);
    }
    const reviews=(await list('review')).filter((r:any)=>r.status==='Published').map((r:any)=>({id:r.id,productId:r.productId,rating:r.rating,title:r.title,message:r.message,name:r.name,created:r.created,imageUrls:Array.isArray(r.imageUrls)?r.imageUrls:[],helpfulCount:Number(r.helpfulCount||0)}));
    const commerceContent=publicContent(await contentData());
    const home=await homeSections();
    const result=NextResponse.json({
      products:await catalog(),
      content:commerceContent,
      user:user||(profile?.mobile?{userId:owner,email:profile.email||'',displayName:profile.name||'Guest',guest:true}:null),
      profile,cart:await cart(owner),orders:(user||profile?.mobile)?await list('order',owner):[],
      support:(user||profile?.mobile)?await list('support',owner):[],returns:(user||profile?.mobile)?await list('return',owner):[],reviews,preferences:(user||profile?.mobile)?read(await row('preferences:'+owner),{emailUpdates:true,smsUpdates:false,personalized:true,preferredCategories:[],preferredSize:''}):null,addresses:(user||profile?.mobile)?await list('address',owner):[],settings:await settings(),
      home:home.sections.filter(s=>isLive(s)),
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
      const suppliedUsername=clean(b.username,120);
      const staff=(await list('admin_user')).find((x:any)=>String(x.username||x.email||'').toLowerCase()===suppliedUsername.toLowerCase()&&x.active!==false);
      const envHash=secret('ADMIN_PASSWORD_HASH');
      const validStaff=staff?.passwordHash&&await digest(String(b.password))===staff.passwordHash;
      const validEnv=!staff&&envHash&&suppliedUsername==='Admin'&&await digest(String(b.password))===envHash;
      if(!validStaff&&!validEnv){
        await save(key,'rate','system',{count:prev.until>Date.now()?prev.count+1:1,until:Date.now()+900000});
        return NextResponse.json({error:'Username or password is incorrect.'},{status:401});
      }
      await database().prepare('DELETE FROM records WHERE id=?').bind(key).run();
      const role=normalizeAdminRole(staff?.role||secret('ADMIN_ROLE')||'Owner');
      const actor=String(staff?.username||suppliedUsername||'Admin');
      const response=NextResponse.json({ok:true,role,actor,permissions:rolePermissions(role)});
      response.headers.set('Set-Cookie',sessionCookie(req,'tz_admin',await adminToken(role)));
      return response;
    }

    if(action==='adminLogout'){
      const response=NextResponse.json({ok:true});
      response.headers.set('Set-Cookie',sessionCookie(req,'tz_admin','',0));
      return response;
    }

    if(action.startsWith('admin')){
      const role=await adminRole(req);
      if(!role)return NextResponse.json({error:'Please sign in as admin.'},{status:401});
      if(!canAdmin(role,action))return NextResponse.json({error:`Your ${role} role cannot perform this action.`},{status:403});

      if(action==='adminContent'){
        const kind=clean(b.kind,40);
        const incoming=b.record||{};
        const prefix=kind==='homepage_section'?'homepage:':kind==='collection'?'collection:':kind==='campaign'?'campaign:':kind==='category'?'category:':'';
        if(!prefix)throw new Error('Unsupported content type.');
        const id=clean(incoming.id,120)||crypto.randomUUID();
        if(b.remove===true){
          await database().prepare('DELETE FROM records WHERE id=? AND kind=?').bind(prefix+id,kind).run();
          await audit('Content removed',id,{kind});
          return NextResponse.json({ok:true,id});
        }
        const now=new Date().toISOString();
        const base={...incoming,id};
        if(kind==='homepage_section'){
          const normalized:HomepageSection={id,type:['hero','ticker','category-showcase','product-carousel','product-grid','collection-banner','full-image','video','editorial','testimonials','promo','newsletter','countdown','recommendations','best-sellers','new-arrivals','final-cta'].includes(base.type)?base.type:'product-carousel',kicker:clean(base.kicker,80),title:clean(base.title,160),description:clean(base.description,500),ctaLabel:clean(base.ctaLabel,60),ctaHref:clean(base.ctaHref,200),secondaryCtaLabel:clean(base.secondaryCtaLabel,60),secondaryCtaHref:clean(base.secondaryCtaHref,200),image:clean(base.image,2000),mobileImage:clean(base.mobileImage,2000),category:clean(base.category,80)||'All',collectionId:clean(base.collectionId,120),productIds:Array.isArray(base.productIds)?base.productIds.map((x:any)=>clean(x,120)).filter(Boolean).slice(0,40):[],theme:['paper','ink','forest','sand','white'].includes(base.theme)?base.theme:'paper',layout:['standard','split','immersive','sticky','marquee','grid'].includes(base.layout)?base.layout:'standard',motion:['none','fade','slide','scale','parallax','horizontal','sticky','reveal','product-reveal'].includes(base.motion)?base.motion:'fade',visible:base.visible!==false,sortOrder:Math.max(0,Math.round(number(base.sortOrder,100))),scheduleStart:clean(base.scheduleStart,40),scheduleEnd:clean(base.scheduleEnd,40)};
          if(!normalized.title)throw new Error('Give the homepage section a title.');
          await save(prefix+id,kind,'admin',normalized);
        } else if(kind==='collection'){
          const normalized:Collection={id,title:clean(base.title,160),description:clean(base.description,500),coverImage:clean(base.coverImage,2000),productIds:Array.isArray(base.productIds)?base.productIds.map((x:any)=>clean(x,120)).filter(Boolean).slice(0,60):[],layout:['editorial','grid','split'].includes(base.layout)?base.layout:'grid',visible:base.visible!==false,sortOrder:Math.max(0,Math.round(number(base.sortOrder,100))),scheduleStart:clean(base.scheduleStart,40),scheduleEnd:clean(base.scheduleEnd,40)};
          if(!normalized.title||!normalized.coverImage)throw new Error('A collection needs a title and cover image.');
          await save(prefix+id,kind,'admin',normalized);
        } else if(kind==='campaign'){
          const normalized:Campaign={id,name:clean(base.name,120),title:clean(base.title,160),description:clean(base.description,500),desktopImage:clean(base.desktopImage,2000),mobileImage:clean(base.mobileImage,2000),ctaLabel:clean(base.ctaLabel,60),ctaHref:clean(base.ctaHref,200),productIds:Array.isArray(base.productIds)?base.productIds.map((x:any)=>clean(x,120)).filter(Boolean).slice(0,60):[],category:clean(base.category,80)||'All',discountLabel:clean(base.discountLabel,80),startDate:clean(base.startDate,40),endDate:clean(base.endDate,40),status:['draft','scheduled','live','ended'].includes(base.status)?base.status:'draft'};
          if(!normalized.name||!normalized.title||!normalized.desktopImage)throw new Error('A campaign needs a name, title and desktop image.');
          await save(prefix+id,kind,'admin',normalized);
        } else {
          const normalized:CategoryContent={id:clean(base.slug,80),slug:clean(base.slug,80).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''),title:clean(base.title,120),description:clean(base.description,300),image:clean(base.image,2000),bannerImage:clean(base.bannerImage,2000),visible:base.visible!==false,sortOrder:Math.max(0,Math.round(number(base.sortOrder,100)))};
          if(!normalized.slug||!normalized.title||!normalized.image)throw new Error('A category needs a title and image.');
          await save(prefix+normalized.slug,kind,'admin',normalized);
        }
        await audit('Content saved',prefix+id,{kind});
        return NextResponse.json({ok:true,id});
      }

      if(action==='adminSection'){
        const existing=await materializeSections();
        const incoming=b.section||{};
        const known=existing.find(x=>x.id===incoming.id);
        const next=cleanSection(incoming,known?known.order:existing.length);
        await save('section:'+next.id,'section','admin',next);
        await audit(known?'Homepage section updated':'Homepage section added',next.id,{type:next.type,title:next.title,visible:next.visible});
        return NextResponse.json({ok:true,id:next.id});
      }
      if(action==='adminSectionOrder'){
        const ids=Array.isArray(b.ids)?b.ids.map((x:any)=>clean(x,80)).filter(Boolean).slice(0,50):[];
        if(!ids.length)throw new Error('Choose at least one homepage section.');
        const existing=await materializeSections();
        const byId=new Map(existing.map(x=>[x.id,x]));
        for(let i=0;i<ids.length;i++){const section=byId.get(ids[i]);if(section)await save('section:'+section.id,'section','admin',{...section,order:i});}
        await audit('Homepage section order changed','homepage',{count:ids.length});
        return NextResponse.json({ok:true});
      }
      if(action==='adminSectionDelete'){
        const id=clean(b.id,80);
        if(!id)throw new Error('Section not found.');
        await database().prepare('DELETE FROM records WHERE id=? AND kind=?').bind('section:'+id,'section').run();
        await audit('Homepage section removed',id,{});
        return NextResponse.json({ok:true});
      }
      if(action==='adminSectionsReset'){
        await database().prepare('DELETE FROM records WHERE kind=?').bind('section').run();
        await audit('Homepage reset','homepage',{});
        return NextResponse.json({ok:true});
      }

      if(action==='adminTeamSave'){
        const incoming=b.user||{};const username=clean(incoming.username||incoming.email,120).toLowerCase();
        const email=clean(incoming.email,200).toLowerCase();const displayName=clean(incoming.displayName||username,120);const role=normalizeAdminRole(incoming.role);const active=incoming.active!==false;
        if(!username||!email||!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email))throw new Error('Enter a valid staff username and email.');
        const id=clean(incoming.id,120)||'admin-user:'+crypto.randomUUID();const existing=read(await row(id),{});
        let passwordHash=existing.passwordHash||'';
        if(incoming.password){if(String(incoming.password).length<10)throw new Error('Staff passwords must be at least 10 characters.');passwordHash=await digest(String(incoming.password));}
        if(!passwordHash)throw new Error('A password is required for a new staff account.');
        await save(id,'admin_user','admin',{id,username,email,displayName,role,active,passwordHash,updatedAt:new Date().toISOString(),createdAt:existing.createdAt||new Date().toISOString()});
        await audit('Staff account saved',id,{username,role,active});
        return NextResponse.json({ok:true,id});
      }
      if(action==='adminTeamRemove'){
        const id=clean(b.id,120);if(!id)throw new Error('Staff account not found.');
        const target=await row(id);if(!target||target.kind!=='admin_user')throw new Error('Staff account not found.');
        await database().prepare('DELETE FROM records WHERE id=?').bind(id).run();await audit('Staff account removed',id,{});return NextResponse.json({ok:true});
      }

      if(action==='adminCoupon'){
        const c=b.coupon||{};
        const code=clean(c.code,30).toUpperCase();
        const discountType=c.discountType==='fixed'?'fixed':'percent',percent=number(c.percent,0),fixedAmount=number(c.fixedAmount,0),minOrder=number(c.minOrder,-1);
        const expires=clean(c.expires,10),startsAt=clean(c.startsAt,10),maxDiscount=Math.max(0,number(c.maxDiscount,0)),usageLimit=Math.max(0,Math.round(number(c.usageLimit,0))),perUserLimit=Math.max(0,Math.round(number(c.perUserLimit,0))),productIds=Array.isArray(c.productIds)?c.productIds.map((x:any)=>clean(x,120)).filter(Boolean).slice(0,50):[],categories=Array.isArray(c.categories)?c.categories.map((x:any)=>clean(x,80)).filter(Boolean).slice(0,20):[];
        const today=new Date().toISOString().slice(0,10);
        if(!/^[A-Z0-9_-]{3,30}$/.test(code)||(discountType==='percent'?(percent<1||percent>80):(fixedAmount<1||fixedAmount>1000000))||minOrder<0||!/^\d{4}-\d{2}-\d{2}$/.test(expires)||expires<today||maxDiscount<0||usageLimit<0||perUserLimit<0||!/^$|^\d{4}-\d{2}-\d{2}$/.test(startsAt)||(startsAt&&startsAt>expires))throw new Error('Check coupon dates, discount, minimum order, caps and usage limits.');
        await save('coupon:'+code,'coupon','admin',{code,discountType,percent:discountType==='percent'?percent:0,fixedAmount:discountType==='fixed'?fixedAmount:0,minOrder,maxDiscount,usageLimit,perUserLimit,productIds,categories,startsAt,expires,active:!!c.active});
        await audit('Promotion saved',code,{percent,minOrder,active:!!c.active});
        return NextResponse.json({ok:true});
      }

      if(action==='adminProduct'){
        const p=b.product||{};
        const data:Product={
          id:clean(p.id)||crypto.randomUUID(),name:clean(p.name),category:clean(p.category),type:clean(p.type),brand:clean(p.brand),
          price:Number(p.price),mrp:Number(p.mrp)>0?Number(p.mrp):undefined,sku:clean(p.sku,80),stock:Number(p.stock),colors:p.colors?.map((x:any)=>clean(x)).filter(Boolean),sizes:p.sizes?.map((x:any)=>clean(x)).filter(Boolean),
          images:p.images?.map((x:any)=>clean(x,2000)).filter(Boolean),hoverImage:clean(p.hoverImage,2000)||undefined,video:clean(p.video,2000)||undefined,badge:clean(p.badge,80)||undefined,tags:Array.isArray(p.tags)?p.tags.map((x:any)=>clean(x,60)).filter(Boolean).slice(0,20):[],
          rating:Number(p.rating)||undefined,reviewCount:Number(p.reviewCount)||undefined,variantStock:p.variantStock&&typeof p.variantStock==='object'?Object.fromEntries(Object.entries(p.variantStock).map(([k,v])=>[clean(k,220),Math.max(0,Math.min(100000,Math.floor(Number(v))))]).filter(([,v])=>Number.isFinite(v as number))):undefined,description:clean(p.description,2000),specifications:clean(p.specifications,2000),material:clean(p.material,300),care:clean(p.care,500),shipping:clean(p.shipping,500),returnPolicy:clean(p.returnPolicy,500),seoTitle:clean(p.seoTitle,160),seoDescription:clean(p.seoDescription,320),tag:clean(p.tag),
        };
        if(data.mrp&&data.mrp<data.price)throw new Error('MRP must be greater than or equal to the selling price.');
        if(!data.name||!data.category||!data.type||!data.brand||!Number.isFinite(data.price)||data.price<1||data.price>1000000||!Number.isInteger(data.stock)||data.stock<0||!data.colors?.length||!data.sizes?.length||!data.images?.length||data.images.length>5||!data.images.every(x=>x.startsWith('/images/')||x.startsWith('/api/image/')||/^https:\/\//.test(x)))throw new Error('Check product name, category, type, brand, price, stock, variants and 1-5 image URLs.');
        const previous=await database().prepare('SELECT data FROM products WHERE id=?').bind(data.id).first<{data:string}>();
        const oldProduct=previous?JSON.parse(previous.data):null;
        await database().prepare('INSERT INTO products (id,data,archived) VALUES (?,?,0) ON CONFLICT(id) DO UPDATE SET data=excluded.data,archived=0').bind(data.id,JSON.stringify(data)).run();
        await syncProductVariants(data);
        if(oldProduct&&number(oldProduct.stock)!==data.stock){
          await save('inventory:'+crypto.randomUUID(),'inventory','admin',{productId:data.id,productName:data.name,before:number(oldProduct.stock),after:data.stock,adjustment:data.stock-number(oldProduct.stock),reason:'Product edit',at:new Date().toISOString()});
        }
        await audit(oldProduct?'Product updated':'Product created',data.id,{name:data.name,stock:data.stock,price:data.price});
        return NextResponse.json({ok:true,id:data.id});
      }

      if(action==='adminDuplicateProduct'){
        const id=clean(b.id,100);const record=await database().prepare('SELECT data FROM products WHERE id=? AND archived=0').bind(id).first<{data:string}>();
        if(!record)throw new Error('Product not found.');
        const source:Product=JSON.parse(record.data);const clone:Product={...source,id:crypto.randomUUID(),name:clean((source.name||'')+' — Copy',180),sku:source.sku?clean(source.sku+'-COPY',80):undefined,stock:0,variantStock:{}};
        await database().prepare('INSERT INTO products (id,data,archived) VALUES (?,?,0)').bind(clone.id,JSON.stringify(clone)).run();
        await audit('Product duplicated',clone.id,{sourceId:id,name:clone.name});
        return NextResponse.json({ok:true,id:clone.id});
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
          announcement:clean(b.settings?.announcement,180),brandTagline:clean(b.settings?.brandTagline,180),supportEmail:clean(b.settings?.supportEmail,200),supportPhone:clean(b.settings?.supportPhone,40),
          supportHours:clean(b.settings?.supportHours,120),returnsWindowDays:Math.max(0,Math.min(60,Math.round(number(b.settings?.returnsWindowDays,current.returnsWindowDays)))),freeShippingThreshold:Math.max(0,Math.min(100000,Math.round(number(b.settings?.freeShippingThreshold,current.freeShippingThreshold||1999)))),
          lowStockThreshold:Math.max(0,Math.min(1000,Math.round(number(b.settings?.lowStockThreshold,current.lowStockThreshold)))),
          shippingNote:clean(b.settings?.shippingNote,500),taxNote:clean(b.settings?.taxNote,500),storeStatus:['Preview','Live','Maintenance'].includes(b.settings?.storeStatus)?b.settings.storeStatus:current.storeStatus,
        };
        if(next.supportEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.supportEmail))throw new Error('Enter a valid support email or leave it blank.');
        await save('settings:store','settings','admin',next);
        await audit('Store settings updated','settings:store',{storeStatus:next.storeStatus,returnsWindowDays:next.returnsWindowDays,lowStockThreshold:next.lowStockThreshold});
        return NextResponse.json({ok:true,settings:next});
      }

      if(action==='adminCustomer'){
        const id=clean(b.id,120);const record=await row(id);if(!record||record.kind!=='profile')throw new Error('Customer profile not found.');
        const old=read(record);const accountStatus=['active','suspended'].includes(b.accountStatus)?b.accountStatus:'active';const segment=['VIP','Repeat','Standard','At risk'].includes(b.segment)?b.segment:'Standard';
        await save(record.id,'profile',record.owner,{...old,accountStatus,segment,adminNote:clean(b.adminNote,1000)});
        await audit('Customer profile updated',record.id,{accountStatus,segment});
        return NextResponse.json({ok:true});
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
        if(next.status!==old.status){const notifyEvent=next.status==='Dispatched'?'shipped':next.status==='Delivered'?'delivered':next.status.toLowerCase();void notifyOrderEvent(next,notifyEvent);}
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
      const c=await cart(owner),items=await validatedItems(c.items); const products=await catalog(); const priced=items.map((i:any)=>({...i,category:products.find((p:Product)=>p.id===i.productId)?.category||''}));
      return NextResponse.json(await discountFor(b.code,priced.reduce((sum:number,i:any)=>sum+i.price*i.quantity,0),priced,owner));
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
      await syncCustomer(owner,profile);
      return NextResponse.json({ok:true,profile});
    }

    if(action==='newsletter'){
      const email=clean(b.email,200).toLowerCase();
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||b.consent!==true)throw new Error('Enter a valid email and agree to receive updates.');
      const id='newsletter:'+await digest(email);
      await save(id,'newsletter','marketing',{email,consent:true,consentAt:new Date().toISOString(),status:'subscribed'});
      return NextResponse.json({ok:true});
    }

    if(action==='address'){
      const target=await row(clean(b.id,120));
      if(b.remove===true){if(!target||target.kind!=='address'||target.owner!==owner)throw new Error('Address not found.');await database().prepare('DELETE FROM records WHERE id=?').bind(target.id).run();return NextResponse.json({ok:true});}
      const p=validateProfile(b.address||{});const existing=target?read(target):{};const id=clean(b.id,120)||'address:'+crypto.randomUUID();
      if(b.isDefault===true){const current=await list('address',owner);for(const a of current)await save(a.id,'address',owner,{...a,isDefault:false});}
      await save(id,'address',owner,{...existing,...p,id,label:clean(b.label,60)||'Delivery',isDefault:b.isDefault===true,createdAt:existing.createdAt||new Date().toISOString()});
      await syncCustomer(owner,{...p,email:guest?.email||user?.email||''}); await syncAddress(id,owner,{...p,label:clean(b.label,60)||'Delivery',isDefault:b.isDefault===true,createdAt:existing.createdAt});
      return NextResponse.json({ok:true,id});
    }

    if(action==='preferences'){
      const base=read(await row('preferences:'+owner),{});
      const allowed=(Array.isArray(b.preferredCategories)?b.preferredCategories.map((x:any)=>clean(x,80)).filter(Boolean).slice(0,12):base.preferredCategories||[]);
      const next={...base,emailUpdates:b.emailUpdates!==false,smsUpdates:b.smsUpdates===true,personalized:b.personalized!==false,preferredCategories:allowed,preferredSize:clean(b.preferredSize,40),updatedAt:new Date().toISOString()};
      await save('preferences:'+owner,'preferences',owner,next);
      return NextResponse.json({ok:true,preferences:next});
    }

    if(action==='reviewHelpful'){
      const reviewId=clean(b.id,120);
      const r=await row(reviewId);if(!r||r.kind!=='review')throw new Error('Review not found.');
      const marker='review-helpful:'+owner+':'+reviewId;
      if(await row(marker))return NextResponse.json({ok:true,already:true,helpfulCount:Number(read(r).helpfulCount||0)});
      const old=read(r);const helpfulCount=Number(old.helpfulCount||0)+1;
      await save(r.id,r.kind,r.owner,{...old,helpfulCount});
      await save(marker,'review_helpful',owner,{reviewId,createdAt:new Date().toISOString()});
      return NextResponse.json({ok:true,helpfulCount});
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
      const imageUrls=Array.isArray(b.imageUrls)?b.imageUrls.map((x:any)=>clean(x,2000)).filter((x:string)=>x.startsWith('/api/review-image/')||x.startsWith('/api/image/')||x.startsWith('/images/')||/^https:\/\//.test(x)).slice(0,6):[];
      const id='REV-'+crypto.randomUUID().slice(0,8).toUpperCase();
      await save(id,'review',owner,{orderId,productId,name:order.name||guest?.name||'Customer',rating,title:clean(b.title,120),message:clean(b.message,2000),imageUrls,helpfulCount:0,status:'Pending',moderationNote:''});
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
      const products=await catalog();
      const pricedItems=items.map((i:any)=>({...i,category:products.find((p:Product)=>p.id===i.productId)?.category||''}));
      const subtotal=pricedItems.reduce((sum:number,i:any)=>sum+i.price*i.quantity,0);
      const discount=await discountFor(b.coupon,subtotal,pricedItems,owner);
      const preShippingTotal=Math.max(0,subtotal-discount.discount);
      const shippingOptions=await quoteShipping(profile.pincode,preShippingTotal);
      const shippingMethod=shippingOptions.find(x=>x.id===clean(b.shippingId,80))||shippingOptions[0];
      if(!shippingMethod?.serviceable)throw new Error('No delivery option is available for this PIN code yet.');
      const shipping=Number(shippingMethod.amount)||0;
      const taxInfo=await calculateTax(preShippingTotal+shipping,{pincode:profile.pincode,city:profile.city});
      const tax=Number(taxInfo.amount)||0;
      const total=Math.max(0,preShippingTotal+shipping+tax);
      await save('profile:'+owner,'profile',owner,{...profile,verified:!!user,lastLogin:new Date().toISOString()});
      const leadId='lead:'+owner,prior=read(await row(leadId),{});
      await save(leadId,'lead',owner,{...prior,...profile,items,total,subtotal,discount:discount.discount,shipping,shippingMethod:shippingMethod.id,tax,consent:true,consentAt:prior.consentAt||new Date().toISOString(),status:action==='order'?'Submitted':'Checkout started'});
      if(action==='checkoutStart')return NextResponse.json({ok:true,total,subtotal,discount:discount.discount,shipping,tax,shippingMethod:shippingMethod.id,coupon:discount.code});
      if(!['UPI','Credit card','Debit card'].includes(b.method))throw new Error('Choose a payment method.');
      const id='TZ-'+crypto.randomUUID().slice(0,8).toUpperCase(),now=new Date().toISOString();
      await database().batch([
        database().prepare('INSERT INTO records (id,kind,owner,data,created,updated) VALUES (?,?,?,?,?,?)').bind(id,'order',owner,JSON.stringify({...profile,items:pricedItems,total,subtotal,discount:discount.discount,shipping,tax,shippingMethod:shippingMethod.id,coupon:discount.code,note:clean(b.note,1000),method:b.method,status:'Awaiting payment',paymentStatus:'Not paid',courier:'',tracking:''}),now,now),
        database().prepare('INSERT INTO records (id,kind,owner,data,created,updated) VALUES (?,?,?,?,?,?)').bind(key,'idempotency',owner,JSON.stringify({id}),now,now),
        database().prepare('UPDATE records SET data=?,updated=? WHERE id=?').bind(JSON.stringify({...c,items:[]}),now,'cart:'+owner),
      ]);
      const savedOrder={...profile,items:pricedItems,total,subtotal,discount:discount.discount,shipping,tax,shippingMethod:shippingMethod.id,coupon:discount.code,note:clean(b.note,1000),method:b.method,status:'Awaiting payment',paymentStatus:'Not paid',courier:'',tracking:'',created:now};
      await syncCustomer(owner,profile); await syncOrder(id,owner,savedOrder);
      return NextResponse.json({ok:true,id,total,subtotal,discount:discount.discount,shipping,tax,shippingMethod:shippingMethod.id,coupon:discount.code});
    }

    throw new Error('Unknown action.');
  }catch(e){
    console.error(e);
    return NextResponse.json({error:e instanceof Error?e.message:'Unable to save. Please try again.'},{status:400});
  }
}
