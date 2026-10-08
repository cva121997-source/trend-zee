import {NextResponse} from 'next/server';
import {cookie,checkOrigin} from '@/lib/store-server';
import {requestOtp} from '@/lib/otp';

export const dynamic='force-dynamic';

export async function POST(req:Request){
  try{
    checkOrigin(req);
    const body:any=await req.json();
    const existing=cookie(req,'tz_bag');const anonymousId=/^[a-f0-9-]{36}$/.test(existing)?existing:crypto.randomUUID();
    const result=await requestOtp(String(body.mobile||''),anonymousId);
    const response=NextResponse.json(result);
    if(!existing)response.headers.append('Set-Cookie',`tz_bag=${anonymousId}; Path=/; SameSite=Lax; Max-Age=2592000`);
    return response;
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not send verification code.'},{status:400});}
}
