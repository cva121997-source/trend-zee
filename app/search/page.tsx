'use client';

import {useEffect,useMemo,useState} from 'react';
import {ArrowRight,Search} from 'lucide-react';
import type {Product} from '@/lib/catalog';
import {money} from '@/lib/catalog';
import {matchesProductQuery} from '@/lib/search';

export default function SearchPage(){
 const [products,setProducts]=useState<Product[]>([]);const [q,setQ]=useState('');const [loading,setLoading]=useState(true);const [recent,setRecent]=useState<string[]>([]);
 useEffect(()=>{(async()=>{try{const r=await fetch('/api/store');const d:any=await r.json();setProducts(d.products||[]);const initial=new URLSearchParams(location.search).get('q')||'';setQ(initial);try{const rs=JSON.parse(localStorage.getItem('tz_recent_searches')||'[]').slice(0,6);setRecent(rs)}catch{}}finally{setLoading(false)}})()},[]);
 const hits=useMemo(()=>{const x=q.trim();if(!x)return products.slice(0,6);return products.filter(p=>matchesProductQuery(p,x)).slice(0,12)},[q,products]); const rememberSearch=()=>{const term=q.trim();if(!term)return;const next=[term,...recent.filter(x=>x.toLowerCase()!==term.toLowerCase())].slice(0,6);setRecent(next);try{localStorage.setItem('tz_recent_searches',JSON.stringify(next))}catch{}};
 if(loading)return <div className="store-loading"><span className="logo">TREND ZEE</span><p>Opening search…</p></div>;
 return <main className="search-page-shell"><header className="search-page-top"><a className="logo" href="/">TREND ZEE<sup>®</sup></a><a className="text-button" href="/shop">Shop</a></header><section className="search-stage"><span className="eyebrow">SEARCH</span><h1>What are you looking for?</h1><form onSubmit={e=>{e.preventDefault();rememberSearch()}}><Search size={20}/><input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Try “shirt”, “sneaker”, “bag”…"/></form>{q&&<p>{hits.length} result{hits.length===1?'':'s'} for “{q}”</p>}{!q&&<div className="search-suggestions"><span>Popular</span><a href="/shop?q=Clothing">Clothing</a><a href="/shop?q=sneaker">Sneakers</a><a href="/shop?q=Bags">Bags</a><a href="/shop?q=weekend">Weekend</a></div>}<div className="search-results">{hits.map(p=><a className="search-result" href={'/product/'+p.id} key={p.id}><img src={p.images[0]} alt={p.name}/><span><b>{p.name}</b><small>{p.brand} · {p.category}</small></span><strong>{money(p.price)}</strong><ArrowRight size={16}/></a>)}</div>{q&&!hits.length&&<div className="empty"><h2>No exact matches.</h2><p>Try a broader keyword, category, or price range.</p><a className="button" href="/shop">Open full filters</a></div>}</section></main>;
}
