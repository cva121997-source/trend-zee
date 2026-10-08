import {NextResponse} from 'next/server';
import {calculateTax} from '@/lib/tax';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{const u=new URL(req.url);const subtotal=Number(u.searchParams.get('subtotal')||0);const tax=await calculateTax(Number.isFinite(subtotal)?Math.max(0,subtotal):0,{pincode:u.searchParams.get('pincode')||'',city:u.searchParams.get('city')||''});return NextResponse.json(tax);}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Could not calculate tax.'},{status:503});}}
