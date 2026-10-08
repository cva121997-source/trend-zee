import {env} from 'cloudflare:workers';

export type ShippingMethod={id:string;label:string;amount:number;eta:string;serviceable:boolean;provider:'preview'|'custom'};
const config=(name:string)=>String((env as any)[name]||process.env[name]||'');
export function shippingProvider(){const v=config('SHIPPING_PROVIDER').toLowerCase();return v==='custom'?'custom':'preview';}

export async function quoteShipping(pincode:string,subtotal:number):Promise<ShippingMethod[]>{
  if(!/^\d{6}$/.test(pincode))return [];
  if(shippingProvider()==='custom'){
    const url=config('SHIPPING_API_URL');const token=config('SHIPPING_API_TOKEN');
    if(!url)throw new Error('Shipping provider is set to custom but SHIPPING_API_URL is missing.');
    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({pincode,subtotal,currency:'INR'})});
    if(!r.ok)throw new Error(`Shipping provider returned ${r.status}.`);
    const body:any=await r.json();
    const methods=Array.isArray(body.methods)?body.methods:[body];
    return methods.map((m:any)=>({id:String(m.id||'custom-standard'),label:String(m.label||'Standard delivery'),amount:Math.max(0,Math.round(Number(m.amount)||0)),eta:String(m.eta||'Provider ETA'),serviceable:m.serviceable!==false,provider:'custom' as const})).slice(0,8);
  }
  return [
    {id:'preview-standard',label:'Standard delivery',amount:subtotal>=1999?0:99,eta:'3–7 business days (preview)',serviceable:true,provider:'preview'},
    {id:'preview-express',label:'Express delivery',amount:199,eta:'1–3 business days (preview)',serviceable:true,provider:'preview'},
  ];
}
