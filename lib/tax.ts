import {envValue} from '@/lib/runtime-env';

const config=(name:string)=>envValue(name);
export function taxProvider(){return config('TAX_PROVIDER').toLowerCase()==='custom'?'custom':'preview';}
export async function calculateTax(subtotal:number,context:Record<string,unknown>={}){
  if(taxProvider()==='custom'){
    const url=config('TAX_API_URL');const token=config('TAX_API_TOKEN');
    if(!url)throw new Error('Tax provider is set to custom but TAX_API_URL is missing.');
    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({subtotal,currency:'INR',...context})});
    if(!r.ok)throw new Error(`Tax provider returned ${r.status}.`);
    const body:any=await r.json();
    return {amount:Math.max(0,Math.round(Number(body.amount)||0)),display:String(body.display||'Tax calculated by provider.')};
  }
  return {amount:0,display:'Tax calculation is in preview mode and must be connected before paid launch.'};
}
