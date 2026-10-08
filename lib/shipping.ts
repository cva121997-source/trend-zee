import {env} from 'cloudflare:workers';

export type ShippingMethod={id:string;label:string;amount:number;eta:string;serviceable:boolean;provider:'preview'|'custom'};

export function shippingProvider(){
  const v=String((env as any).SHIPPING_PROVIDER||process.env.SHIPPING_PROVIDER||'preview').toLowerCase();
  return v==='custom'?'custom':'preview';
}

export function quoteShipping(pincode:string,subtotal:number):ShippingMethod[]{
  if(!/^\d{6}$/.test(pincode))return [];
  const provider=shippingProvider();
  if(provider==='custom'){
    // Keep the contract stable; replace this implementation with carrier/rate API calls.
    return [{id:'custom-standard',label:'Standard delivery',amount:subtotal>=1999?0:99,eta:'Provider ETA at checkout',serviceable:true,provider:'custom'}];
  }
  return [
    {id:'preview-standard',label:'Standard delivery',amount:subtotal>=1999?0:99,eta:'3–7 business days (preview)',serviceable:true,provider:'preview'},
    {id:'preview-express',label:'Express delivery',amount:199,eta:'1–3 business days (preview)',serviceable:true,provider:'preview'},
  ];
}
