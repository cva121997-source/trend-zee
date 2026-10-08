import {NextResponse} from 'next/server';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {database,row,read,cookie,checkOrigin,save} from '@/lib/store-server';
import {paymentProvider} from '@/lib/payments';

export const dynamic='force-dynamic';

async function currentOwner(req:Request){
  const user=await getChatGPTUser();
  const raw=cookie(req,'tz_bag');
  const anon=/^[a-f0-9-]{36}$/.test(raw)?raw:crypto.randomUUID();
  return user?.userId||'guest:'+anon;
}

export async function POST(req:Request){
  try{
    checkOrigin(req);
    if(paymentProvider()!=='mock')return NextResponse.json({error:'Mock payments are disabled. Set PAYMENT_PROVIDER=mock only for development/demo use.'},{status:403});
    const body:any=await req.json();
    const orderId=String(body.orderId||'').trim();
    const who=await currentOwner(req);
    const record=await row(orderId);
    if(!record||record.kind!=='order'||record.owner!==who)throw new Error('Order not found.');
    const order=read(record);
    if(order.paymentStatus==='Paid')return NextResponse.json({ok:true,alreadyPaid:true});
    if(order.status!=='Awaiting payment')throw new Error('This order is no longer payable.');
    const items=Array.isArray(order.items)?order.items:[];const db=database();
    const products=new Map<string,any>();
    for(const item of items){const p=await db.prepare('SELECT id,data FROM products WHERE id=? AND archived=0').bind(item.productId).first<any>();if(!p)throw new Error('A product in this order is no longer available.');products.set(p.id,JSON.parse(p.data));}
    for(const item of items){const p=products.get(item.productId);const variantKey=item.variantKey||[String(item.size??''),String(item.color??'')].join('::').slice(0,220);const available=Number(p?.variantStock?.[variantKey]??p?.stock??0);if(!p||available<Number(item.quantity))throw new Error('Stock changed while you were checking out. Please rebuild your bag.');}
    const now=new Date().toISOString();
    const statements:any[]=[];
    for(const item of items){const p=products.get(item.productId);const variantKey=item.variantKey||[String(item.size??''),String(item.color??'')].join('::').slice(0,220);const current=Number(p.variantStock?.[variantKey]??p.stock??0);const nextVariant=p.variantStock?{...p.variantStock,[variantKey]:current-Number(item.quantity)}:undefined;const next={...p,stock:Math.max(0,Number(p.stock)-Number(item.quantity)),...(nextVariant?{variantStock:nextVariant}:{})};statements.push(db.prepare('UPDATE products SET data=? WHERE id=?').bind(JSON.stringify(next),p.id));}
    statements.push(db.prepare('UPDATE records SET data=?,updated=? WHERE id=?').bind(JSON.stringify({...order,paymentStatus:'Paid',status:'Processing',paidAt:now,paymentProvider:'mock'}),now,orderId));
    await db.batch(statements);
    await save('audit:'+crypto.randomUUID(),'audit','payment',{action:'Mock payment completed',entity:orderId,actor:'Mock payment',details:{amount:Number(order.total)||0},at:now});
    return NextResponse.json({ok:true,orderId,paymentStatus:'Paid',status:'Processing'});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to complete payment.'},{status:400});}
}
