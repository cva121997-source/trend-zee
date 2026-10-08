import {NextResponse} from 'next/server';
import {database,row,read,save} from '@/lib/store-server';
import {verifyWebhook} from '@/lib/payments';

export const dynamic='force-dynamic';

export async function POST(req:Request){
  try{
    const raw=await req.text();
    const signature=req.headers.get('x-trend-zee-signature')||'';
    if(!(await verifyWebhook(raw,signature)))return NextResponse.json({error:'Invalid webhook signature.'},{status:401});
    const body:any=JSON.parse(raw);
    const orderId=String(body.orderId||'').trim();
    const status=String(body.status||'').toLowerCase();
    if(!orderId||!['paid','failed'].includes(status))throw new Error('Invalid payment event.');
    const record=await row(orderId);
    if(!record||record.kind!=='order')throw new Error('Order not found.');
    const order=read(record);const now=new Date().toISOString();
    if(status==='failed'){
      await save(orderId,'order',record.owner,{...order,paymentStatus:'Failed',paymentFailedAt:now});
      return NextResponse.json({ok:true});
    }
    if(order.paymentStatus==='Paid')return NextResponse.json({ok:true,idempotent:true});
    const db=database();const statements:any[]=[];const items=Array.isArray(order.items)?order.items:[];const products=new Map<string,any>();
    for(const item of items){const p=await db.prepare('SELECT id,data FROM products WHERE id=? AND archived=0').bind(item.productId).first<any>();if(!p)throw new Error('Product missing for paid order.');products.set(p.id,JSON.parse(p.data));}
    for(const item of items){const p=products.get(item.productId);const variantKey=item.variantKey||[String(item.size??''),String(item.color??'')].join('::').slice(0,220);const available=Number(p?.variantStock?.[variantKey]??p?.stock??0);if(!p||available<Number(item.quantity))throw new Error('Stock changed while you were checking out. Please rebuild your bag.');}
    for(const item of items){const p=products.get(item.productId);const variantKey=item.variantKey||[String(item.size??''),String(item.color??'')].join('::').slice(0,220);const current=Number(p.variantStock?.[variantKey]??p.stock??0);const nextVariant=p.variantStock?{...p.variantStock,[variantKey]:current-Number(item.quantity)}:undefined;const next={...p,stock:Math.max(0,Number(p.stock)-Number(item.quantity)),...(nextVariant?{variantStock:nextVariant}:{})};statements.push(db.prepare('UPDATE products SET data=? WHERE id=?').bind(JSON.stringify(next),p.id));}
    statements.push(db.prepare('UPDATE records SET data=?,updated=? WHERE id=?').bind(JSON.stringify({...order,paymentStatus:'Paid',status:'Processing',paidAt:now}),now,orderId));
    await db.batch(statements);
    await save('audit:'+crypto.randomUUID(),'audit','payment',{action:'Payment webhook accepted',entity:orderId,actor:'Payment webhook',details:{amount:Number(order.total)||0},at:now});
    return NextResponse.json({ok:true});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Webhook processing failed.'},{status:400});}
}
