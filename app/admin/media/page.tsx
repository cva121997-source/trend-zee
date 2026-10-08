'use client';

import {useEffect,useState} from 'react';
import {Copy,ImagePlus,Layers,Trash2,ArrowLeft} from 'lucide-react';
import {toast,Toaster} from 'sonner';

type Media={id:string;url:string;size:number;uploaded:string};

export default function AdminMedia(){
 const [items,setItems]=useState<Media[]>([]);const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);
 async function load(){try{const r=await fetch('/api/media');const d:any=await r.json();if(!r.ok)throw new Error(d.error);setItems(d.items||[])}catch(e){toast.error((e as Error).message)}finally{setLoading(false)}}
 useEffect(()=>{void load()},[]);
 async function upload(file:File){setBusy(true);try{const form=new FormData();form.append('file',file);const r=await fetch('/api/upload',{method:'POST',body:form});const d:any=await r.json();if(!r.ok)throw new Error(d.error);await load();toast.success('Media uploaded');}catch(e){toast.error((e as Error).message)}finally{setBusy(false)}}
 async function remove(id:string){setBusy(true);try{const r=await fetch('/api/media',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});const d:any=await r.json();if(!r.ok)throw new Error(d.error);await load();toast.success('Media deleted')}catch(e){toast.error((e as Error).message)}finally{setBusy(false)}}
 return <main className="admin-media-page"><Toaster richColors position="top-center"/><header className="admin-media-head"><div><a className="text-button" href="/admin"><ArrowLeft size={15}/> Back to operations</a><div className="media-title"><Layers size={22}/><div><span className="card-kicker">CONTENT ASSETS</span><h1>Media library</h1><p>Reusable images stored in the Trend-Zee R2 bucket. Use these URLs in products, campaigns and homepage sections.</p></div></div></div><label className="button"><ImagePlus size={16}/> Upload image<input hidden type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void upload(f)}}/></label></header>{loading?<div className="empty">Loading media library…</div>:!items.length?<div className="empty"><ImagePlus size={34}/><h3>No media yet.</h3><p>Upload the first campaign or product image.</p></div>:<section className="media-grid">{items.map(item=><article key={item.id} className="media-card"><div className="media-thumb"><img src={item.url} alt="" loading="lazy"/></div><div className="media-card-body"><b>{Math.max(1,Math.round(item.size/1024))} KB</b><small>{item.uploaded?new Date(item.uploaded).toLocaleString('en-IN'):item.id}</small><code>{item.url}</code><div className="row-actions"><button className="button outline compact" onClick={()=>{navigator.clipboard?.writeText(location.origin+item.url);toast.success('URL copied')}}><Copy size={14}/> Copy URL</button><button className="button outline compact" disabled={busy} onClick={()=>void remove(item.id)}><Trash2 size={14}/> Delete</button></div></div></article>)}</section>}</main>
}
