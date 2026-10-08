import {NextResponse} from 'next/server';
import {database,row,read} from '@/lib/store-server';
import {verifyWebhook,verifyRazorpayWebhook} from '@/lib/payments';
import {settlePaidOrder} from '@/lib/payment-settlement';

export const dynamic='force-dynamic';

export async function POST(req:Request){
  try{
    const raw=await req.text();
    const razorpaySignature=req.headers.get('x-razorpay-signature')||'';
    if(razorpaySignature){
      if(!(await verifyRazorpayWebhook(raw,razorpaySignature)))return NextResponse.json({error:'Invalid Razorpay webhook signature.'},{status:401});
      const body:any=JSON.parse(raw);
      const event=String(body.event||'');
      if(!['payment.captured','order.paid'].includes(event))return NextResponse.json({ok:true,ignored:true});
      const payment=body?.payload?.payment?.entity||{};
      const orderEntity=body?.payload?.order?.entity||{};
      const providerPaymentId=String(payment.id||'').trim();
      const providerOrderId=String(payment.order_id||orderEntity.id||'').trim();
      if(!providerOrderId)throw new Error('Razorpay order reference is missing.');
      const paymentRow=await database().prepare('SELECT order_id,status FROM payments WHERE provider=? AND provider_order_id=? ORDER BY created_at DESC LIMIT 1').bind('razorpay',providerOrderId).first<any>();
      if(!paymentRow)throw new Error('Unknown Razorpay order reference.');
      const result=await settlePaidOrder(String(paymentRow.order_id),{provider:'razorpay',providerPaymentId,providerOrderId});
      return NextResponse.json({ok:true,idempotent:result.idempotent});
    }
    const signature=req.headers.get('x-trend-zee-signature')||'';
    if(!(await verifyWebhook(raw,signature)))return NextResponse.json({error:'Invalid webhook signature.'},{status:401});
    const body:any=JSON.parse(raw);const orderId=String(body.orderId||'').trim();const status=String(body.status||'').toLowerCase();
    if(!orderId||!['paid','failed'].includes(status))throw new Error('Invalid payment event.');
    const record=await row(orderId);if(!record||record.kind!=='order')throw new Error('Order not found.');const order=read(record);
    if(status==='failed'){if(order.paymentStatus!=='Paid')await database().prepare('UPDATE records SET data=?,updated=? WHERE id=?').bind(JSON.stringify({...order,paymentStatus:'Failed',paymentFailedAt:new Date().toISOString()}),new Date().toISOString(),orderId).run();return NextResponse.json({ok:true});}
    const result=await settlePaidOrder(orderId,{provider:String(order.paymentProvider||'custom'),providerPaymentId:body.paymentId,providerOrderId:body.paymentOrderId});
    return NextResponse.json({ok:true,idempotent:result.idempotent});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Webhook processing failed.'},{status:400});}
}
