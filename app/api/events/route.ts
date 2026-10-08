import {NextResponse} from 'next/server';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {recordAnalyticsEvent} from '@/lib/analytics';
import {cookie,checkOrigin,digest} from '@/lib/store-server';
import {database} from '@/lib/store-server';

export const dynamic='force-dynamic';

const clean=(v:unknown,max=180)=>String(v??'').trim().slice(0,max);

async function identity(req:Request){
  const user=await getChatGPTUser();
  const raw=cookie(req,'tz_bag');
  const anon=/^[a-f0-9-]{36}$/.test(raw)?raw:crypto.randomUUID();
  return {user,anon};
}

export async function POST(req:Request){
  try{
    const origin=req.headers.get('origin');
    if(origin)checkOrigin(req);
    const body:any=await req.json();
    const {user,anon}=await identity(req);
    const eventName=clean(body.eventName,60).replace(/[^a-zA-Z0-9_.-]/g,'_');
    if(!eventName)throw new Error('Event name is required.');
    const ip=req.headers.get('cf-connecting-ip')||'local';
    const key='analytics-rate:'+await digest(ip+':'+anon);
    const now=Date.now();
    const existing=await database().prepare('SELECT value FROM analytics_rate WHERE id=?').bind(key).first<any>().catch(()=>null);
    const state=existing?JSON.parse(existing.value||'{}'):{count:0,until:0};
    if(state.until>now&&state.count>=120)return NextResponse.json({ok:true},{status:202});
    const next=state.until>now?{count:state.count+1,until:state.until}:{count:1,until:now+60000};
    await database().prepare('INSERT INTO analytics_rate (id,value,expires_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value,expires_at=excluded.expires_at').bind(key,JSON.stringify(next),new Date(next.until).toISOString()).run();
    await recordAnalyticsEvent({
      anonymousId:anon,customerId:user?.userId,eventName,path:clean(body.path,500),productId:clean(body.productId,120),
      orderId:clean(body.orderId,120),query:clean(body.query,160),value:Number.isFinite(Number(body.value))?Number(body.value):0,
      metadata:body.metadata&&typeof body.metadata==='object'?body.metadata:{},
    });
    const res=NextResponse.json({ok:true},{status:202});
    if(!cookie(req,'tz_bag'))res.headers.append('Set-Cookie',`tz_bag=${anon}; Path=/; SameSite=Lax; Max-Age=2592000`);
    return res;
  }catch(e){
    console.error(e);
    return NextResponse.json({error:'Event ignored.'},{status:202});
  }
}
