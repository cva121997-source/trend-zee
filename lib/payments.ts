import {env} from 'cloudflare:workers';

export type PaymentProvider='preview'|'mock'|'custom';
export type PaymentIntent={id:string;orderId:string;amount:number;currency:'INR';provider:PaymentProvider;status:'created'|'paid'|'failed';};

export function paymentProvider():PaymentProvider{
  const value=String((env as any).PAYMENT_PROVIDER||process.env.PAYMENT_PROVIDER||'preview').toLowerCase();
  if(value==='mock')return 'mock';
  if(value==='custom')return 'custom';
  return 'preview';
}

export function paymentWebhookSecret(){return String((env as any).PAYMENT_WEBHOOK_SECRET||process.env.PAYMENT_WEBHOOK_SECRET||'');}

const enc=(s:string)=>new TextEncoder().encode(s);
const hex=(b:ArrayBuffer)=>Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');

export async function hmac(value:string,secret:string){return hex(await crypto.subtle.sign('HMAC',await crypto.subtle.importKey('raw',enc(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']),enc(value)));}

export async function verifyWebhook(raw:string,signature:string){
  const secret=paymentWebhookSecret();
  if(!secret||!signature)return false;
  const expected=await hmac(raw,secret);
  if(expected.length!==signature.length)return false;
  let diff=0;
  for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^signature.charCodeAt(i);
  return diff===0;
}
