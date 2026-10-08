import {env} from 'cloudflare:workers';

export function taxProvider(){return String((env as any).TAX_PROVIDER||process.env.TAX_PROVIDER||'preview').toLowerCase()==='custom'?'custom':'preview';}
export function calculateTax(subtotal:number){if(taxProvider()==='custom'){return {amount:0,display:'Tax calculated by provider at final checkout.'};}return {amount:0,display:'Tax calculation is in preview mode and must be connected before paid launch.'};}
