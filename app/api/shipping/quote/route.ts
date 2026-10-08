import {NextResponse} from 'next/server';
import {quoteShipping} from '@/lib/shipping';
export const dynamic='force-dynamic';
export async function GET(req:Request){const u=new URL(req.url);const pincode=u.searchParams.get('pincode')||'';const subtotal=Number(u.searchParams.get('subtotal')||0);return NextResponse.json({methods:quoteShipping(pincode,Number.isFinite(subtotal)?subtotal:0)});}
