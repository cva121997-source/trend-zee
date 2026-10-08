import {env} from 'cloudflare:workers';

export type PaymentProvider='preview'|'mock'|'razorpay'|'custom';

const secret=(name:string)=>String((env as any)[name]||process.env[name]||'');

export function paymentProvider():PaymentProvider{
  const value=secret('PAYMENT_PROVIDER').toLowerCase();
  if(value==='mock')return 'mock';
  if(value==='razorpay')return 'razorpay';
  if(value==='custom')return 'custom';
  return 'preview';
}
export function paymentWebhookSecret(){return secret('PAYMENT_WEBHOOK_SECRET');}
export function razorpayKeyId(){return secret('RAZORPAY_KEY_ID');}
export function razorpaySecret(){return secret('RAZORPAY_KEY_SECRET');}
export function razorpayWebhookSecret(){return secret('RAZORPAY_WEBHOOK_SECRET')||paymentWebhookSecret();}

const enc=(s:string)=>new TextEncoder().encode(s);
const hex=(b:ArrayBuffer)=>Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');

export async function hmac(value:string,key:string){return hex(await crypto.subtle.sign('HMAC',await crypto.subtle.importKey('raw',enc(key),{name:'HMAC',hash:'SHA-256'},false,['sign']),enc(value)));}
export async function verifyHmac(value:string,signature:string,key:string){if(!key||!signature)return false;const expected=await hmac(value,key);if(expected.length!==signature.length)return false;let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^signature.charCodeAt(i);return diff===0;}
export async function verifyWebhook(raw:string,signature:string){return verifyHmac(raw,signature,paymentWebhookSecret());}

async function razorpayFetch(path:string,options:RequestInit={}){
  const key=razorpayKeyId(),secretKey=razorpaySecret();
  if(!key||!secretKey)throw new Error('Razorpay is not configured.');
  const auth=btoa(`${key}:${secretKey}`);
  const r=await fetch('https://api.razorpay.com/v1/'+path,{...options,headers:{Authorization:`Basic ${auth}`,'Content-Type':'application/json',...(options.headers||{})}});
  const body=await r.text();let json:any={};try{json=JSON.parse(body)}catch{}
  if(!r.ok)throw new Error(json?.error?.description||`Razorpay returned ${r.status}.`);
  return json;
}

export async function createRazorpayOrder(amount:number,receipt:string){
  return razorpayFetch('orders',{method:'POST',body:JSON.stringify({amount:Math.max(1,Math.round(amount*100)),currency:'INR',receipt:receipt.slice(0,40),payment_capture:1})});
}
export async function refundRazorpay(paymentId:string,amount:number,notes:Record<string,string>={}){
  return razorpayFetch(`payments/${encodeURIComponent(paymentId)}/refund`,{method:'POST',body:JSON.stringify({amount:Math.max(1,Math.round(amount*100)),notes})});
}
export async function verifyRazorpayPaymentSignature(orderId:string,paymentId:string,signature:string){
  return verifyHmac(`${orderId}|${paymentId}`,signature,razorpaySecret());
}
export async function verifyRazorpayWebhook(raw:string,signature:string){
  return verifyHmac(raw,signature,razorpayWebhookSecret());
}
