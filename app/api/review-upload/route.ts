import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {database,cookie,checkOrigin} from '@/lib/store-server';

async function allowed(req:Request){
  const user=await getChatGPTUser();if(user)return true;
  const raw=cookie(req,'tz_bag');if(!/^[a-f0-9-]{36}$/.test(raw))return false;
  const row=await database().prepare('SELECT data FROM records WHERE id=?').bind('profile:guest:'+raw).first<any>();
  return !!row&&!!JSON.parse(row.data)?.mobile;
}
export async function POST(req:Request){
  try{
    checkOrigin(req);
    if(!await allowed(req))return Response.json({error:'Continue as a shopper before uploading a review photo.'},{status:401});
    const body=await req.formData();const file=body.get('file');
    if(!(file instanceof File)||file.size>5*1024*1024)throw new Error('Choose an image smaller than 5 MB.');
    const bytes=new Uint8Array(await file.arrayBuffer());
    const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
    const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;
    const webp=new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP';
    if(!jpeg&&!png&&!webp)throw new Error('Use a JPG, PNG or WebP image.');
    if(!env.BUCKET)throw new Error('Image storage is unavailable.');
    const key=crypto.randomUUID();await env.BUCKET.put('review/'+key,bytes,{httpMetadata:{contentType:jpeg?'image/jpeg':png?'image/png':'image/webp'}});
    return Response.json({url:'/api/review-image/'+key});
  }catch(e){return Response.json({error:e instanceof Error?e.message:'Review photo upload failed.'},{status:400});}
}
