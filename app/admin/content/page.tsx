'use client';

import {useEffect,useMemo,useState} from 'react';
import {ArrowDown,ArrowUp,Check,ChevronLeft,Image as ImageIcon,Plus,Save,Trash2,Upload,X} from 'lucide-react';
import {Toaster,toast} from 'sonner';
import {api} from '@/lib/client';
import {HomepageSection,HomepageSectionType,MotionPreset,Collection,Campaign,CategoryContent} from '@/lib/content';
import {Product,money} from '@/lib/catalog';

type Data={homepageSections:HomepageSection[];collections:Collection[];campaigns:Campaign[];categories:CategoryContent[]};
const blankSection=():HomepageSection=>({id:crypto.randomUUID(),type:'product-carousel',kicker:'',title:'',description:'',ctaLabel:'Shop now',ctaHref:'#collection',secondaryCtaLabel:'',secondaryCtaHref:'',image:'',mobileImage:'',category:'All',collectionId:'',productIds:[],theme:'paper',layout:'standard',motion:'reveal',visible:true,sortOrder:100,scheduleStart:'',scheduleEnd:''});
const blankCollection=():Collection=>({id:crypto.randomUUID(),title:'',description:'',coverImage:'',productIds:[],layout:'grid',visible:true,sortOrder:100,scheduleStart:'',scheduleEnd:''});
const blankCampaign=():Campaign=>({id:crypto.randomUUID(),name:'',title:'',description:'',desktopImage:'',mobileImage:'',ctaLabel:'Shop now',ctaHref:'#collection',productIds:[],category:'All',discountLabel:'',startDate:'',endDate:'',status:'draft'});
const blankCategory=():CategoryContent=>({slug:'',title:'',description:'',image:'',bannerImage:'',visible:true,sortOrder:100});
const splitIds=(value:string)=>value.split(',').map(x=>x.trim()).filter(Boolean).slice(0,60);

async function uploadImage(file:File){
  const body=new FormData();body.append('file',file);
  const response=await fetch('/api/upload',{method:'POST',body});
  const data:any=await response.json();
  if(!response.ok)throw new Error(data.error||'Upload failed.');
  return data.url as string;
}

export default function ContentStudio(){
  const [data,setData]=useState<Data|null>(null);
  const [products,setProducts]=useState<Product[]>([]);
  const [tab,setTab]=useState<'homepage'|'collections'|'campaigns'|'categories'>('homepage');
  const [selected,setSelected]=useState<HomepageSection|Collection|Campaign|CategoryContent|null>(null);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [uploading,setUploading]=useState('');

  async function load(){
    try{
      setError('');
      const response=await fetch('/api/store?view=content-admin');
      if(response.status===401){setData(null);return;}
      const body:any=await response.json();
      if(!response.ok)throw new Error(body.error||'Could not load Content Studio.');
      setData(body);
      const store=await fetch('/api/store');
      if(store.ok){const catalog:any=await store.json();setProducts(catalog.products||[]);}
    }catch(e){setError((e as Error).message);}finally{setLoading(false);}
  }
  useEffect(()=>{load();},[]);

  async function saveRecord(kind:string,record:any,remove=false){
    setBusy(true);setError('');
    try{await api('adminContent',{kind,record,remove});await load();setSelected(null);toast.success(remove?'Content removed':'Content saved');}
    catch(e){setError((e as Error).message);toast.error((e as Error).message);}
    finally{setBusy(false);}
  }

  async function moveSection(index:number,direction:-1|1){
    if(!data||busy)return;
    const rows=data.homepageSections.slice().sort((a,b)=>a.sortOrder-b.sortOrder);
    const target=index+direction;
    if(target<0||target>=rows.length)return;
    const first=rows[index],second=rows[target],firstOrder=first.sortOrder;
    await saveRecord('homepage_section',{...first,sortOrder:second.sortOrder});
    await saveRecord('homepage_section',{...second,sortOrder:firstOrder});
  }

  async function upload(field:string,file:File){
    setUploading(field);
    try{const url=await uploadImage(file);setSelected(current=>current?{...current,[field]:url}:current);}
    catch(e){toast.error((e as Error).message);}finally{setUploading('');}
  }

  const sections=(data?.homepageSections||[]).slice().sort((a,b)=>a.sortOrder-b.sortOrder);
  const collections=(data?.collections||[]).slice().sort((a,b)=>a.sortOrder-b.sortOrder);
  const campaigns=(data?.campaigns||[]).slice();
  const categories=(data?.categories||[]).slice().sort((a,b)=>a.sortOrder-b.sortOrder);
  const productNames=useMemo(()=>new Map(products.map(p=>[p.id,p.name])),[products]);

  if(loading)return <div className="admin-loading"><span className="logo">TREND ZEE</span><p>Loading content studio…</p></div>;
  if(!data)return <div className="admin-login premium-login"><Toaster richColors/><div className="login-brand"><span className="admin-mark">TZ</span><span>TREND ZEE<small>CONTENT STUDIO</small></span></div><div className="login-card"><span className="card-kicker">ADMIN ACCESS REQUIRED</span><h1>Shape the<br/><em>shopping story.</em></h1><p>Sign in through the main commerce admin first, then reopen Content Studio.</p>{error&&<div className="error-box">{error}</div>}<a className="button full" href="/admin">Open commerce admin</a></div></div>;

  const update=(key:string,value:any)=>setSelected(current=>current?{...current,[key]:value}:current);
  const field=(label:string,key:string,wide=false,type='text')=><label className={wide?'wide':''}>{label}<input type={type} value={(selected as any)?.[key]||''} onChange={e=>update(key,e.target.value)}/></label>;
  const media=(label:string,key:string)=><div className="studio-media"><label>{label}<input value={(selected as any)?.[key]||''} onChange={e=>update(key,e.target.value)} placeholder="https://… or /images/…" /></label><label className="studio-upload"><Upload size={15}/><span>{uploading===key?'Uploading…':'Upload image'}</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={!!uploading} onChange={e=>{const f=e.target.files?.[0];if(f)upload(key,f);}}/></label>{(selected as any)?.[key]&&<img src={(selected as any)[key]} alt="" />}</div>;
  const saveKind='type' in (selected||{})?'homepage_section':'name' in (selected||{})?'campaign':'slug' in (selected||{})?'category':'collection';

  return <div className="admin-shell premium-admin">
    <Toaster richColors position="top-center"/>
    <header className="admin-top premium-top"><div className="admin-brand"><a className="text-button" href="/admin"><ChevronLeft size={15}/> Admin</a><span className="admin-mark">TZ</span><span><b>TREND ZEE</b><small>CONTENT STUDIO</small></span></div><div className="admin-global-actions"><a className="text-button" href="/">View storefront</a></div></header>
    <div className="admin-layout">
      <aside className="admin-sidebar"><div className="admin-nav-caption">CONTENT</div><nav>
        <button className={tab==='homepage'?'active':''} onClick={()=>{setTab('homepage');setSelected(null);}}><ImageIcon size={17}/><span>Homepage story<small>Sections, order & motion</small></span></button>
        <button className={tab==='collections'?'active':''} onClick={()=>{setTab('collections');setSelected(null);}}><ImageIcon size={17}/><span>Collections<small>Editorial product groups</small></span></button>
        <button className={tab==='campaigns'?'active':''} onClick={()=>{setTab('campaigns');setSelected(null);}}><ImageIcon size={17}/><span>Campaigns<small>Scheduled promotions</small></span></button>
        <button className={tab==='categories'?'active':''} onClick={()=>{setTab('categories');setSelected(null);}}><ImageIcon size={17}/><span>Categories<small>Shop navigation</small></span></button>
      </nav><div className="sidebar-foot"><Check size={16}/><span><b>Live controls</b><small>Visibility and scheduling are stored with each record.</small></span></div></aside>
      <main className="admin-main premium-main">
        <div className="admin-page-head"><div><span className="card-kicker">CONTENT STUDIO</span><h1>{tab==='homepage'?'Homepage story':tab==='collections'?'Collections':tab==='campaigns'?'Campaigns':'Categories'}</h1><p>Configure the storefront without changing code. Motion presets stay intentionally simple and safe.</p></div><div className="page-head-actions">
          {tab==='homepage'&&<button className="button" onClick={()=>setSelected(blankSection())}><Plus size={15}/> Add section</button>}
          {tab==='collections'&&<button className="button" onClick={()=>setSelected(blankCollection())}><Plus size={15}/> New collection</button>}
          {tab==='campaigns'&&<button className="button" onClick={()=>setSelected(blankCampaign())}><Plus size={15}/> New campaign</button>}
          {tab==='categories'&&<button className="button" onClick={()=>setSelected(blankCategory())}><Plus size={15}/> New category</button>}
        </div></div>
        {error&&<div className="error-box">{error}</div>}

        {tab==='homepage'&&<section className="admin-card studio-list"><div className="card-head"><div><span className="card-kicker">SCROLLTELLING CMS</span><h2>Sequence the shopping journey</h2><p>Reorder, hide, schedule and animate every homepage moment.</p></div></div>
          {sections.map((s,i)=><div className="studio-row" key={s.id}><div className="studio-index">{String(i+1).padStart(2,'0')}</div><div className="studio-thumb">{s.image?<img src={s.image} alt=""/>:<ImageIcon size={18}/>}</div><div className="studio-main"><div><b>{s.title||'Untitled section'}</b><span className="status-pill neutral">{s.type}</span></div><small>{s.kicker||'No kicker'} · {s.motion} · {s.visible?'Visible':'Hidden'}</small></div><div className="studio-actions"><button aria-label="Move up" disabled={i===0||busy} onClick={()=>moveSection(i,-1)}><ArrowUp size={15}/></button><button aria-label="Move down" disabled={i===sections.length-1||busy} onClick={()=>moveSection(i,1)}><ArrowDown size={15}/></button><button aria-label="Edit section" onClick={()=>setSelected({...s})}><Save size={15}/></button><button aria-label="Remove section" onClick={()=>saveRecord('homepage_section',s,true)}><Trash2 size={15}/></button></div></div>)}
        </section>}

        {tab==='collections'&&<section className="admin-card studio-list"><div className="card-head"><div><span className="card-kicker">CURATED COLLECTIONS</span><h2>Editorial product groups</h2></div></div>{collections.map(c=><div className="studio-row" key={c.id}><div className="studio-thumb">{c.coverImage&&<img src={c.coverImage} alt=""/>}</div><div className="studio-main"><div><b>{c.title}</b><span className="status-pill neutral">{c.layout}</span></div><small>{c.productIds.length} products · {c.visible?'Visible':'Hidden'}</small></div><div className="studio-actions"><button onClick={()=>setSelected({...c})}><Save size={15}/></button><button onClick={()=>saveRecord('collection',c,true)}><Trash2 size={15}/></button></div></div>)}</section>}

        {tab==='campaigns'&&<section className="admin-card studio-list"><div className="card-head"><div><span className="card-kicker">CAMPAIGN CALENDAR</span><h2>Scheduled promotional moments</h2></div></div>{campaigns.map(c=><div className="studio-row" key={c.id}><div className="studio-thumb">{c.desktopImage&&<img src={c.desktopImage} alt=""/>}</div><div className="studio-main"><div><b>{c.name}</b><span className="status-pill neutral">{c.status}</span></div><small>{c.title} · {c.startDate||'No start date'} → {c.endDate||'No end date'}</small></div><div className="studio-actions"><button onClick={()=>setSelected({...c})}><Save size={15}/></button><button onClick={()=>saveRecord('campaign',c,true)}><Trash2 size={15}/></button></div></div>)}</section>}

        {tab==='categories'&&<section className="admin-card studio-list"><div className="card-head"><div><span className="card-kicker">SHOP NAVIGATION</span><h2>Category stories</h2></div></div>{categories.map(c=><div className="studio-row" key={c.slug}><div className="studio-thumb">{c.image&&<img src={c.image} alt=""/>}</div><div className="studio-main"><div><b>{c.title}</b><span className="status-pill neutral">{c.slug}</span></div><small>{c.visible?'Visible':'Hidden'} · {c.description}</small></div><div className="studio-actions"><button onClick={()=>setSelected({...c})}><Save size={15}/></button><button onClick={()=>saveRecord('category',c,true)}><Trash2 size={15}/></button></div></div>)}</section>}

        {selected&&<section className="admin-card studio-editor">
          <div className="card-head"><div><span className="card-kicker">EDITOR</span><h2>{saveKind==='homepage_section'?'Edit homepage section':saveKind==='collection'?'Edit collection':saveKind==='campaign'?'Edit campaign':'Edit category'}</h2></div><button className="text-button" onClick={()=>setSelected(null)}><X size={15}/> Close</button></div>

          {saveKind==='homepage_section'&&<div className="form-grid">
            {field('Kicker','kicker')}{field('Title','title',true)}{field('Description','description',true)}{field('CTA label','ctaLabel')}{field('CTA link','ctaHref')}{field('Secondary CTA','secondaryCtaLabel')}{field('Secondary link','secondaryCtaHref')}{field('Category','category')}{field('Collection ID','collectionId')}{field('Product IDs (comma separated)','productIds',true)}
            {media('Primary image','image')}{media('Mobile image','mobileImage')}
            <label>Section type<select value={selected.type} onChange={e=>update('type',e.target.value as HomepageSectionType)}>{['hero','ticker','category-showcase','product-carousel','product-grid','collection-banner','full-image','editorial','testimonials','promo','newsletter','countdown','recommendations','best-sellers','new-arrivals','final-cta'].map(x=><option key={x}>{x}</option>)}</select></label>
            <label>Theme<select value={selected.theme} onChange={e=>update('theme',e.target.value)}><option>paper</option><option>ink</option><option>forest</option><option>sand</option><option>white</option></select></label>
            <label>Layout<select value={selected.layout} onChange={e=>update('layout',e.target.value)}><option>standard</option><option>split</option><option>immersive</option><option>sticky</option><option>marquee</option></select></label>
            <label>Animation<select value={selected.motion} onChange={e=>update('motion',e.target.value as MotionPreset)}>{['none','fade','slide','scale','parallax','horizontal','sticky','reveal','product-reveal'].map(x=><option key={x}>{x}</option>)}</select></label>
            {field('Display order','sortOrder',false,'number')}{field('Start date/time','scheduleStart',false,'datetime-local')}{field('End date/time','scheduleEnd',false,'datetime-local')}
            <label className="check-line"><input type="checkbox" checked={selected.visible} onChange={e=>update('visible',e.target.checked)}/><span>Visible on storefront</span></label>
          </div>}

          {saveKind==='collection'&&<div className="form-grid">
            {field('Title','title',true)}{field('Description','description',true)}{field('Product IDs (comma separated)','productIds',true)}{media('Cover image','coverImage')}
            <label>Layout<select value={selected.layout} onChange={e=>update('layout',e.target.value)}><option>editorial</option><option>grid</option><option>split</option></select></label>
            {field('Display order','sortOrder',false,'number')}{field('Start date/time','scheduleStart',false,'datetime-local')}{field('End date/time','scheduleEnd',false,'datetime-local')}
            <label className="check-line"><input type="checkbox" checked={selected.visible} onChange={e=>update('visible',e.target.checked)}/><span>Visible on storefront</span></label>
          </div>}

          {saveKind==='campaign'&&<div className="form-grid">
            {field('Campaign name','name')}{field('Title','title',true)}{field('Description','description',true)}{field('CTA label','ctaLabel')}{field('CTA link','ctaHref')}{field('Category','category')}{field('Discount label','discountLabel')}{field('Product IDs (comma separated)','productIds',true)}{media('Desktop image','desktopImage')}{media('Mobile image','mobileImage')}
            <label>Status<select value={selected.status} onChange={e=>update('status',e.target.value)}><option>draft</option><option>scheduled</option><option>live</option><option>ended</option></select></label>
            {field('Start date','startDate',false,'date')}{field('End date','endDate',false,'date')}
          </div>}

          {saveKind==='category'&&<div className="form-grid">
            {field('Slug','slug')}{field('Title','title',true)}{field('Description','description',true)}{media('Category image','image')}{media('Banner image','bannerImage')}{field('Display order','sortOrder',false,'number')}
            <label className="check-line"><input type="checkbox" checked={selected.visible} onChange={e=>update('visible',e.target.checked)}/><span>Visible in storefront navigation</span></label>
          </div>}

          <div className="studio-editor-footer"><small>{products.length} products available. Example IDs: {products.slice(0,4).map(p=>p.id+' ('+(productNames.get(p.id)||'')+')').join(', ')}</small><button className="button" disabled={busy||!!uploading} onClick={()=>saveRecord(saveKind,selected)}><Save size={15}/> Save changes</button></div>
        </section>}

        <section className="admin-card studio-legend"><div><span className="card-kicker">CONTENT PRINCIPLE</span><h2>Sell the story, then make the next click obvious.</h2><p>Hero → discovery → category → product → proof → offer → checkout. Every section above has a purpose, and every animation is a restrained presentation preset rather than an engineering knob.</p></div></section>
      </main>
    </div>
  </div>;
}
