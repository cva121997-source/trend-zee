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
    for(const item of items){const p=products.get(item.productId);if(Number(p.stock)<Number(item.quantity))throw new Error('Insufficient stock for payment capture.');}
    for(const item of items){const p=products.get(item.productId);statements.push(db.prepare('UPDATE products SET data=? WHERE id=?').bind(JSON.stringify({...p,stock:Number(p.stock)-Number(item.quantity)}),p.id));}
    statements.push(db.prepare('UPDATE records SET data=?,updated=? WHERE id=?').bind(JSON.stringify({...order,paymentStatus:'Paid',status:'Processing',paidAt:now}),now,orderId));
    await db.batch(statements);
    await save('audit:'+crypto.randomUUID(),'audit','payment',{action:'Payment webhook accepted',entity:orderId,actor:'Payment webhook',details:{amount:Number(order.total)||0},at:now});
    return NextResponse.json({ok:true});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Webhook processing failed.'},{status:400});}
}
