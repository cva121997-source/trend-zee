import {NextResponse} from 'next/server';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {database,row,read,cookie,checkOrigin} from '@/lib/store-server';
import {createRazorpayOrder,paymentProvider,razorpayKeyId} from '@/lib/payments';

export const dynamic='force-dynamic';

async function owner(req:Request){
  const user=await getChatGPTUser();const raw=cookie(req,'tz_bag');const anon=/^[a-f0-9-]{36}$/.test(raw)?raw:crypto.randomUUID();
  return user?.userId||'guest:'+anon;
}

export async function POST(req:Request){
  try{
    checkOrigin(req);
    const body:any=await req.json();const id=String(body.orderId||'').trim();if(!id)throw new Error('Order reference is required.');
    const who=await owner(req);const record=await row(id);
    if(!record||record.kind!=='order'||record.owner!==who)throw new Error('Order not found.');
    const order=read(record);if(order.paymentStatus==='Paid')return NextResponse.json({ok:true,paid:true,orderId:id});
    if(order.status!=='Awaiting payment')throw new Error('This order is not waiting for payment.');
    const provider=paymentProvider();const amount=Math.round(Number(order.total)||0);
    if(provider==='preview')return NextResponse.json({error:'Payment provider is not configured. Set PAYMENT_PROVIDER=razorpay (or mock for local demo).'},{status:503});
    if(provider==='razorpay'){
      const rp=await createRazorpayOrder(amount,id);
      const now=new Date().toISOString();
      await database().prepare('INSERT OR REPLACE INTO payments (id,order_id,provider,provider_order_id,amount,currency,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
        .bind('PAY-'+crypto.randomUUID(),id,'razorpay',String(rp.id),amount,'INR','created',now,now).run();
      await database().prepare('UPDATE records SET data=?,updated=? WHERE id=?').bind(JSON.stringify({...order,paymentProvider:'razorpay',paymentOrderId:String(rp.id),paymentIntentId:String(rp.id)}),now,id).run();
      return NextResponse.json({ok:true,intentId:String(rp.id),provider:'razorpay',providerOrderId:String(rp.id),publicKeyId:razorpayKeyId(),amount,currency:'INR'});
    }
    const intentId='PI-'+crypto.randomUUID().slice(0,12).toUpperCase();const now=new Date().toISOString();
    await database().prepare('INSERT OR REPLACE INTO payments (id,order_id,provider,provider_order_id,amount,currency,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .bind('PAY-'+crypto.randomUUID(),id,provider,intentId,amount,'INR','created',now,now).run();
    await database().prepare('UPDATE records SET data=?,updated=? WHERE id=?').bind(JSON.stringify({...order,paymentProvider:provider,paymentIntentId:intentId}),now,id).run();
    return NextResponse.json({ok:true,intentId,provider,amount,currency:'INR'});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to create payment intent.'},{status:400});}
}
