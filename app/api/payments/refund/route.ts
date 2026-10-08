import {NextResponse} from 'next/server';
import {row,read,save,isAdmin,adminRole,checkOrigin,database} from '@/lib/store-server';
import {canAdmin} from '@/lib/roles';
import {paymentProvider,refundRazorpay} from '@/lib/payments';
import {recordAnalyticsEvent} from '@/lib/analytics';

export const dynamic='force-dynamic';

export async function POST(req:Request){
  try{
    checkOrigin(req);
    if(!await isAdmin(req))return NextResponse.json({error:'Admin access required.'},{status:401});
    const role=await adminRole(req);
    if(!role||!canAdmin(role,'adminReturn')||!canAdmin(role,'adminOrder'))return NextResponse.json({error:'Your admin role cannot process refunds.'},{status:403});
    const body:any=await req.json();
    const returnId=String(body.returnId||'').trim();
    const r=await row(returnId);
    if(!r||r.kind!=='return')throw new Error('Return case not found.');
    const ret=read(r);
    const orderRow=await row(String(ret.orderId||''));
    if(!orderRow||orderRow.kind!=='order')throw new Error('Order record not found.');
    const order=read(orderRow);
    if(order.paymentStatus!=='Paid'&&order.paymentStatus!=='Refunded')throw new Error('Only paid orders can be refunded.');
    const amount=Math.max(0,Math.min(Number(order.total||0),Math.round(Number(body.amount??ret.refundAmount??order.total))));
    if(amount<=0)throw new Error('Refund amount must be greater than zero.');
    const provider=paymentProvider();
    const payment=await database().prepare('SELECT * FROM payments WHERE order_id=? ORDER BY created_at DESC LIMIT 1').bind(order.id).first<any>();
    let refundId='REF-'+crypto.randomUUID().slice(0,10).toUpperCase();
    if(provider==='razorpay'){
      if(!payment?.provider_payment_id)throw new Error('Razorpay payment reference is missing; wait for payment verification.');
      const refund=await refundRazorpay(payment.provider_payment_id,amount,{orderId:order.id,returnId});
      refundId=String(refund.id||refundId);
    }else if(provider==='preview')throw new Error('Connect a payment provider before processing refunds.');
    const now=new Date().toISOString();
    const nextReturn={...ret,refundAmount:amount,refundId,refundedAt:now,status:'Closed',internalNote:ret.internalNote||''};
    const full=amount>=Number(order.total||0);
    const nextOrder={...order,paymentStatus:full?'Refunded':'Paid',refundId:full?refundId:order.refundId||'',refundedAt:full?now:order.refundedAt||''};
    await save(r.id,'return',r.owner,nextReturn);
    await save(order.id,'order',orderRow.owner,nextOrder);
    if(payment)await database().prepare('UPDATE payments SET status=?,updated_at=? WHERE id=?').bind(full?'refunded':'partially_refunded',now,payment.id).run();
    await recordAnalyticsEvent({anonymousId:'admin',customerId:orderRow.owner,eventName:'refund_processed',orderId:order.id,value:amount,metadata:{returnId,provider}});
    await save('audit:'+crypto.randomUUID(),'audit','admin',{action:'Refund processed',entity:returnId,actor:'Admin',details:{orderId:order.id,amount,provider,refundId},at:now});
    return NextResponse.json({ok:true,refundId,amount});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Refund failed.'},{status:400});}
}
