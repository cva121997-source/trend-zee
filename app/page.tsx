'use client';

import {useEffect,useMemo,useState} from 'react';
import {
  Check,ChevronRight,Clock3,Heart,Headphones,MapPin,Menu,Minus,Package,Plus,
  RotateCcw,Search,Share2,ShieldCheck,ShoppingBag,SlidersHorizontal,Star,Truck,UserRound,X,LockKeyhole
} from 'lucide-react';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
import {Checkbox} from '@/components/ui/checkbox';
import {Tabs,TabsContent,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {Toaster,toast} from 'sonner';
import {Product,money} from '@/lib/catalog';
import {api} from '@/lib/client';

type Item={productId:string;quantity:number;size:string;color:string;name?:string;price?:number;image?:string};
type StoreSettings={announcement:string;supportEmail:string;supportPhone:string;supportHours:string;returnsWindowDays:number;shippingNote:string;taxNote:string;storeStatus:string};
const blankProfile={name:'',email:'',mobile:'',address:'',city:'',pincode:'',location:''};
const blankSettings:StoreSettings={announcement:'Thoughtful essentials for every chapter.',supportEmail:'',supportPhone:'',supportHours:'Mon–Sat · 10:00–18:00',returnsWindowDays:7,shippingNote:'Delivery availability, charges and ETA are confirmed before a paid order is accepted.',taxNote:'Applicable taxes will be shown once tax rules are configured.',storeStatus:'Preview'};

const editorialImages={hero:'https://images.unsplash.com/photo-1560847581-19fd6f636822?auto=format&fit=crop&fm=jpg&q=82&w=1800',lifestyle:'https://images.unsplash.com/photo-1657659634222-3beae4bda5cf?auto=format&fit=crop&fm=jpg&q=82&w=1400',footwear:'https://images.unsplash.com/photo-1594829444710-9e6a9001eeed?fm=jpg&q=82&w=1400'};
const primaryImage=(product:Product)=>{const source=product.images?.find((src)=>src&&!src.startsWith('/images/'));if(source)return source;if(product.category==='Bags')return editorialImages.lifestyle;if(product.category==='Shoes & Sandals'||product.category==='Slippers')return editorialImages.footwear;return editorialImages.hero;};

export default function Store(){
  const [products,setProducts]=useState<Product[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [user,setUser]=useState<any>(null);
  const [profile,setProfile]=useState<any>(blankProfile);
  const [orders,setOrders]=useState<any[]>([]);
  const [tickets,setTickets]=useState<any[]>([]);
  const [customerReturns,setCustomerReturns]=useState<any[]>([]);
  const [reviews,setReviews]=useState<any[]>([]);
  const [settings,setSettings]=useState<StoreSettings>(blankSettings);
  const [cart,setCart]=useState<{items:Item[];saved:string[]}>({items:[],saved:[]});
  const [category,setCategory]=useState('All');
  const [query,setQuery]=useState('');
  const [sort,setSort]=useState('Featured');
  const [priceBand,setPriceBand]=useState('All prices');
  const [inStockOnly,setInStockOnly]=useState(true);
  const [detail,setDetail]=useState<Product|null>(null);
  const [size,setSize]=useState('');
  const [color,setColor]=useState('');
  const [photo,setPhoto]=useState(0);
  const [panel,setPanel]=useState('');
  const [busy,setBusy]=useState(false);
  const [consent,setConsent]=useState(false);
  const [stage,setStage]=useState(1);
  const [method,setMethod]=useState('UPI');
  const [orderId,setOrderId]=useState('');
  const [rating,setRating]=useState(5);
  const [message,setMessage]=useState('');
  const [mobile,setMobile]=useState('');
  const [mobileConsent,setMobileConsent]=useState(false);
  const [afterMobile,setAfterMobile]=useState('account');
  const [couponCode,setCouponCode]=useState('');
  const [appliedCoupon,setAppliedCoupon]=useState({code:'',discount:0});
  const [note,setNote]=useState('');
  const [recentIds,setRecentIds]=useState<string[]>([]);
  const [filtersOpen,setFiltersOpen]=useState(false);
  const [supportForm,setSupportForm]=useState({category:'Order help',subject:'',message:''});
  const [returnReason,setReturnReason]=useState('');
  const [returnOrder,setReturnOrder]=useState<any>(null);
  const [reviewTarget,setReviewTarget]=useState<any>(null);
  const [reviewForm,setReviewForm]=useState({rating:5,title:'',message:''});

  async function load(){
    try{
      setError('');
      const response=await fetch('/api/store');
      const data:any=await response.json();
      if(!response.ok)throw new Error(data.error);
      setProducts(data.products||[]);
      setUser(data.user||null);
      setProfile(data.profile||blankProfile);
      setOrders(data.orders||[]);
      setTickets(data.support||[]);
      setCustomerReturns(data.returns||[]);
      setReviews(data.reviews||[]);
      setSettings({...blankSettings,...(data.settings||{})});
      setCart(data.cart||{items:[],saved:[]});
    }catch(e){setError((e as Error).message);}finally{setLoading(false);}
  }

  useEffect(()=>{
    load();
    try{setRecentIds(JSON.parse(localStorage.getItem('tz_recent')||'[]'));}catch{}
  },[]);

  async function run(fn:()=>Promise<unknown>){
    setBusy(true);
    try{await fn();}catch(e){toast.error((e as Error).message);}finally{setBusy(false);}
  }

  async function updateCart(items:Item[],saved=cart.saved){
    const data=await api('cart',{items,saved});
    setCart(data.cart);
    setAppliedCoupon({code:'',discount:0});
  }

  function remember(id:string){
    const next=[id,...recentIds.filter(x=>x!==id)].slice(0,8);
    setRecentIds(next);
    try{localStorage.setItem('tz_recent',JSON.stringify(next));}catch{}
  }

  function show(product:Product){
    setDetail(product);setSize(product.sizes[0]);setColor(product.colors[0]);setPhoto(0);remember(product.id);
  }

  async function add(){
    if(!detail||detail.stock<=0)return;
    const found=cart.items.findIndex(i=>i.productId===detail.id&&i.size===size&&i.color===color);
    const items=cart.items.map(i=>({...i}));
    if(found<0)items.push({productId:detail.id,quantity:1,size,color});
    else if(items[found].quantity<detail.stock&&items[found].quantity<10)items[found].quantity++;
    else return toast.error('You have reached the available quantity for this item.');
    await updateCart(items);
    toast.success('Added to your bag');
    setDetail(null);setPanel('bag');
  }

  async function saveItem(id:string){
    await updateCart(cart.items,cart.saved.includes(id)?cart.saved.filter(x=>x!==id):[...cart.saved,id]);
  }

  function requireCustomer(nextPanel:string){
    if(user){setPanel(nextPanel);return;}
    setAfterMobile(nextPanel);setPanel('mobile');
  }

  function browse(cat:string){
    setCategory(cat);setPanel('');document.getElementById('collection')?.scrollIntoView({behavior:'smooth'});
  }

  const count=cart.items.reduce((sum,item)=>sum+item.quantity,0);
  const total=cart.items.reduce((sum,item)=>sum+(products.find(p=>p.id===item.productId)?.price||item.price||0)*item.quantity,0);
  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    let rows=products.filter(p=>{
      if(category!=='All'&&p.category!==category)return false;
      if(inStockOnly&&p.stock<=0)return false;
      if(priceBand==='Under ₹1,000'&&p.price>=1000)return false;
      if(priceBand==='₹1,000–₹2,000'&&(p.price<1000||p.price>2000))return false;
      if(priceBand==='Above ₹2,000'&&p.price<=2000)return false;
      if(q&&!`${p.name} ${p.type} ${p.brand} ${p.category} ${p.description}`.toLowerCase().includes(q))return false;
      return true;
    });
    if(sort==='Price: low to high')rows=[...rows].sort((a,b)=>a.price-b.price);
    if(sort==='Price: high to low')rows=[...rows].sort((a,b)=>b.price-a.price);
    if(sort==='Name: A–Z')rows=[...rows].sort((a,b)=>a.name.localeCompare(b.name));
    return rows;
  },[products,category,query,sort,priceBand,inStockOnly]);

  const availableCategories=useMemo(()=>['All',...Array.from(new Set(products.map(p=>p.category).filter(Boolean))).sort()], [products]);

  const recent=recentIds.map(id=>products.find(p=>p.id===id)).filter(Boolean) as Product[];
  const detailReviews=detail?reviews.filter(r=>r.productId===detail.id):[];
  const detailRating=detailReviews.length?detailReviews.reduce((s,r)=>s+Number(r.rating||0),0)/detailReviews.length:0;

  function profileForm(){
    return <div className="form-grid">
      {([['name','Full name'],['email','Email address'],['mobile','Mobile number'],['address','Street address'],['city','City'],['pincode','PIN code']] as const).map(([key,label])=><label key={key} className={key==='address'?'wide':''}>{label}<input required type={key==='email'?'email':key==='mobile'?'tel':'text'} autoComplete={key==='name'?'name':key==='email'?'email':key==='mobile'?'tel':key==='address'?'street-address':key==='city'?'address-level2':'postal-code'} maxLength={key==='pincode'?6:200} value={profile[key]||''} onChange={e=>setProfile({...profile,[key]:e.target.value})}/></label>)}
      <div className="wide"><button type="button" className="text-button" onClick={()=>{
        if(!navigator.geolocation)return toast.error('Location is not supported. Enter your address manually.');
        navigator.geolocation.getCurrentPosition(pos=>{setProfile({...profile,location:pos.coords.latitude.toFixed(5)+', '+pos.coords.longitude.toFixed(5)});toast.success('Location attached. Please enter your delivery address too.');},()=>toast.error('Location unavailable. You can enter your address manually.'),{timeout:10000});
      }}><MapPin size={16}/> Use my location</button>{profile.location&&<p className="muted small">Location attached: {profile.location}</p>}</div>
    </div>;
  }

  function productCard(p:Product){
    const productReviews=reviews.filter(r=>r.productId===p.id);
    const average=productReviews.length?productReviews.reduce((s,r)=>s+Number(r.rating||0),0)/productReviews.length:0;
    return <article className="product" key={p.id}>
      <div className="product-image">
        <button className="image-button" onClick={()=>show(p)} aria-label={'View '+p.name}><img src={primaryImage(p)} alt={p.name} loading="lazy"/></button>
        <span className="product-tag">{p.stock<=0?'SOLD OUT':p.tag||p.category}</span>
        <button className={'save-button '+(cart.saved.includes(p.id)?'saved':'')} onClick={()=>run(()=>saveItem(p.id))} aria-label={(cart.saved.includes(p.id)?'Remove from saved ':'Save ')+p.name} disabled={busy}><Heart size={18} fill={cart.saved.includes(p.id)?'currentColor':'none'}/></button>
        <button className="quick-add" onClick={()=>show(p)}><span>{p.stock>0?'Choose options':'View details'}</span><Plus size={16}/></button>
      </div>
      <div className="product-meta"><button onClick={()=>show(p)}>{p.name}</button><span>{money(p.price)}</span></div>
      <div className="product-submeta"><span>{p.brand} · {p.type}</span>{average>0&&<span><Star size={12} fill="currentColor"/> {average.toFixed(1)} ({productReviews.length})</span>}</div>
      <div className="stock-line">{p.stock<=0?'Out of stock':p.stock<=5?`Only ${p.stock} left`:'In stock'}</div>
    </article>;
  }

  if(loading)return <div className="store-loading"><span className="logo">TREND ZEE<sup>®</sup></span><p>Preparing the collection…</p></div>;

  return <>
    <Toaster richColors position="top-center"/>
    <div className="announcement">{settings.storeStatus==='Maintenance'?'Store maintenance mode · Browsing remains available':settings.announcement}</div>
    <header className="store-header">
      <button className="logo" onClick={()=>window.scrollTo({top:0,behavior:'smooth'})}>TREND ZEE<sup>®</sup></button>
      <nav className="desktop-nav"><button onClick={()=>browse('All')}>Shop</button><button onClick={()=>browse('Clothing')}>Clothing</button><button onClick={()=>browse('Bags')}>Bags</button><button onClick={()=>setPanel('support')}>Help</button><a className="admin-entry" href="/admin"><LockKeyhole size={14}/> Admin</a></nav>
      <div className="header-actions">
        <button aria-label="Search products" onClick={()=>document.getElementById('catalog-search')?.focus()}><Search size={19}/></button>
        <button aria-label="Saved items" onClick={()=>setPanel('saved')}><Heart size={19}/><span>{cart.saved.length||''}</span></button>
        <button aria-label="Account" onClick={()=>requireCustomer('account')}><UserRound size={19}/></button>
        <button aria-label="Shopping bag" onClick={()=>setPanel('bag')}><ShoppingBag size={19}/><span>{count||''}</span></button>
        <button className="mobile-menu" aria-label="Menu" onClick={()=>setFiltersOpen(v=>!v)}><Menu size={20}/></button>
      </div>
    </header>

    {error&&<div className="store-error"><b>We could not refresh the store.</b><span>{error}</span><button onClick={()=>load()}>Try again</button></div>}

    <main>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><i className="tiny-rule"/>NEW CHAPTER · EVERYDAY EDIT</span>
          <h1>Wear your<br/><em>next chapter.</em></h1>
          <p>Clothing, bags and footwear chosen for the different versions of your day. Browse freely, save favourites, and build your bag before sharing any contact details.</p>
          <button className="button" onClick={()=>browse('All')}>Explore the collection <ChevronRight size={16}/></button>
          <div className="hero-foot">DESIGNED FOR THE DAYS THAT KEEP MOVING</div>
        </div>
        <div className="hero-image"><img src={editorialImages.hero} alt="Model wearing a relaxed everyday look"/><div className="hero-sticker">MADE FOR<br/><i>what’s next</i></div><div className="hero-side-note"><span>THE EVERYDAY EDIT</span><b>One good piece.<br/>A hundred good days.</b><button onClick={()=>browse('All')}>Meet the collection <ArrowRight size={14}/></button></div><span className="image-caption">TREND ZEE · EVERYDAY STORIES</span></div>
      </section>

      <div className="ticker"><span>SHOP YOUR WAY</span><span className="star">✦</span><span>SAVE YOUR FAVOURITES</span><span className="star">✦</span><span>TRACK EVERY ORDER</span><span className="star">✦</span><span>SUPPORT WHEN YOU NEED IT</span></div>

      <section className="commerce-promises">
        <div><ShieldCheck/><span><b>Clear order status</b><small>Paid revenue is never confused with unpaid requests.</small></span></div>
        <div><Truck/><span><b>Delivery visibility</b><small>Courier and tracking appear when fulfilment is connected.</small></span></div>
        <div><RotateCcw/><span><b>Return-ready account</b><small>{settings.returnsWindowDays}-day return workflow for eligible delivered paid orders.</small></span></div>
        <div><Headphones/><span><b>Built-in support</b><small>{settings.supportHours||'Support hours available in your account.'}</small></span></div>
      </section>

      <section className="collection" id="collection">
        <div className="section-heading"><div><span className="eyebrow">THE COLLECTION</span><h2>Find your everyday favourites.</h2></div><span>{filtered.length} of {products.length} pieces</span></div>
        <div className="filters">
          <div className="category-list">{availableCategories.map(c=><button key={c} className={category===c?'active':''} onClick={()=>setCategory(c)}>{c}</button>)}</div>
          <div className="search-sort">
            <label className="search-field"><Search size={17}/><input id="catalog-search" placeholder="Search products, brand, category…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
            <button className="filter-toggle" onClick={()=>setFiltersOpen(v=>!v)}><SlidersHorizontal size={16}/> Filters</button>
            <select aria-label="Sort products" value={sort} onChange={e=>setSort(e.target.value)}><option>Featured</option><option>Price: low to high</option><option>Price: high to low</option><option>Name: A–Z</option></select>
          </div>
          {filtersOpen&&<div className="advanced-filters"><label>Price<select value={priceBand} onChange={e=>setPriceBand(e.target.value)}><option>All prices</option><option>Under ₹1,000</option><option>₹1,000–₹2,000</option><option>Above ₹2,000</option></select></label><label className="check-line"><Checkbox checked={inStockOnly} onCheckedChange={v=>setInStockOnly(v===true)}/><span>Show in-stock products only</span></label><button className="text-button" onClick={()=>{setPriceBand('All prices');setInStockOnly(true);setQuery('');setCategory('All');}}>Reset filters</button></div>}
        </div>
        {filtered.length?<div className="product-grid">{filtered.map(productCard)}</div>:<div className="empty collection-empty"><Search size={32}/><h3>No pieces match those filters.</h3><p>Try another category, price range, or search.</p><button className="button" onClick={()=>{setPriceBand('All prices');setInStockOnly(false);setQuery('');setCategory('All');}}>Show everything</button></div>}
        <p className="catalog-note">Catalogue availability is live from current stock. Payment, tax and shipping-provider connections are still required before final paid checkout can launch.</p>
      </section>

      {recent.length>0&&<section className="recent-section"><div className="section-heading"><div><span className="eyebrow">RECENTLY VIEWED</span><h2>Pick up where you left off.</h2></div><button className="text-button" onClick={()=>{setRecentIds([]);localStorage.removeItem('tz_recent');}}>Clear history</button></div><div className="recent-row">{recent.map(p=><button key={p.id} onClick={()=>show(p)}><img src={primaryImage(p)} alt={p.name}/><span><b>{p.name}</b><small>{money(p.price)}</small></span></button>)}</div></section>}

      <section className="story" id="story"><div className="story-copy"><span className="eyebrow">WHY WE STARTED</span><h2>Style should help you feel more like <em>yourself.</em></h2></div><div><p>We built TREND ZEE for the moment before the order: the moment you imagine where you'll wear it, how it will feel, and whether you'll still want it next month.</p><p>So the experience starts with the story, not the sale. Browse freely. See the pieces in context. Save what feels right. Then make the call.</p><div className="story-actions"><button className="button light" onClick={()=>browse('All')}>Find your piece <ChevronRight size={16}/></button><button className="text-button light-text" onClick={()=>setPanel('support')}>Talk to us</button></div></div></section><section className="conversion-callout"><div><span className="eyebrow">READY WHEN YOU ARE</span><h2>One piece can change the way the day feels.</h2><p>Start with the thing you would reach for tomorrow morning.</p></div><button className="button" onClick={()=>browse('All')}>Shop the collection <ArrowRight size={16}/></button></section>
    </main>

    <Dialog open={!!detail} onOpenChange={v=>!v&&setDetail(null)}><DialogContent className="panel-dialog product-dialog"><DialogTitle>{detail?.name||'Product details'}</DialogTitle><DialogDescription>{detail?.brand} · {detail?.category}</DialogDescription>{detail&&<div className="product-detail-layout">
      <div className="gallery"><div className="gallery-main"><img src={primaryImage(detail)} alt={detail.name}/>{detail.stock<=5&&<span className={`gallery-stock ${detail.stock<=0?'out':''}`}>{detail.stock<=0?'Out of stock':`Only ${detail.stock} left`}</span>}</div>{detail.images.length>1&&<div className="gallery-thumbs">{detail.images.map((src,i)=><button className={photo===i?'active':''} key={src+i} onClick={()=>setPhoto(i)}><img src={src} alt={`${detail.name} view ${i+1}`}/></button>)}</div>}</div>
      <div className="product-detail-copy"><div className="split"><span className="eyebrow">{detail.tag||detail.category}</span><button className="share-button" onClick={async()=>{const share={title:detail.name,text:`${detail.name} · ${money(detail.price)}`,url:location.href};try{if(navigator.share)await navigator.share(share);else{await navigator.clipboard.writeText(location.href);toast.success('Link copied');}}catch{}}}><Share2 size={16}/> Share</button></div><h2>{detail.name}</h2><div className="detail-price">{money(detail.price)}</div>{detailRating>0?<div className="rating-summary"><Star size={15} fill="currentColor"/> <b>{detailRating.toFixed(1)}</b><span>{detailReviews.length} published review{detailReviews.length===1?'':'s'}</span></div>:<p className="small muted">No published reviews yet.</p>}<p>{detail.description}</p>
        <div className="choice-grid"><label>Size<select value={size} onChange={e=>setSize(e.target.value)}>{detail.sizes.map(x=><option key={x}>{x}</option>)}</select></label><label>Colour<select value={color} onChange={e=>setColor(e.target.value)}>{detail.colors.map(x=><option key={x}>{x}</option>)}</select></label></div>
        <div className="detail-actions"><button className="button full" disabled={busy||detail.stock<=0} onClick={()=>run(add)}>{detail.stock<=0?'Out of stock':'Add to bag'}</button><button className={`save-wide ${cart.saved.includes(detail.id)?'saved':''}`} disabled={busy} onClick={()=>{void run(async()=>{await saveItem(detail.id);})}}><Heart size={17} fill={cart.saved.includes(detail.id)?'currentColor':'none'}/>{cart.saved.includes(detail.id)?'Saved':'Save for later'}</button></div>
        <div className="product-facts"><div><Package/><span><b>Availability</b><small>{detail.stock>0?`${detail.stock} units currently available`:'Currently unavailable'}</small></span></div><div><Truck/><span><b>Delivery</b><small>{settings.shippingNote}</small></span></div><div><RotateCcw/><span><b>Returns</b><small>Eligible delivered paid orders can request a return within {settings.returnsWindowDays} days.</small></span></div></div>
        <details><summary>Specifications & care</summary><p>{detail.specifications}</p></details>
        {detailReviews.length>0&&<div className="review-list"><h3>Customer reviews</h3>{detailReviews.slice(0,4).map((r:any,i:number)=><article key={i}><div className="split"><b>{r.title||'Customer review'}</b><span>{'★'.repeat(r.rating)}</span></div><p>{r.message}</p><small>{r.name||'Customer'}</small></article>)}</div>}
      </div>
    </div>}</DialogContent></Dialog>

    <Dialog open={!!panel} onOpenChange={v=>{if(!v){setPanel('');setReturnOrder(null);setReviewTarget(null);}}}><DialogContent className="panel-dialog"><DialogTitle>{panel==='bag'?'Your bag':panel==='saved'?'Saved for later':panel==='account'?'Your account':panel==='checkout'?'Checkout':panel==='success'?'Order request saved':panel==='mobile'?'Continue shopping':panel==='support'?'Customer support':panel==='feedback'?'Share feedback':panel==='returns'?'Request a return':panel==='review'?'Write a review':panel==='terms'?'Store terms':panel==='privacy'?'Privacy notice':'TREND ZEE'}</DialogTitle><DialogDescription>{panel==='checkout'?'Review delivery details and payment preference.':panel==='support'?'Create a support ticket and track it from your account.':panel==='bag'?'Review quantities before checkout.':'Your TREND ZEE shopping space.'}</DialogDescription>

      {panel==='bag'&&<>{cart.items.length?<><div className="cart-list">{cart.items.map((i,index)=>{const p=products.find(x=>x.id===i.productId);const max=Math.min(10,p?.stock||10);return <div className="cart-item" key={`${i.productId}-${i.size}-${i.color}-${index}`}><img src={p?.images[0]||i.image} alt={p?.name||i.name}/><div><b>{p?.name||i.name}</b><span>{i.color} · {i.size}</span><div className="quantity"><button aria-label="Decrease quantity" disabled={busy} onClick={()=>run(()=>updateCart(i.quantity===1?cart.items.filter((_,j)=>j!==index):cart.items.map((x,j)=>j===index?{...x,quantity:x.quantity-1}:x)))}><Minus size={14}/></button><span>{i.quantity}</span><button aria-label="Increase quantity" disabled={busy||i.quantity>=max} onClick={()=>run(()=>updateCart(cart.items.map((x,j)=>j===index?{...x,quantity:x.quantity+1}:x)))}><Plus size={14}/></button><button aria-label="Remove item" disabled={busy} onClick={()=>run(()=>updateCart(cart.items.filter((_,j)=>j!==index)))}><X size={14}/></button></div></div><b>{money((p?.price||i.price||0)*i.quantity)}</b></div>})}</div><div className="total"><span>Subtotal</span><b>{money(total)}</b></div><p className="small muted">{settings.shippingNote} {settings.taxNote}</p><button className="button full" onClick={()=>{setStage(1);setConsent(false);requireCustomer('checkout');}}>Continue to checkout</button></>:<div className="empty"><ShoppingBag size={36}/><h3>Your bag is ready for a favourite.</h3><p>Explore the collection and add anything that feels like your next chapter.</p><button className="button" onClick={()=>browse('All')}>Explore the collection</button></div>}</>}

      {panel==='saved'&&<>{products.filter(p=>cart.saved.includes(p.id)).length?<div className="saved-grid">{products.filter(p=>cart.saved.includes(p.id)).map(p=><button className="saved-item" key={p.id} onClick={()=>{setPanel('');show(p);}}><img src={primaryImage(p)} alt={p.name}/><b>{p.name}</b><span>{money(p.price)}</span><small>{p.stock>0?'In stock':'Out of stock'}</small></button>)}</div>:<div className="empty"><Heart size={36}/><h3>Save inspiration for later.</h3><p>Tap the heart on a product to keep it here.</p></div>}</>}

      {panel==='mobile'&&<form onSubmit={e=>{e.preventDefault();run(async()=>{await api('mobile',{mobile,consent:mobileConsent});await load();setPanel(afterMobile);});}}><p>You can browse freely. A mobile number is only needed when you want to use account, checkout, support or order features.</p><label>Mobile number<input type="tel" inputMode="tel" autoComplete="tel" required maxLength={13} placeholder="Your mobile number" value={mobile} onChange={e=>setMobile(e.target.value.replace(/[^0-9+]/g,''))}/></label><label className="check-line"><Checkbox checked={mobileConsent} onCheckedChange={v=>setMobileConsent(v===true)}/><span>I agree to save my number and shopping activity so TREND ZEE can support my account and unfinished checkout.</span></label><p className="small muted">This is a guest shopping session; the number is not OTP verified.</p><button className="button full" disabled={busy||!mobileConsent}>{busy?'Continuing…':'Continue'}</button></form>}

      {panel==='account'&&user&&<Tabs defaultValue="orders"><TabsList className="account-tabs"><TabsTrigger value="orders">Orders ({orders.length})</TabsTrigger><TabsTrigger value="profile">Profile</TabsTrigger><TabsTrigger value="support">Support ({tickets.length})</TabsTrigger><TabsTrigger value="returns">Returns ({customerReturns.length})</TabsTrigger></TabsList>
        <TabsContent value="orders">{orders.length?orders.map(o=><div className="order-card richer-order" key={o.id}><div className="split"><div><b>{o.id}</b><small>{new Date(o.created).toLocaleString('en-IN')}</small></div><span className="badge">{o.status}</span></div><div className="order-mini-items">{o.items.map((i:any)=><span key={i.productId+i.size+i.color}>{i.name} × {i.quantity}</span>)}</div><div className="split"><span>{money(o.total)} · {o.paymentStatus}</span><span>{o.method}</span></div><div className="order-timeline"><span className="done">Requested</span><span className={o.paymentStatus==='Paid'?'done':''}>Paid</span><span className={['Processing','Dispatched','Delivered'].includes(o.status)?'done':''}>Processing</span><span className={['Dispatched','Delivered'].includes(o.status)?'done':''}>Dispatched</span><span className={o.status==='Delivered'?'done':''}>Delivered</span></div><p className="small muted">{o.courier?`${o.courier} · ${o.tracking||'Tracking pending'}`:'Dispatch details will appear after verified payment and shipment.'}</p><div className="order-actions">{o.paymentStatus!=='Paid'&&o.status==='Awaiting payment'&&<button className="text-button danger-text" disabled={busy} onClick={()=>run(async()=>{await api('cancelOrder',{id:o.id,reason:'Cancelled from customer account'});await load();toast.success('Order request cancelled');})}>Cancel request</button>}{o.paymentStatus==='Paid'&&o.status==='Delivered'&&<button className="text-button" onClick={()=>{setReturnOrder(o);setReturnReason('');setPanel('returns');}}>Request return</button>}<button className="text-button" onClick={()=>{setSupportForm({category:'Order help',subject:`Help with ${o.id}`,message:''});setPanel('support');}}>Get help</button></div>{o.paymentStatus==='Paid'&&o.status==='Delivered'&&<div className="review-order-items"><small>Review delivered items</small>{o.items.map((item:any)=><button key={item.productId+item.size+item.color} className="text-button" onClick={()=>{setReviewTarget({order:o,product:item});setReviewForm({rating:5,title:'',message:''});setPanel('review');}}>★ {item.name}</button>)}</div>}</div>):<div className="empty"><Package size={30}/><h3>No orders yet.</h3><p>Your order history and fulfilment updates will appear here.</p></div>}</TabsContent>
        <TabsContent value="profile"><form onSubmit={e=>{e.preventDefault();run(async()=>{await api('profile',{profile});toast.success('Your details are saved');await load();});}}>{profileForm()}<button className="button" disabled={busy}>Save my details</button></form><p className="small muted">{user.guest?'Guest shopping session · Mobile not OTP verified':'Signed in as '+user.email}</p>{!user.guest&&<a className="text-button" href="/signout-with-chatgpt?return_to=/" target="_top">Sign out</a>}</TabsContent>
        <TabsContent value="support">{tickets.length?tickets.map(t=><div className="support-ticket" key={t.id}><div className="split"><b>{t.id}</b><span className="badge">{t.status}</span></div><h3>{t.subject}</h3><p>{t.message}</p><small>{t.category} · {new Date(t.created).toLocaleString('en-IN')}</small></div>):<div className="empty"><Headphones size={30}/><p>No support tickets yet.</p></div>}<button className="button" onClick={()=>setPanel('support')}>Create support ticket</button></TabsContent>
        <TabsContent value="returns">{customerReturns.length?customerReturns.map(r=><div className="support-ticket" key={r.id}><div className="split"><b>{r.id}</b><span className="badge">{r.status}</span></div><p><b>Order {r.orderId}</b></p><p>{r.reason}</p><small>{money(r.refundAmount||r.total||0)} expected value · {new Date(r.created).toLocaleString('en-IN')}</small></div>):<div className="empty"><RotateCcw size={30}/><p>No return requests yet.</p></div>}</TabsContent>
      </Tabs>}

      {panel==='checkout'&&user&&<><div className="checkout-steps"><span className={stage===1?'current':''}>01 Delivery</span><span className={stage===2?'current':''}>02 Payment preference</span></div>{stage===1?<form onSubmit={e=>{e.preventDefault();run(async()=>{await api('checkoutStart',{profile,consent,coupon:appliedCoupon.code});setStage(2);});}}>{profileForm()}<label>Delivery instructions (optional)<textarea rows={2} maxLength={1000} value={note} onChange={e=>setNote(e.target.value)} placeholder="Landmark or delivery instructions"/></label><div className="coupon-row"><label>Have a coupon?<input value={couponCode} onChange={e=>{setCouponCode(e.target.value.toUpperCase());setAppliedCoupon({code:'',discount:0});}} placeholder="Enter coupon code"/></label><button type="button" className="button outline" disabled={busy||!couponCode} onClick={()=>run(async()=>{const d=await api('coupon',{code:couponCode});setAppliedCoupon(d);toast.success('Coupon applied');})}>Apply</button></div>{appliedCoupon.code&&<p className="coupon-success">{appliedCoupon.code} applied · You save {money(appliedCoupon.discount)}</p>}<div className="billing-summary"><h3>Your order summary</h3>{cart.items.map((i,index)=><div className="split" key={index}><span>{i.name||products.find(p=>p.id===i.productId)?.name} × {i.quantity}</span><b>{money((products.find(p=>p.id===i.productId)?.price||i.price||0)*i.quantity)}</b></div>)}<div className="split"><span>Subtotal</span><span>{money(total)}</span></div>{appliedCoupon.discount>0&&<div className="split"><span>Coupon savings</span><span>−{money(appliedCoupon.discount)}</span></div>}<p className="small muted">{settings.shippingNote} {settings.taxNote}</p><div className="total"><b>Request total</b><b>{money(total-appliedCoupon.discount)}</b></div></div><label className="check-line"><Checkbox checked={consent} onCheckedChange={v=>setConsent(v===true)}/><span>I agree to save my details and bag for this checkout, including if I leave before submitting it. TREND ZEE may contact me about this checkout.</span></label><p className="small muted">Read our <button type="button" className="underlined" onClick={()=>setPanel('privacy')}>privacy notice</button>. No payment is collected in this preview.</p><button className="button full" disabled={busy||!consent}>Save & continue</button></form>:<><div className="notice">Payments are not connected yet. You can save an unpaid order request, but this does not confirm a purchase or reserve stock.</div><p><b>{profile.name}</b><br/>{profile.address}, {profile.city} — {profile.pincode}<br/>{profile.mobile}</p><label>Preferred payment method<select value={method} onChange={e=>setMethod(e.target.value)}><option>UPI</option><option>Credit card</option><option>Debit card</option></select></label><p className="small muted">Cash on delivery is not available. Never send card details or UPI PINs through support or feedback.</p><div className="total"><span>Order request total</span><b>{money(total-appliedCoupon.discount)}</b></div><button className="button full" disabled={busy} onClick={()=>run(async()=>{const r=await api('order',{profile,consent,method,coupon:appliedCoupon.code,note,key:crypto.randomUUID()});setOrderId(r.id);await load();setPanel('success');})}>{busy?'Saving…':'Save unpaid order request'}</button><button className="text-button" onClick={()=>setStage(1)}>Edit delivery details</button></>}</>}

      {panel==='success'&&<div className="empty"><Check size={40}/><h3>{orderId}</h3><p>Saved as awaiting payment. No payment was taken and stock is not reserved.</p><button className="button" onClick={()=>setPanel('account')}>View my orders</button></div>}

      {panel==='support'&&<>{!user?<div className="empty"><Headphones size={34}/><h3>Support is connected to your shopping session.</h3><p>Continue with your mobile number so your ticket can be tracked in your account.</p><button className="button" onClick={()=>{setAfterMobile('support');setPanel('mobile');}}>Continue</button></div>:<form onSubmit={e=>{e.preventDefault();run(async()=>{const r=await api('support',supportForm);toast.success(`Support ticket ${r.id} created`);setSupportForm({category:'Order help',subject:'',message:''});await load();setPanel('account');});}}><div className="support-contact"><Headphones/><div><b>We’re here to help</b><span>{settings.supportHours}</span>{settings.supportEmail&&<span>{settings.supportEmail}</span>}{settings.supportPhone&&<span>{settings.supportPhone}</span>}</div></div><label>What do you need help with?<select value={supportForm.category} onChange={e=>setSupportForm({...supportForm,category:e.target.value})}><option>Order help</option><option>Product question</option><option>Delivery</option><option>Return / refund</option><option>Account</option><option>Other</option></select></label><label>Subject<input required maxLength={160} value={supportForm.subject} onChange={e=>setSupportForm({...supportForm,subject:e.target.value})}/></label><label>Message<textarea required rows={6} maxLength={3000} value={supportForm.message} onChange={e=>setSupportForm({...supportForm,message:e.target.value})}/></label><button className="button full" disabled={busy}>{busy?'Sending…':'Create support ticket'}</button></form>}</>}

      {panel==='returns'&&returnOrder&&<form onSubmit={e=>{e.preventDefault();run(async()=>{const r=await api('returnRequest',{id:returnOrder.id,reason:returnReason});toast.success(`Return request ${r.id} created`);await load();setPanel('account');setReturnOrder(null);});}}><div className="notice">Return requests are reviewed by the store team. Refund processing only becomes available after a verified payment/refund provider is connected.</div><p><b>{returnOrder.id}</b> · {money(returnOrder.total)}</p><label>Reason for return<textarea required rows={5} maxLength={1000} value={returnReason} onChange={e=>setReturnReason(e.target.value)} placeholder="Tell us what happened and what you would like us to review."/></label><button className="button full" disabled={busy}>Submit return request</button></form>}

      {panel==='review'&&reviewTarget&&<form onSubmit={e=>{e.preventDefault();run(async()=>{await api('review',{orderId:reviewTarget.order.id,productId:reviewTarget.product.productId,...reviewForm});toast.success('Review submitted for moderation');setPanel('account');setReviewTarget(null);});}}><p><b>{reviewTarget.product.name}</b></p><label>Rating<select value={reviewForm.rating} onChange={e=>setReviewForm({...reviewForm,rating:Number(e.target.value)})}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} / 5</option>)}</select></label><label>Review title<input maxLength={120} value={reviewForm.title} onChange={e=>setReviewForm({...reviewForm,title:e.target.value})}/></label><label>Your review<textarea required rows={5} maxLength={2000} value={reviewForm.message} onChange={e=>setReviewForm({...reviewForm,message:e.target.value})}/></label><button className="button full" disabled={busy}>Submit review</button></form>}

      {panel==='feedback'&&<>{!user?<div className="empty"><Star size={34}/><h3>Feedback is linked to your shopping session.</h3><p>Continue with your mobile number so the team can follow up if needed.</p><button className="button" onClick={()=>{setAfterMobile('feedback');setPanel('mobile');}}>Continue</button></div>:<form onSubmit={e=>{e.preventDefault();run(async()=>{await api('feedback',{rating,message});setMessage('');setRating(5);toast.success('Thanks — your feedback reached the team.');setPanel('');});}}><label>Your experience<select value={rating} onChange={e=>setRating(Number(e.target.value))}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} / 5</option>)}</select></label><label>Your feedback<textarea required maxLength={2000} rows={6} value={message} onChange={e=>setMessage(e.target.value)} placeholder="What worked well? What could be better?"/></label><button className="button full" disabled={busy}>Send feedback</button></form>}</>}

      {panel==='terms'&&<div className="prose"><h3>Store status</h3><p>The store is currently in <b>{settings.storeStatus.toLowerCase()}</b> mode. Product availability and order-request totals are real data from this application, while paid checkout remains disabled until a payment provider is connected.</p><h3>Payment & dispatch</h3><p>UPI, credit card and debit card can be supported after a payment provider is connected. No card numbers or UPI PINs are collected here. Dispatch requires verified payment.</p><h3>Delivery, taxes & returns</h3><p>{settings.shippingNote} {settings.taxNote} Eligible delivered paid orders can request a return within {settings.returnsWindowDays} days.</p></div>}
      {panel==='privacy'&&<div className="prose"><p>We store profile details you submit: name, email, mobile number and delivery address. Location is attached only after you choose “Use my location” and allow your browser to share it.</p><p>Your shopping bag and saved items are stored to support your shopping session. When you agree and continue checkout, we save your contact details and bag even if you do not submit an order so the store team can help with that checkout.</p><p>Support tickets, feedback and eligible product reviews are associated with your shopping session. Administrators can access these operational records but never your sign-in password.</p></div>}
    </DialogContent></Dialog>

    <footer className="store-footer"><div><span className="logo">TREND ZEE<sup>®</sup></span><p>Wear your next chapter.</p></div><div><b>Shop</b><button onClick={()=>browse('All')}>All products</button><button onClick={()=>setPanel('saved')}>Saved items</button><button onClick={()=>setPanel('bag')}>Your bag</button></div><div><b>Help</b><button onClick={()=>setPanel('support')}>Customer support</button><button onClick={()=>requireCustomer('feedback')}>Share feedback</button><button onClick={()=>setPanel('terms')}>Store terms</button><button onClick={()=>setPanel('privacy')}>Privacy</button></div><div><b>Your account</b><button onClick={()=>requireCustomer('account')}>Orders & profile</button><span>{settings.supportHours}</span></div></footer>
  </>;
}