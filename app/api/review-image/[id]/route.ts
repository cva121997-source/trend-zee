import {supabaseMediaUrl} from '@/lib/supabase-storage';
export async function GET(req:Request){
  const id=new URL(req.url).pathname.split('/').pop()||'';
  if(!/^[a-f0-9-]{36}$/.test(id))return new Response('Not found',{status:404});
  return Response.redirect(supabaseMediaUrl('review/'+id),302);
}
