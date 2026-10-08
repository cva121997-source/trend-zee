import {NextResponse} from 'next/server';
import {database} from '@/lib/store-server';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 try{
  const productId=new URL(req.url).searchParams.get('productId')?.trim()||'';
  if(!productId)return NextResponse.json({products:[]});
  const db=database();
  const orders=await db.prepare('SELECT data FROM records WHERE kind=? ORDER BY updated DESC LIMIT 500').bind('order').all<{data:string}>();
  const scores=new Map<string,number>();
  for(const row of orders.results){
   let order:any;try{order=JSON.parse(row.data)}catch{continue}
   const items=Array.isArray(order.items)?order.items:[];if(!items.some((i:any)=>i.productId===productId))continue;
   for(const item of items){if(item.productId&&item.productId!==productId)scores.set(item.productId,(scores.get(item.productId)||0)+Number(item.quantity||1));}
  }
  const ranked=[...scores.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8);
  const products=await db.prepare('SELECT id,data FROM products WHERE archived=0').all<any>();
  const byId=new Map(products.results.map((r:any)=>[r.id,JSON.parse(r.data)]));
  return NextResponse.json({products:ranked.map(([id,score])=>({...byId.get(id),coPurchaseScore:score})).filter(Boolean)},{headers:{'Cache-Control':'public, max-age=300'}});
 }catch(e){return NextResponse.json({error:'Recommendations are temporarily unavailable.'},{status:503});}
}
