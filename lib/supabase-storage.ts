import {envValue} from '@/lib/runtime-env';

const projectUrl=()=> (envValue('SUPABASE_URL')||'https://hzlsjwcqdhdckftisgso.supabase.co').replace(/\/$/,'');
const serviceKey=()=>envValue('SUPABASE_SERVICE_ROLE_KEY');

export function supabaseStorageConfigured(){return !!serviceKey();}

function headers(){
  const key=serviceKey();
  if(!key)throw new Error('Supabase storage is not configured. Add SUPABASE_SERVICE_ROLE_KEY in Vercel.');
  return {apikey:key,Authorization:'Bearer '+key};
}

export function supabaseMediaUrl(path:string){
  return projectUrl()+'/storage/v1/object/public/media/'+path.split('/').map(encodeURIComponent).join('/');
}

export async function uploadSupabaseMedia(path:string,bytes:Uint8Array,contentType:string){
  const r=await fetch(projectUrl()+'/storage/v1/object/media/'+path.split('/').map(encodeURIComponent).join('/'),{
    method:'POST',
    headers:{...headers(),'Content-Type':contentType,'Cache-Control':'public, max-age=31536000','x-upsert':'true'},
    body:Uint8Array.from(bytes).buffer as ArrayBuffer,
  });
  if(!r.ok)throw new Error((await r.text()).slice(0,300)||'Supabase media upload failed.');
  return supabaseMediaUrl(path);
}

export async function deleteSupabaseMedia(path:string){
  const r=await fetch(projectUrl()+'/storage/v1/object/media/'+path.split('/').map(encodeURIComponent).join('/'),{method:'DELETE',headers:headers()});
  if(!r.ok)throw new Error((await r.text()).slice(0,300)||'Supabase media delete failed.');
}

export async function listSupabaseMedia(){
  const r=await fetch(projectUrl()+'/storage/v1/object/list/media',{
    method:'POST',headers:{...headers(),'Content-Type':'application/json'},
    body:JSON.stringify({prefix:null,limit:1000,offset:0,sortBy:{column:'created_at',order:'desc'}}),
  });
  if(!r.ok)throw new Error((await r.text()).slice(0,300)||'Supabase media list failed.');
  const items:any[]=await r.json();
  return items.filter(x=>x?.name&&!String(x.name).startsWith('review/')).map(x=>({
    id:String(x.name),
    url:supabaseMediaUrl(String(x.name)),
    size:Number(x.metadata?.size||0),
    uploaded:String(x.created_at||x.updated_at||''),
  }));
}
