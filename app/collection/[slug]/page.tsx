'use client';

import {useEffect,useState} from 'react';
import {ArrowLeft,ArrowRight,Heart,ShoppingBag} from 'lucide-react';
import {Toaster,toast} from 'sonner';
import {money,Product} from '@/lib/catalog';
import {api} from '@/lib/client';

export default function CollectionPage({params}:{params:{slug:string}}){
 const [collection,setCollection]=useState<any>(null);const [products,setProducts]=useState<Product[]>([]);const [saved,setSaved]=useState<string[]>([]);const [loading,setLoading]=useState(true);
 useEffect(()=>{(async()=>{try{const r=await fetch('/api/store');const d:any=await r.json();if(!r.ok)throw new Error(d.error);const c=(d.content?.collections||[]).find((x:any)=>x.id===params.slug);if(!c)throw new Error('Collection not found.');setCollection(c);setProducts((c.productIds||[]).map((id:string)=> (d.products||[]).find((p:Product)=>p.id===id)).filter(Boolean));setSaved(d.cart?.saved||[])}catch(e){toast.error((e as Error).message)}finally{setLoading(false)}})()},[params.slug]);
 async function save(id:string){try{const r=await fetch('/api/store');const d:any=await r.json();const list=d.cart?.saved||[];const next=list.includes(id)?list.filter((x:string)=>x!==id):list.concat(id);await api('cart',{items:d.cart?.items||[],saved:next});setSaved(next)}catch(e){toast.error((e as Error).message)}}
 if(loading)return <div className="store-loading"><span className="logo">TREND ZEE</span><p>Loading collection…</p></div>;
 if(!collection)return <main className="shop-page-shell"><a className="text-button" href="/shop"><ArrowLeft size={16}/> Shop</a><div className="empty"><h1>Collection unavailable.</h1></div></main>;
 return <><Toaster richColors/><header className="store-header"><a className="logo" href="/">TREND ZEE<sup>®</sup></a><div className="header-actions"><a href="/shop">Shop</a><a href="/wishlist"><Heart size={19}/></a><a href="/">Bag</a></div></header><main className="collection-page-shell"><a className="text-button" href="/shop"><ArrowLeft size={16}/> Back to shop</a><section className="collection-hero"><div><span className="eyebrow">CURATED COLLECTION</span><h1>{collection.title}</h1><p>{collection.description}</p><a className="button" href="/shop">Shop the full catalogue <ArrowRight size={16}/></a></div><img src={collection.coverImage} alt={collection.title}/></section><section className="collection-products"><div className="section-heading"><div><span className="eyebrow">THE EDIT</span><h2>Pieces in this collection.</h2></div><span>{products.length} products</span></div><div className="shop-grid">{products.map(p=><article className="shop-card" key={p.id}><a href={'/product/'+p.id} className="shop-card-img"><img src={p.images[0]} alt={p.name} loading="lazy"/><span>{p.badge||p.tag}</span><button type="button" aria-label={'Wishlist '+p.name} onClick={e=>{e.preventDefault();save(p.id)}}><Heart size={17} fill={saved.includes(p.id)?'currentColor':'none'}/></button></a><div className="shop-card-body"><div className="split"><a href={'/product/'+p.id}><h2>{p.name}</h2></a><b>{money(p.price)}</b></div><p>{p.brand} · {p.type}</p></div></article>)}</div></section></main></>;
}
