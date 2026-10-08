import {NextResponse} from 'next/server';
import {adminRole,checkOrigin} from '@/lib/store-server';
import {canAdmin} from '@/lib/roles';
import {deleteSupabaseMedia,listSupabaseMedia} from '@/lib/supabase-storage';

export const dynamic='force-dynamic';
async function authorize(req:Request){const role=await adminRole(req);if(!role||!canAdmin(role,'adminContent'))return null;return role;}

export async function GET(req:Request){
  const role=await authorize(req);if(!role)return NextResponse.json({error:'Content admin access required.'},{status:403});
  try{return NextResponse.json({items:await listSupabaseMedia()},{headers:{'Cache-Control':'no-store'}});}
  catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Media library unavailable.'},{status:503});}
}
export async function DELETE(req:Request){
  try{
    checkOrigin(req);const role=await authorize(req);if(!role)return NextResponse.json({error:'Content admin access required.'},{status:403});
    const body:any=await req.json();const id=String(body.id||'').trim();if(!/^[a-f0-9-]{36}(?:\\.([a-z0-9]+))?$/i.test(id))throw new Error('Invalid media reference.');
    await deleteSupabaseMedia(id);return NextResponse.json({ok:true,id});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not delete media.'},{status:400});}
}
