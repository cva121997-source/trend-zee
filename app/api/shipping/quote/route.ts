import {NextResponse} from 'next/server';
import {quoteShipping} from '@/lib/shipping';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{const u=new URL(req.url);const pincode=u.searchParams.get('pincode')||'';const subtotal=Number(u.searchParams.get('subtotal')||0);const methods=await quoteShipping(pincode,Number.isFinite(subtotal)?subtotal:0);return NextResponse.json({methods,provider:methods[0]?.provider||'preview'});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not quote shipping.'},{status:503});}}
