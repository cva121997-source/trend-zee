import {database} from '@/lib/store-server';

export type AnalyticsEventInput={
  anonymousId:string;
  customerId?:string;
  eventName:string;
  path?:string;
  productId?:string;
  orderId?:string;
  query?:string;
  value?:number;
  metadata?:Record<string,unknown>;
};

const clean=(v:unknown,max=180)=>String(v??'').trim().slice(0,max);
const safeNumber=(v:unknown)=>Number.isFinite(Number(v))?Math.max(0,Number(v)):0;

export async function recordAnalyticsEvent(input:AnalyticsEventInput){
  const now=new Date().toISOString();
  const id='AE-'+crypto.randomUUID();
  await database().prepare(`INSERT INTO analytics_events
    (id,anonymous_id,customer_id,event_name,path,product_id,order_id,search_query,value,metadata,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(
      id,
      clean(input.anonymousId,120),
      clean(input.customerId,120)||null,
      clean(input.eventName,60),
      clean(input.path,500)||null,
      clean(input.productId,120)||null,
      clean(input.orderId,120)||null,
      clean(input.query,160)||null,
      Math.round(safeNumber(input.value)),
      JSON.stringify(input.metadata??{}),
      now,
    ).run();
  return id;
}

export async function listAnalyticsEvents(limit=2000){
  const rows=await database().prepare(`SELECT * FROM analytics_events ORDER BY created_at DESC LIMIT ?`).bind(Math.min(10000,Math.max(1,limit))).all<any>();
  return rows.results.map(r=>({
    id:r.id,anonymousId:r.anonymous_id,customerId:r.customer_id,eventName:r.event_name,path:r.path,
    productId:r.product_id,orderId:r.order_id,query:r.search_query,value:Number(r.value||0),
    metadata:JSON.parse(r.metadata||'{}'),created:r.created_at,
  }));
}
