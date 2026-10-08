'use client';

import {useEffect,useState} from 'react';
import {ArrowLeft,Heart,ShoppingBag} from 'lucide-react';
import {Toaster,toast} from 'sonner';
import {money,Product} from '@/lib/catalog';
import {api} from '@/lib/client';

export default function WishlistPage(){
 const [products,setProducts]=useState<Product[]>([]);const [items,setItems]=useState<string[]>([]);const [cart,setCart]=useState<any>({items:[]});const [loading,setLoading]=useState(true);
 const load=async()=>{const r=await fetch('/api/store');const d:any=await r.json();if(!r.ok)throw new Error(d.error);setProducts(d.products||[]);setItems(d.cart?.saved||[]);setCart(d.cart||{items:[]})};
 useEffect(()=>{load().catch(e=>toast.error(e.message)).finally(()=>setLoading(false))},[]);
 async function update(saved:string[],nextCart=cart.items){try{const d=await api('cart',{items:nextCart,saved});setItems(d.cart.saved);setCart(d.cart);toast.success('Wishlist updated')}catch(e){toast.error((e as Error).message)}}
 async function move(p:Product){if(!p.stock)return;const existing=cart.items.find((i:any)=>i.productId===p.id&&i.size===p.sizes[0]&&i.color===p.colors[0]);const next=cart.items.map((i:any)=>({...i}));if(existing)next[next.indexOf(existing)]={...existing,quantity:Math.min(p.stock,Math.min(10,existing.quantity+1))};else next.push({productId:p.id,quantity:1,size:p.sizes[0],color:p.colors[0]});await update(items.filter(id=>id!==p.id),next)}
 if(loading)return <div className="store-loading"><span className="logo">TREND ZEE</span><p>Loading wishlist…</p></div>;
 const savedProducts=items.map(id=>products.find(p=>p.id===id)).filter(Boolean) as Product[];
 return <><Toaster richColors/><header className="store-header"><a className="logo" href="/">TREND ZEE<sup>®</sup></a><div className="header-actions"><a href="/shop">Shop</a><a href="/account">Account</a></div></header><main className="wishlist-page-shell"><a className="text-button" href="/shop"><ArrowLeft size={16}/> Back to shop</a><section className="wishlist-hero"><span className="eyebrow">YOUR SAVED EDIT</span><h1>Keep the pieces you’re not ready to forget.</h1><p>{savedProducts.length} saved item{savedProducts.length===1?'':'s'} · stock and price updates stay live.</p></section>{savedProducts.length?<div className="shop-grid">{savedProducts.map(p=><article className="shop-card" key={p.id}><a href={'/product/'+p.id} className="shop-card-img"><img src={p.images[0]} alt={p.name} loading="lazy"/><span>{p.stock>0?'In stock':'Out of stock'}</span></a><div className="shop-card-body"><div className="split"><a href={'/product/'+p.id}><h2>{p.name}</h2></a><b>{money(p.price)}</b></div><p>{p.brand} · {p.type}</p><div className="wishlist-actions"><button className="button" disabled={!p.stock} onClick={()=>move(p)}><ShoppingBag size={15}/> Move to bag</button><button className="text-button danger-text" onClick={()=>update(items.filter(id=>id!==p.id))}><Heart size={15}/> Remove</button></div></div></article>)}</div>:<div className="empty"><Heart size={36}/><h2>Your wishlist is waiting.</h2><p>Save products from the catalogue and return here when you're ready.</p><a className="button" href="/shop">Find your next favourite</a></div>}</main></>;
}
