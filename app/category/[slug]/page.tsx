'use client';

import {useEffect,useMemo,useState} from 'react';
import {ArrowLeft,Heart} from 'lucide-react';
import {Toaster,toast} from 'sonner';
import {money,Product} from '@/lib/catalog';
import {api} from '@/lib/client';

export default function CategoryPage({params}:{params:{slug:string}}){
 const [products,setProducts]=useState<Product[]>([]);const [name,setName]=useState('');const [saved,setSaved]=useState<string[]>([]);const [loading,setLoading]=useState(true);
 useEffect(()=>{(async()=>{try{const r=await fetch('/api/store');const d:any=await r.json();if(!r.ok)throw new Error(d.error);const target=decodeURIComponent(params.slug).replace(/-/g,' ').toLowerCase();const matching=(d.products||[]).filter((p:Product)=>p.category.toLowerCase()===target||p.category.toLowerCase().replace(/[^a-z0-9]+/g,'-')===params.slug.toLowerCase());setProducts(matching);setName(matching[0]?.category||decodeURIComponent(params.slug));setSaved(d.cart?.saved||[])}catch(e){toast.error((e as Error).message)}finally{setLoading(false)}})()},[params.slug]);
 const title=useMemo(()=>name||decodeURIComponent(params.slug).replace(/-/g,' '),[name,params.slug]);
 async function save(id:string){try{const r=await fetch('/api/store');const d:any=await r.json();const list=d.cart?.saved||[];const next=list.includes(id)?list.filter((x:string)=>x!==id):list.concat(id);await api('cart',{items:d.cart?.items||[],saved:next});setSaved(next)}catch(e){toast.error((e as Error).message)}}
 if(loading)return <div className="store-loading"><span className="logo">TREND ZEE</span><p>Loading category…</p></div>;
 return <><Toaster richColors/><header className="store-header"><a className="logo" href="/">TREND ZEE<sup>®</sup></a><div className="header-actions"><a href="/shop">Shop</a><a href="/wishlist"><Heart size={19}/></a></div></header><main className="shop-page-shell"><a className="text-button" href="/shop"><ArrowLeft size={16}/> All products</a><div className="shop-hero"><span className="eyebrow">CATEGORY EDIT</span><h1>{title}</h1><p>Shop the pieces currently available in this category.</p></div><div className="shop-grid">{products.map(p=><article className="shop-card" key={p.id}><a href={'/product/'+p.id} className="shop-card-img"><img src={p.images[0]} alt={p.name} loading="lazy"/><button type="button" aria-label={'Wishlist '+p.name} onClick={e=>{e.preventDefault();save(p.id)}}><Heart size={17} fill={saved.includes(p.id)?'currentColor':'none'}/></button></a><div className="shop-card-body"><div className="split"><a href={'/product/'+p.id}><h2>{p.name}</h2></a><b>{money(p.price)}</b></div><p>{p.brand} · {p.type}</p></div></article>)}</div>{!products.length&&<div className="empty"><h2>No products in this category yet.</h2><a className="button" href="/shop">Explore all products</a></div>}</main></>;
}
