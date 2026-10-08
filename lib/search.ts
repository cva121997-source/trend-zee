import type {Product} from '@/lib/catalog';

function distance(a:string,b:string){
  if(a===b)return 0;
  const prev=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    let left=i,diag=i-1;
    for(let j=1;j<=b.length;j++){
      const up=prev[j],cost=a[i-1]===b[j-1]?0:1;
      const next=Math.min(up+1,left+1,diag+cost);diag=up;prev[j]=next;left=next;
    }
  }
  return prev[b.length];
}
export function matchesProductQuery(product:Product,query:string){
  const tokens=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if(!tokens.length)return true;
  const fields=[product.name,product.brand,product.category,product.type,...(product.tags||[])].map(x=>String(x||'').toLowerCase());
  const words=fields.flatMap(x=>x.split(/[^a-z0-9]+/).filter(Boolean));
  return tokens.every(token=>{
    if(fields.some(field=>field.includes(token)))return true;
    return words.some(word=>word.length>3&&distance(token,word)<=Math.min(2,Math.floor(token.length/4)+1));
  });
}
