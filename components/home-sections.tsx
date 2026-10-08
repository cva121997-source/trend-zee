'use client';

import {useEffect,useRef,useState,type ReactNode} from 'react';
import {ArrowRight,ChevronDown,Clock3,Mail} from 'lucide-react';
import type {Product} from '@/lib/catalog';
import type {Section,SectionItem} from '@/lib/home';
import {api} from '@/lib/client';
import {toast} from 'sonner';

type Props={sections:Section[];products:Product[];renderProduct:(p:Product)=>ReactNode;onNavigate:(href:string)=>boolean};
const reduced=()=>typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function Reveal({animation,className='',children}:{animation:string;className?:string;children:ReactNode}){
 const ref=useRef<HTMLDivElement>(null);const [shown,setShown]=useState(()=>animation==='none'||reduced());
 useEffect(()=>{if(shown)return;const el=ref.current;if(!el||!('IntersectionObserver'in window)){setShown(true);return;}const io=new IntersectionObserver(([e])=>{if(e.isIntersecting){setShown(true);io.disconnect();}},{threshold:.12});io.observe(el);return()=>io.disconnect();},[shown]);
 return <div ref={ref} className={'hs-rv hs-rv-'+animation+(shown?' is-in':'')+' '+className}>{children}</div>;
}
function useParallax(enabled:boolean){
 const ref=useRef<HTMLElement>(null);
 useEffect(()=>{if(!enabled||reduced())return;const el=ref.current;if(!el)return;let raf=0;const update=()=>{raf=0;const r=el.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight)return;el.style.setProperty('--hs-py',Math.round(-r.top*.12)+'px')};const onScroll=()=>{if(!raf)raf=requestAnimationFrame(update)};update();addEventListener('scroll',onScroll,{passive:true});return()=>{removeEventListener('scroll',onScroll);if(raf)cancelAnimationFrame(raf)}} , [enabled]);return ref;
}
function Media({s,eager=false,alt}:{s:Pick<Section,'image'|'mobileImage'>;eager?:boolean;alt:string}){
 if(!s.image)return null;return <picture>{s.mobileImage&&<source media="(max-width: 700px)" srcSet={s.mobileImage}/>}<img src={s.image} alt={alt} loading={eager?'eager':'lazy'} decoding="async" fetchPriority={eager?'high':'auto'}/></picture>;
}
function ProductsFor(s:Section,products:Product[]){
 const manual=()=>s.productIds.map(id=>products.find(p=>p.id===id)).filter((p):p is Product=>!!p);
 if(s.source==='manual')return manual();
 if(s.source==='category')return products.filter(p=>p.category===s.category).slice(0,8);
 if(s.source==='bestSellers')return [...products].sort((a,b)=>(b.rating||0)*(b.reviewCount||1)-(a.rating||0)*(a.reviewCount||1)).slice(0,8);
 if(s.source==='recommended')return [...products].sort((a,b)=>(b.rating||0)-(a.rating||0)).slice(0,8);
 return [...products].slice(-8).reverse();
}

export default function HomeSections({sections,products,renderProduct,onNavigate}:Props){
 const link=(href:string,label:string,kind:'primary'|'ghost'='primary')=>href&&label?<a className={'hs-btn hs-btn-'+kind} href={href} onClick={e=>{if(onNavigate(href))e.preventDefault()}} {...(/^https:/.test(href)?{rel:'noopener noreferrer'}:{})}>{label}<ArrowRight size={16}/></a>:null;
 const frame=(s:Section,extra='')=>'hs hs-'+s.type+' hs-theme-'+s.theme+' hs-align-'+s.align+' '+extra;
 const head=(s:Section)=>(s.eyebrow||s.title||s.subtitle)?<div className="hs-head">{s.eyebrow&&<span className="hs-eyebrow">{s.eyebrow}</span>}{s.title&&<h2>{s.title}</h2>}{s.subtitle&&<p>{s.subtitle}</p>}</div>:null;
 return <>{sections.map((s,index)=>{
  const list=ProductsFor(s,products);
  if(s.type==='hero')return <Hero key={s.id} s={s} products={products} eager={index===0} frame={frame(s)} link={link}/>
  if(s.type==='trustBar')return <section key={s.id} id={s.id} className={frame(s)} aria-label="Store assurances"><Reveal animation={s.animation} className="hs-trust-row">{s.items.map((i:SectionItem,n)=><div key={n}><b>{i.title}</b>{i.text&&<small>{i.text}</small>}</div>)}</Reveal></section>;
  if(s.type==='categoryShowcase')return <section key={s.id} id={s.id} className={frame(s)}><Reveal animation={s.animation}>{head(s)}<div className="hs-tiles">{s.items.map((i,n)=><a key={n} className="hs-tile" href={i.href||'#collection'} onClick={e=>{if(onNavigate(i.href||'#collection'))e.preventDefault()}}>{i.image&&<img src={i.image} alt="" loading="lazy"/>}<span><b>{i.title}</b><i>Shop now <ArrowRight size={14}/></i></span></a>)}</div></Reveal></section>;
  if(s.type==='productRow'||s.type==='productGrid'||s.type==='recommendations')return list.length?<section key={s.id} id={s.id} className={frame(s)}><Reveal animation={s.animation}><div className="hs-row-head">{head(s)}{link(s.ctaHref,s.ctaLabel,'ghost')}</div><div className={s.type==='productGrid'?'hs-product-grid product-grid':'hs-product-row product-grid'}>{list.map(p=><div key={p.id} className="hs-product-slot">{renderProduct(p)}</div>)}</div></Reveal></section>:null;
  if(['collectionBanner','promoBanner','cta'].includes(s.type))return <Banner key={s.id} s={s} link={link} frame={frame(s)} head={head}/>;
  if(s.type==='editorial')return <section key={s.id} id={s.id} className={frame(s)}><Reveal animation={s.animation} className="hs-editorial-grid"><div className="hs-editorial-media"><Media s={s} alt={s.title}/></div><div className="hs-editorial-copy">{head(s)}<div className="hs-actions">{link(s.ctaHref,s.ctaLabel)}</div></div></Reveal></section>;
  if(s.type==='testimonials')return s.items.length?<section key={s.id} id={s.id} className={frame(s)}><Reveal animation={s.animation}>{head(s)}<div className="hs-quotes">{s.items.map((i,n)=><figure key={n}><blockquote>{i.text}</blockquote><figcaption>{i.title}</figcaption></figure>)}</div></Reveal></section>:null;
  if(s.type==='countdown')return <Countdown key={s.id} s={s} link={link} frame={frame(s)} head={head}/>;
  if(s.type==='newsletter')return <Newsletter key={s.id} s={s} frame={frame(s)} head={head}/>;
  return null;
 })}</>;
}

type Shared={s:Section;link:(h:string,l:string,k?:'primary'|'ghost')=>ReactNode;frame:string};
function Hero({s,products,eager,link,frame}:Shared&{eager:boolean;products:Product[]}){const ref=useParallax(s.animation==='parallax');const featured=s.productIds.map(id=>products.find(p=>p.id===id)).find(Boolean);return <section ref={ref} id={s.id} className={frame+' hs-hero-shell'}><div className="hs-hero-media"><Media s={s} eager={eager} alt={s.title}/></div><div className="hs-hero-shade"/><div className="hs-hero-copy">{s.eyebrow&&<span className="hs-eyebrow">{s.eyebrow}</span>}<h1>{s.title}</h1>{s.subtitle&&<p>{s.subtitle}</p>}<div className="hs-actions">{link(s.ctaHref,s.ctaLabel)}{link(s.secondaryHref,s.secondaryLabel,'ghost')}</div></div>{featured&&<a className="hs-hero-featured" href={'/product/'+featured.id}><img src={featured.images[0]} alt=""/><span><small>{featured.badge||'FEATURED PICK'}</small><b>{featured.name}</b><strong>From {new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(featured.price)}</strong></span></a>}<a className="hs-scroll" href="#collection"><span>Scroll</span><ChevronDown size={18}/></a></section>}
function Banner({s,link,frame,head}:Shared&{head:(s:Section)=>ReactNode}){const ref=useParallax(s.animation==='parallax'&&!!s.image);return <section ref={ref} id={s.id} className={frame+(s.image?' hs-has-image':'')}>{s.image&&<div className="hs-banner-media"><Media s={s} alt=""/></div>}{s.image&&<div className="hs-banner-shade"/>}<Reveal animation={s.animation} className="hs-banner-copy">{head(s)}<div className="hs-actions">{link(s.ctaHref,s.ctaLabel)}{link(s.secondaryHref,s.secondaryLabel,'ghost')}</div></Reveal></section>}
function Countdown({s,link,frame,head}:Shared&{head:(s:Section)=>ReactNode}){const end=Date.parse(s.endsAt);const [left,setLeft]=useState(()=>Math.max(0,end-Date.now()));useEffect(()=>{if(!Number.isFinite(end))return;const t=setInterval(()=>setLeft(Math.max(0,end-Date.now())),1000);return()=>clearInterval(t)},[end]);if(!left)return null;const units=[Math.floor(left/86400000),Math.floor(left/3600000)%24,Math.floor(left/60000)%60,Math.floor(left/1000)%60];return <section id={s.id} className={frame}><Reveal animation={s.animation} className="hs-banner-copy">{head(s)}<div className="hs-count" role="timer" aria-label="Time remaining"><div><b>{String(units[0]).padStart(2,'0')}</b><small>days</small></div><div><b>{String(units[1]).padStart(2,'0')}</b><small>hrs</small></div><div><b>{String(units[2]).padStart(2,'0')}</b><small>min</small></div><div><b>{String(units[3]).padStart(2,'0')}</b><small>sec</small></div></div><div className="hs-actions">{link(s.ctaHref,s.ctaLabel)}</div></Reveal></section>}
function Newsletter({s,frame,head}:Pick<Shared,'s'|'frame'>&{head:(s:Section)=>ReactNode}){const [email,setEmail]=useState('');const [consent,setConsent]=useState(false);const [busy,setBusy]=useState(false);return <section id={s.id} className={frame}><Reveal animation={s.animation} className="hs-newsletter"><div>{head(s)}</div><form onSubmit={async e=>{e.preventDefault();if(!consent||!email)return;setBusy(true);try{await api('newsletter',{email,consent});setEmail('');setConsent(false);toast.success('You’re on the list.')}catch(err){toast.error((err as Error).message)}finally{setBusy(false)}}}><div className="hs-email"><Mail size={17}/><input type="email" required maxLength={200} placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)}/></div><label className="hs-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>I agree to receive Trend-Zee collection and launch updates.</span></label><button className="hs-btn hs-btn-primary" disabled={busy||!consent}>{busy?'Joining…':s.ctaLabel||'Join the list'}<ArrowRight size={16}/></button></form></Reveal></section>}
