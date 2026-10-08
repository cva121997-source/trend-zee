import {database,save,row,read} from '@/lib/store-server';
import {notifyOrderEvent} from '@/lib/notifications';
import {recordAnalyticsEvent} from '@/lib/analytics';
import {syncOrder,syncCouponRedemption} from '@/lib/commerce-sync';

export async function settlePaidOrder(orderId:string,meta:{provider:string;providerPaymentId?:string;providerOrderId?:string}){
  const record=await row(orderId);
  if(!record||record.kind!=='order')throw new Error('Order not found.');
  const order=read(record);
  if(order.paymentStatus==='Paid'||order.paymentStatus==='Refunded')return {idempotent:true,order};
  if(order.status!=='Awaiting payment')throw new Error('This order is not awaiting payment.');
  const db=database();
  const items=Array.isArray(order.items)?order.items:[];
  const products=new Map<string,any>();
  for(const item of items){
    const p=await db.prepare('SELECT id,data FROM products WHERE id=? AND archived=0').bind(item.productId).first<any>();
    if(!p)throw new Error('Product missing for paid order.');
    products.set(p.id,JSON.parse(p.data));
  }
  for(const item of items){
    const p=products.get(item.productId);
    const key=item.variantKey||[String(item.size??''),String(item.color??'')].join('::').slice(0,220);
    const available=Number(p.variantStock?.[key]??p.stock??0);
    if(available<Number(item.quantity))throw new Error('Stock changed while payment was completing. The order was not marked paid.');
  }
  const now=new Date().toISOString();
  const statements:any[]=[];
  for(const item of items){
    const p=products.get(item.productId);
    const key=item.variantKey||[String(item.size??''),String(item.color??'')].join('::').slice(0,220);
    const current=Number(p.variantStock?.[key]??p.stock??0);
    const nextVariant=p.variantStock?{...p.variantStock,[key]:current-Number(item.quantity)}:undefined;
    const next={...p,stock:Math.max(0,Number(p.stock)-Number(item.quantity)),...(nextVariant?{variantStock:nextVariant}:{})};
    statements.push(db.prepare('UPDATE products SET data=? WHERE id=?').bind(JSON.stringify(next),p.id));
  }
  const nextOrder={...order,paymentStatus:'Paid',status:'Processing',paidAt:now,paymentProvider:meta.provider,paymentId:meta.providerPaymentId||order.paymentId||'',paymentOrderId:meta.providerOrderId||order.paymentOrderId||''};
  statements.push(db.prepare('UPDATE records SET data=?,updated=? WHERE id=?').bind(JSON.stringify(nextOrder),now,orderId));
  await db.batch(statements);
  const payment=await db.prepare('SELECT id FROM payments WHERE order_id=? ORDER BY created_at DESC LIMIT 1').bind(orderId).first<any>();
  if(payment)await db.prepare('UPDATE payments SET provider_payment_id=?,status=?,updated_at=? WHERE id=?').bind(meta.providerPaymentId||null,'paid',now,payment.id).run();
  else await db.prepare('INSERT OR IGNORE INTO payments (id,order_id,provider,provider_payment_id,provider_order_id,amount,currency,status,raw_event,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .bind('PAY-'+crypto.randomUUID(),orderId,meta.provider,meta.providerPaymentId||null,meta.providerOrderId||null,Math.round(Number(order.total||0)),'INR','paid','',now,now).run();
  await syncOrder(orderId,record.owner,nextOrder);
  if(nextOrder.coupon)await syncCouponRedemption({id:'CR-'+orderId,couponCode:nextOrder.coupon,customerId:record.owner,orderId,amount:Number(nextOrder.discount)||0,createdAt:now});
  await save('audit:'+crypto.randomUUID(),'audit','payment',{action:'Payment settled',entity:orderId,actor:'Payment provider',details:{provider:meta.provider,amount:Number(order.total)||0},at:now});
  await recordAnalyticsEvent({anonymousId:record.owner,customerId:record.owner,eventName:'payment_captured',orderId,value:Number(order.total)||0,metadata:{provider:meta.provider}});
  void notifyOrderEvent(nextOrder,'paid');
  return {idempotent:false,order:nextOrder};
}
