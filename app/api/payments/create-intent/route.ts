import {NextResponse} from 'next/server';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {database,row,save,read,cookie,checkOrigin} from '@/lib/store-server';
import {paymentProvider} from '@/lib/payments';

export const dynamic='force-dynamic';

async function owner(req:Request){
  const user=await getChatGPTUser();
  const raw=cookie(req,'tz_bag');
  const anon=/^[a-f0-9-]{36}$/.test(raw)?raw:crypto.randomUUID();
  return user?.userId||'guest:'+anon;
}

export async function POST(req:Request){
  try{
    checkOrigin(req);
    const body:any=await req.json();
    const id=String(body.orderId||'').trim();
    if(!id)throw new Error('Order reference is required.');
    const who=await owner(req);
    const record=await row(id);
    if(!record||record.kind!=='order'||record.owner!==who)throw new Error('Order not found.');
    const order=read(record);
    if(order.paymentStatus==='Paid')return NextResponse.json({ok:true,paid:true,orderId:id});
    if(order.status!=='Awaiting payment')throw new Error('This order is not waiting for payment.');
    const provider=paymentProvider();
    if(provider==='preview')return NextResponse.json({error:'Payment provider is not configured yet.'},{status:503});
    const intentId='PI-'+crypto.randomUUID().slice(0,12).toUpperCase();
    await save('payment-intent:'+intentId,'payment_intent',who,{id:intentId,orderId:id,amount:Number(order.total)||0,currency:'INR',provider,status:'created',createdAt:new Date().toISOString()});
    return NextResponse.json({ok:true,intentId,provider,amount:Number(order.total)||0,currency:'INR'});
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:'Unable to create payment intent.'},{status:400});
  }
}
