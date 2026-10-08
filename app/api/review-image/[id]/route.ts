import {runtimeEnv} from '@/lib/runtime-env';
export async function GET(req:Request){const env=runtimeEnv();
  const id=new URL(req.url).pathname.split('/').pop()||'';
  if(!/^[a-f0-9-]{36}$/.test(id)||!env.BUCKET)return new Response('Not found',{status:404});
  const file=await env.BUCKET.get('review/'+id);if(!file)return new Response('Not found',{status:404});
  return new Response(file.body as any,{headers:{'Content-Type':file.httpMetadata?.contentType||'image/jpeg','Cache-Control':'public, max-age=604800','X-Content-Type-Options':'nosniff'}});
}
