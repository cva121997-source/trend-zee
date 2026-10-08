import {env} from 'cloudflare:workers';

const value=(name:string)=>String((env as any)[name]||process.env[name]||'');
const clean=(v:unknown,max=500)=>String(v??'').trim().slice(0,max);
const htmlEscape=(v:unknown)=>clean(v,500).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

export type NotificationProvider='preview'|'resend'|'twilio'|'webhook';

export function notificationStatus(){
  const email=value('RESEND_API_KEY')?'resend':value('NOTIFICATION_WEBHOOK_URL')?'webhook':'preview';
  const sms=value('TWILIO_ACCOUNT_SID')&&value('TWILIO_AUTH_TOKEN')&&value('TWILIO_FROM')?'twilio':'preview';
  return {email,sms,ready:email!=='preview'||sms!=='preview'};
}

async function postJson(url:string,body:unknown,headers:Record<string,string>={}){
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  if(!r.ok)throw new Error(`Notification provider returned ${r.status}.`);
  return r;
}

export async function sendTransactionalEmail(to:string,subject:string,html:string){
  const apiKey=value('RESEND_API_KEY');
  if(apiKey){
    await postJson('https://api.resend.com/emails',{from:value('NOTIFICATION_FROM')||'Trend-Zee <onboarding@resend.dev>',to:[clean(to,200)],subject:clean(subject,200),html},{
      Authorization:`Bearer ${apiKey}`,
    });
    return {provider:'resend' as const};
  }
  const webhook=value('NOTIFICATION_WEBHOOK_URL');
  if(webhook){
    await postJson(webhook,{channel:'email',to:clean(to,200),subject:clean(subject,200),html});
    return {provider:'webhook' as const};
  }
  return {provider:'preview' as const};
}

export async function sendSms(to:string,message:string){
  const sid=value('TWILIO_ACCOUNT_SID'),token=value('TWILIO_AUTH_TOKEN'),from=value('TWILIO_FROM');
  if(sid&&token&&from){
    const body=new URLSearchParams({To:clean(to,30),From:from,Body:clean(message,900)});
    const auth=btoa(`${sid}:${token}`);
    const r=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,{method:'POST',headers:{Authorization:`Basic ${auth}`,'Content-Type':'application/x-www-form-urlencoded'},body});
    if(!r.ok)throw new Error(`SMS provider returned ${r.status}.`);
    return {provider:'twilio' as const};
  }
  return {provider:'preview' as const};
}

export async function notifyOrderEvent(order:any,event:string){
  const subject=event==='paid'?'Trend-Zee payment confirmed':event==='shipped'?'Trend-Zee order dispatched':event==='delivered'?'Trend-Zee order delivered':`Trend-Zee order update · ${event}`;
  const name=clean(order.name||'there',100);
  const safeName=htmlEscape(name),safeId=htmlEscape(order.id),safeEvent=htmlEscape(event);const html=`<div style="font-family:Arial,sans-serif"><h2>TREND ZEE</h2><p>Hi ${safeName},</p><p>Your order <strong>${safeId}</strong> is now <strong>${safeEvent}</strong>.</p><p>Total: INR ${Math.round(Number(order.total||0)).toLocaleString('en-IN')}</p></div>`;
  const results:{email?:string;sms?:string}={};
  try{if(order.email){const r=await sendTransactionalEmail(order.email,subject,html);results.email=r.provider;}}catch(e){console.error('email notification',e);}
  try{if(order.mobile){const r=await sendSms(order.mobile,`Trend-Zee: order ${clean(order.id,40)} is ${clean(event,40)}. Total INR ${Math.round(Number(order.total||0))}.`);results.sms=r.provider;}}catch(e){console.error('sms notification',e);}
  return results;
}
