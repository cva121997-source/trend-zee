import {supabasePublicStorageUrl} from '@/lib/store-server';

export async function GET(req:Request){
  const id=new URL(req.url).pathname.split('/').pop()||'';
  if(!/^[a-f0-9-]{36}$/.test(id)) return new Response('Not found',{status:404});
  try{
    const file=await fetch(supabasePublicStorageUrl(id),{cache:'no-store'});
    if(!file.ok||!file.body) return new Response('Not found',{status:404});
    return new Response(file.body,{headers:{
      'Content-Type':file.headers.get('content-type')||'image/jpeg',
      'Cache-Control':'public, max-age=86400',
      'X-Content-Type-Options':'nosniff'
    }});
  }catch{
    return new Response('Not found',{status:404});
  }
}
