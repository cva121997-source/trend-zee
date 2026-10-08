'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowDown,ArrowRight,ChevronRight,Headphones,Play,RotateCcw,ShieldCheck,Truck} from 'lucide-react';
import type {CSSProperties,ReactNode} from 'react';
import type {Product} from '@/lib/catalog';
import {money} from '@/lib/catalog';
import type {Section} from '@/lib/home';

type Props={sections:Section[];products:Product[];renderProduct:(product:Product)=>ReactNode;onNavigate:(href:string)=>boolean};
const FALLBACK=['/images/hero.jpg','/images/tee.jpg','/images/shirt.jpg','/images/bag.jpg','/images/sneaker.jpg','/images/sandal.jpg','/images/slide.jpg'];

function SmartImage({src,alt,className='',priority=false}:{src:string;alt:string;className?:string;priority?:boolean}){
  const [failed,setFailed]=useState(false);
  const fallback=FALLBACK[0];
  return <img src={failed?fallback:(src||fallback)} alt={alt} className={className} loading={priority?'eager':'lazy'} fetchPriority={priority?'high':'auto'} onError={()=>setFailed(true)}/>;
}
function Reveal({children,className='',delay=0}:{children:ReactNode;className?:string;delay?:number}){
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const node=ref.current;
    if(!node)return;
    const io=new IntersectionObserver(([entry])=>{if(entry.isIntersecting){node.classList.add('is-inview');io.disconnect();}},{threshold:0.12,rootMargin:'0px 0px -8% 0px'});
    io.observe(node);return()=>io.disconnect();
  },[]);
  return <div ref={ref} className={'story-reveal '+className} style={{'--reveal-delay':String(delay)+'ms'} as CSSProperties}>{children}</div>;
}
function ScrollProgress(){
  const [p,setP]=useState(0);
  useEffect(()=>{
    const update=()=>{const max=document.documentElement.scrollHeight-window.innerHeight;setP(max>0?Math.min(1,window.scrollY/max):0);};
    update();window.addEventListener('scroll',update,{passive:true});window.addEventListener('resize',update);
    return()=>{window.removeEventListener('scroll',update);window.removeEventListener('resize',update);};
  },[]);
  return <div className="story-progress" aria-hidden="true"><span style={{transform:'scaleX('+p+')'}}/></div>;
}
function CTA({label,href,onNavigate,variant='primary'}:{label:string;href:string;onNavigate:(href:string)=>boolean;variant?:'primary'|'light'|'ghost'}){
  if(!label)return null;
  const target=href||'#collection';
  return <a className={'story-cta '+variant} href={target} onClick={e=>{if(onNavigate(target))e.preventDefault();}}><span>{label}</span><ArrowRight size={17}/></a>;
}
export default function HomeSections({sections,products,renderProduct,onNavigate}:Props){
  const sorted=useMemo(()=>[...sections].filter(s=>s.visible).sort((a,b)=>a.order-b.order),[sections]);
  const hero=sorted.find(s=>s.type==='hero')||sorted[0];
  const categorySection=sorted.find(s=>s.type==='categoryShowcase');
  const trustSection=sorted.find(s=>s.type==='trustBar');
  const categoryItems=categorySection?.items||[];
  const trustItems=trustSection?.items||[];
  const fallbackProducts=products.slice(0,4);
  const chapterSections=sorted.filter(s=>s.id!==hero?.id&&s.id!==categorySection?.id&&s.id!==trustSection?.id);
  const imageFor=(section:Section,index:number)=>section.image||FALLBACK[index%FALLBACK.length];

  return <div className="cinematic-home">
    <ScrollProgress/>
    <section className="story-hero" id={hero?.id||'story-hero'}>
      <div className="story-hero-media"><SmartImage src={hero?.image||FALLBACK[0]} alt="TREND ZEE collection" priority/><div className="story-hero-shade"/></div>
      <div className="story-hero-grid">
        <div className="story-side-note">TREND ZEE / 2026 EDIT<br/>EVERYDAY, RECONSIDERED</div>
        <div className="story-hero-copy"><Reveal><span className="story-kicker">{hero?.eyebrow||'NEW CHAPTER · EVERYDAY EDIT'}</span><h1>{hero?.title||'Wear your next chapter.'}</h1><p>{hero?.subtitle||'Clothing, bags and footwear designed around the way your days actually move.'}</p><div className="story-cta-row"><CTA label={hero?.ctaLabel||'Explore the collection'} href={hero?.ctaHref||'#collection'} onNavigate={onNavigate} variant="light"/>{hero?.secondaryLabel&&<CTA label={hero.secondaryLabel} href={hero.secondaryHref||'#collection'} onNavigate={onNavigate} variant="ghost" />}</div></Reveal></div>
        <a className="story-scroll-cue" href="#story-intro"><span>SCROLL TO EXPLORE</span><ArrowDown size={17}/></a>
      </div>
      <div className="story-hero-type">CHAPTER 01<br/><b>BEGIN HERE</b></div>
    </section>

    <section className="story-intro" id="story-intro"><div className="story-intro-number">01</div><Reveal className="story-intro-copy"><span className="story-kicker">NOT JUST AN ONLINE CATALOGUE</span><h2>A store that unfolds as you move through it.</h2><p>Start with the visual story, slow down for the details, jump into the collection when something catches your eye, and come back to your bag without losing the thread.</p></Reveal><div className="story-intro-stat"><strong>{products.length}</strong><span>CURATED PIECES<br/>IN THE CURRENT EDIT</span></div></section>

    {trustItems.length>0&&<section className="story-trust" id="story-trust"><div className="story-trust-head"><span className="story-kicker">THE EXPERIENCE</span><h2>Every part of the journey should feel clear.</h2></div><div className="story-trust-grid">{trustItems.slice(0,4).map((item,i)=>{const icons=[ShieldCheck,Truck,RotateCcw,Headphones];const Icon=icons[i%icons.length];return <Reveal key={i} delay={i*80}><article className="story-trust-card"><span className="story-card-index">0{i+2}</span><Icon size={25}/><h3>{item.title||['Clear order status','Delivery visibility','Easy returns','Real support'][i]}</h3><p>{item.text}</p></article></Reveal>;})}</div></section>}

    {categoryItems.length>0&&<section className="story-categories" id="story-categories"><div className="story-section-top"><div><span className="story-kicker">02 / FIND YOUR DIRECTION</span><h2>One wardrobe.<br/><i>Many versions of you.</i></h2></div><p>Choose the mood before you choose the product.</p></div><div className="story-category-grid">{categoryItems.slice(0,4).map((item,i)=><Reveal key={i} className={'story-category-card card-'+i} delay={i*70}><a href={item.href||'#collection'} onClick={e=>{if(item.href&&onNavigate(item.href))e.preventDefault();}}><SmartImage src={item.image||FALLBACK[(i+1)%FALLBACK.length]} alt={item.title}/><div className="story-category-overlay"><span>0{i+1}</span><h3>{item.title}</h3><p>{item.text||'Explore the edit'}</p><ChevronRight size={17}/></div></a></Reveal>)}</div></section>}

    {chapterSections.map((s,index)=>{
      const n=String(index+3).padStart(2,'0');
      if(s.type==='productRow'||s.type==='productGrid'||s.type==='recommendations'){
        const byIds=s.productIds.map(id=>products.find(p=>p.id===id)).filter(Boolean) as Product[];
        const picks=(byIds.length?byIds:fallbackProducts).slice(0,4);
        return <section className="story-products" id={s.id} key={s.id}><div className="story-section-top"><div><span className="story-kicker">{n+' / '+(s.eyebrow||'THE EDIT')}</span><h2>{s.title}</h2><p>{s.subtitle}</p></div>{s.ctaLabel&&<CTA label={s.ctaLabel} href={s.ctaHref||'#collection'} onNavigate={onNavigate}/>}</div><div className="story-products-layout"><div className="story-products-index"><strong>{n}</strong><span>CURATED<br/>NOW</span></div><div className="story-products-grid">{picks.map(p=><Reveal key={p.id}>{renderProduct(p)}</Reveal>)}</div></div></section>;
      }
      if(s.type==='fullImage'||s.type==='collectionBanner'||s.type==='promoBanner'){
        return <section className={'story-feature story-theme-'+s.theme} id={s.id} key={s.id}><div className="story-feature-image"><SmartImage src={imageFor(s,index+2)} alt={s.title||'TREND ZEE editorial'}/></div><div className="story-feature-content"><span className="story-kicker">{n+' / '+(s.eyebrow||'THE STORY')}</span><h2>{s.title}</h2><p>{s.subtitle}</p><CTA label={s.ctaLabel||'Explore'} href={s.ctaHref||'#collection'} onNavigate={onNavigate} variant={s.theme==='dark'?'light':'primary'}/></div></section>;
      }
      if(s.type==='editorial'){
        return <section className="story-editorial" id={s.id} key={s.id}><div className="story-editorial-copy"><span className="story-kicker">{n+' / '+(s.eyebrow||'EDITORIAL')}</span><h2>{s.title}</h2><p>{s.subtitle}</p><CTA label={s.ctaLabel||'Shop the story'} href={s.ctaHref||'#collection'} onNavigate={onNavigate}/></div><div className="story-editorial-image"><SmartImage src={imageFor(s,index+3)} alt={s.title}/><span>THE IMAGE / {String(index+1).padStart(2,'0')}</span></div></section>;
      }
      if(s.type==='video'){
        return <section className="story-video" id={s.id} key={s.id}><div className="story-video-frame"><SmartImage src={imageFor(s,index+4)} alt={s.title}/><span className="story-video-badge"><Play size={15} fill="currentColor"/> CAMPAIGN FILM</span></div><div className="story-video-copy"><span className="story-kicker">{n} / MOVING IMAGE</span><h2>{s.title}</h2><p>{s.subtitle}</p></div></section>;
      }
      if(s.type==='testimonials'){
        const items=s.items.length?s.items:[{title:'A customer story',text:'Real customer feedback will appear here once published.'}];
        return <section className="story-quotes" id={s.id} key={s.id}><span className="story-kicker">{n} / WORD OF MOUTH</span><h2>What stays after the scroll.</h2><div className="story-quote-grid">{items.slice(0,3).map((it,i)=><Reveal key={i}><blockquote><div>★★★★★</div><p>“{it.text}”</p><cite>{it.title}</cite></blockquote></Reveal>)}</div></section>;
      }
      if(s.type==='newsletter'){
        return <section className="story-newsletter" id="newsletter" key={s.id}><div><span className="story-kicker">{n} / STAY CLOSE</span><h2>{s.title}</h2><p>{s.subtitle}</p></div><form className="story-newsletter-form" onSubmit={e=>e.preventDefault()}><input aria-label="Email address" type="email" placeholder="Your email address" required/><button type="submit">{s.ctaLabel||'Join the list'}<ArrowRight size={16}/></button><small>Updates only. Unsubscribe anytime.</small></form></section>;
      }
      if(s.type==='cta'){
        return <section className="story-closing" id={s.id} key={s.id}><div><span className="story-kicker">{n} / THE LAST WORD</span><h2>{s.title}</h2><p>{s.subtitle}</p><CTA label={s.ctaLabel||'Start exploring'} href={s.ctaHref||'#collection'} onNavigate={onNavigate} variant="light"/></div><div className="story-closing-mark">TZ</div></section>;
      }
      return null;
    })}
    <section className="story-final-strip"><div><span className="story-kicker">CONTINUE THE STORY</span><h2>There is more to discover.</h2><p>Scroll back, open the collection, save what feels right.</p></div><div className="story-final-count"><span>{products.length}</span><small>PIECES<br/>IN EDIT</small></div></section>
  </div>;
}
