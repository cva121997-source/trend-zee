import {runtimeEnv} from '@/lib/runtime-env';
import {runtimeEnv} from '@/lib/runtime-env';
import {NextResponse} from 'next/server';
const env=runtimeEnv();
import {adminRole,checkOrigin,isAdmin} from '@/lib/store-server';
import {canAdmin} from '@/lib/roles';

export const dynamic='force-dynamic';

async function authorize(req:Request){
  const role=await adminRole(req);if(!role||!canAdmin(role,'adminContent'))return null;return role;
}

export async function GET(req:Request){
  const role=await authorize(req);if(!role)return NextResponse.json({error:'Content admin access required.'},{status:403});
  if(!env.BUCKET)return NextResponse.json({items:[]});
  const result=await env.BUCKET.list({limit:1000});
  return NextResponse.json({items:result.objects.filter(o=>/^[a-f0-9-]{36}$/.test(o.key)).map(o=>({id:o.key,url:'/api/image/'+o.key,size:Number(o.size||0),uploaded:o.uploaded?.toISOString?.()||''}))},{headers:{'Cache-Control':'no-store'}});
}

export async function DELETE(req:Request){
  try{
    checkOrigin(req);const role=await authorize(req);if(!role)return NextResponse.json({error:'Content admin access required.'},{status:403});
    if(!env.BUCKET)return NextResponse.json({error:'Media storage is unavailable.'},{status:503});
    const body:any=await req.json();const id=String(body.id||'').trim();if(!/^[a-f0-9-]{36}$/.test(id))throw new Error('Invalid media reference.');
    await env.BUCKET.delete(id);return NextResponse.json({ok:true,id});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not delete media.'},{status:400});}
}
