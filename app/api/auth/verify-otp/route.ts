import {NextResponse} from 'next/server';
import {cookie,checkOrigin,save,row,read} from '@/lib/store-server';
import {verifyOtp} from '@/lib/otp';

export const dynamic='force-dynamic';

export async function POST(req:Request){
  try{
    checkOrigin(req);
    const body:any=await req.json();const mobile=String(body.mobile||'').trim();const code=String(body.code||'').trim();
    const existing=cookie(req,'tz_bag');const anonymousId=/^[a-f0-9-]{36}$/.test(existing)?existing:crypto.randomUUID();
    const verified=await verifyOtp(mobile,code,anonymousId);
    const owner=anonymousId;
    const profileRow=await row('profile:'+owner);const profile=read(profileRow,{});
    await save('profile:'+owner,'profile',owner,{...profile,mobile:verified.target,mobileVerified:true,mobileVerifiedAt:new Date().toISOString()});
    const response=NextResponse.json({ok:true,verified:true,mobile:verified.target});
    if(!existing)response.headers.append('Set-Cookie',`tz_bag=${anonymousId}; Path=/; SameSite=Lax; Max-Age=2592000`);
    return response;
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Verification failed.'},{status:400});}
}
