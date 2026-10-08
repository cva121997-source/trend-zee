import {env} from 'cloudflare:workers';
import {database,digest,secret} from '@/lib/store-server';
import {sendSms} from '@/lib/notifications';

const cfg=(name:string)=>String((env as any)[name]||process.env[name]||'');
const clean=(v:unknown,max=160)=>String(v??'').trim().slice(0,max);
const normalizeMobile=(v:string)=>{const x=v.replace(/\s+/g,'');return /^\+?[0-9]{10,13}$/.test(x)?x:''};

export async function requestOtp(targetRaw:string,anonymousId:string){
  const target=normalizeMobile(targetRaw);if(!target)throw new Error('Enter a valid mobile number.');
  const recent=await database().prepare("SELECT COUNT(*) AS count FROM otp_challenges WHERE target=? AND created_at>datetime('now','-10 minutes')").bind(target).first<any>();
  if(Number(recent?.count||0)>=3)throw new Error('Too many verification attempts. Please try again later.');
  const code=String(Math.floor(100000+Math.random()*900000));const id='OTP-'+crypto.randomUUID();
  const codeHash=await digest(id+':'+code+':'+secret('OTP_SIGNING_SECRET')||secret('ADMIN_SESSION_SECRET'));
  const now=new Date(),expires=new Date(now.getTime()+5*60*1000).toISOString();
  await database().prepare("INSERT INTO otp_challenges (id,target,channel,code_hash,anonymous_id,attempts,expires_at,created_at) VALUES (?,?,?,?,?,0,?,?)")
    .bind(id,target,'sms',codeHash,anonymousId,expires,now.toISOString()).run();
  const sent=await sendSms(target,'Trend-Zee verification code: '+code+'. It expires in 5 minutes.');
  if(sent.provider==='preview'){
    if(cfg('OTP_PREVIEW_MODE')!=='true')throw new Error('SMS verification is not configured. Set Twilio credentials or enable OTP_PREVIEW_MODE for development.');
    return {ok:true,previewCode:code,expiresAt:expires};
  }
  return {ok:true,expiresAt:expires};
}

export async function verifyOtp(targetRaw:string,codeRaw:string,anonymousId:string){
  const target=normalizeMobile(targetRaw),code=clean(codeRaw,12).replace(/\D/g,'');if(!target||!/^[0-9]{6}$/.test(code))throw new Error('Enter the six-digit verification code.');
  const challenge=await database().prepare("SELECT * FROM otp_challenges WHERE target=? AND anonymous_id=? AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1").bind(target,anonymousId).first<any>();
  if(!challenge)throw new Error('Verification code not found. Request a new code.');
  if(new Date(challenge.expires_at).getTime()<Date.now())throw new Error('That code has expired. Request a new one.');
  if(Number(challenge.attempts||0)>=5)throw new Error('Too many incorrect attempts. Request a new code.');
  const expected=await digest(String(challenge.id)+':'+code+':'+secret('OTP_SIGNING_SECRET')||secret('ADMIN_SESSION_SECRET'));
  if(expected!==String(challenge.code_hash)){
    await database().prepare('UPDATE otp_challenges SET attempts=attempts+1 WHERE id=?').bind(challenge.id).run();
    throw new Error('That code is incorrect.');
  }
  await database().prepare('UPDATE otp_challenges SET consumed_at=? WHERE id=?').bind(new Date().toISOString(),challenge.id).run();
  return {verified:true,target};
}
