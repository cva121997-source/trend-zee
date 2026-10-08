import {NextResponse} from 'next/server';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {row,cookie,checkOrigin,read} from '@/lib/store-server';
import {paymentProvider} from '@/lib/payments';
import {settlePaidOrder} from '@/lib/payment-settlement';

export const dynamic='force-dynamic';
async function currentOwner(req:Request){const user=await getChatGPTUser();const raw=cookie(req,'tz_bag');const anon=/^[a-f0-9-]{36}$/.test(raw)?raw:crypto.randomUUID();return user?.userId||'guest:'+anon;}

export async function POST(req:Request){
  try{
    checkOrigin(req);
    if(paymentProvider()!=='mock')return NextResponse.json({error:'Mock payments are disabled. Set PAYMENT_PROVIDER=mock only for development/demo use.'},{status:403});
    const body:any=await req.json();const orderId=String(body.orderId||'').trim();const who=await currentOwner(req);const record=await row(orderId);
    if(!record||record.kind!=='order'||record.owner!==who)throw new Error('Order not found.');
    const order=read(record);if(order.paymentStatus==='Paid')return NextResponse.json({ok:true,alreadyPaid:true});
    const result=await settlePaidOrder(orderId,{provider:'mock',providerPaymentId:'MOCK-'+crypto.randomUUID().slice(0,12).toUpperCase()});
    return NextResponse.json({ok:true,orderId,paymentStatus:'Paid',status:result.order.status});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to complete payment.'},{status:400});}
}
