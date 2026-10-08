import {NextResponse} from 'next/server';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {row,cookie,checkOrigin,read} from '@/lib/store-server';
import {paymentProvider,verifyRazorpayPaymentSignature} from '@/lib/payments';
import {settlePaidOrder} from '@/lib/payment-settlement';

export const dynamic='force-dynamic';

async function owner(req:Request){const user=await getChatGPTUser();const raw=cookie(req,'tz_bag');const anon=/^[a-f0-9-]{36}$/.test(raw)?raw:crypto.randomUUID();return user?.userId||'guest:'+anon;}

export async function POST(req:Request){
  try{
    checkOrigin(req);
    if(paymentProvider()!=='razorpay')return NextResponse.json({error:'Razorpay verification is not enabled.'},{status:403});
    const body:any=await req.json();const orderId=String(body.orderId||'').trim();const razorpayOrderId=String(body.razorpayOrderId||'').trim();const razorpayPaymentId=String(body.razorpayPaymentId||'').trim();const signature=String(body.razorpaySignature||'').trim();
    if(!orderId||!razorpayOrderId||!razorpayPaymentId||!signature)throw new Error('Payment verification details are incomplete.');
    const who=await owner(req);const record=await row(orderId);if(!record||record.kind!=='order'||record.owner!==who)throw new Error('Order not found.');
    const order=read(record);if(order.paymentOrderId!==razorpayOrderId)throw new Error('Payment order mismatch.');
    if(!(await verifyRazorpayPaymentSignature(razorpayOrderId,razorpayPaymentId,signature)))return NextResponse.json({error:'Payment signature could not be verified.'},{status:401});
    const result=await settlePaidOrder(orderId,{provider:'razorpay',providerPaymentId:razorpayPaymentId,providerOrderId:razorpayOrderId});
    return NextResponse.json({ok:true,orderId,paymentStatus:'Paid',idempotent:result.idempotent});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Payment verification failed.'},{status:400});}
}
