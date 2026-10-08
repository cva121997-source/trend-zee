import {runtimeEnv,envValue} from '@/lib/runtime-env';
import {normalizeAdminRole,type AdminRole} from '@/lib/roles';
export function database(){const env=runtimeEnv();if(!env.DB)throw new Error('Store storage is temporarily unavailable. Please try again.');return env.DB;}
export async function row(id:string){return database().prepare('SELECT * FROM records WHERE id = ?').bind(id).first<any>();}
export async function save(id:string,kind:string,owner:string,data:unknown){const now=new Date().toISOString();await database().prepare('INSERT INTO records (id,kind,owner,data,created,updated) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated=excluded.updated').bind(id,kind,owner,JSON.stringify(data),now,now).run();}
export async function list(kind:string,owner?:string){const q=owner?database().prepare('SELECT * FROM records WHERE kind=? AND owner=? ORDER BY updated DESC').bind(kind,owner):database().prepare('SELECT * FROM records WHERE kind=? ORDER BY updated DESC').bind(kind);return (await q.all<any>()).results.map(r=>({...JSON.parse(r.data),id:r.id,owner:r.owner,created:r.created,updated:r.updated}));}
export const read=(r:any,fallback:any=null)=>r?JSON.parse(r.data):fallback;
export function cookie(req:Request,key:string){return req.headers.get('cookie')?.split('; ').find(x=>x.startsWith(key+'='))?.slice(key.length+1)||'';}
const bytes=(s:string)=>new TextEncoder().encode(s);
const hex=(b:ArrayBuffer)=>Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');
export async function digest(s:string){return hex(await crypto.subtle.digest('SHA-256',bytes(s)));}
export function secret(name:string){return envValue(name);}
async function sign(s:string){const value=secret('ADMIN_SESSION_SECRET');if(!value)throw new Error('Admin sign-in is not configured.');const key=await crypto.subtle.importKey('raw',bytes(value),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',key,bytes(s)));}
export async function adminToken(role:AdminRole='Owner'){const value=String(Date.now()+8*3600000),normalized=normalizeAdminRole(role),payload=value+'.'+normalized;return payload+'.'+await sign(payload);}
export async function adminRole(req:Request):Promise<AdminRole|null>{const [exp,role,sig]=cookie(req,'tz_admin').split('.');if(!exp||!role||!sig||Number(exp)<Date.now())return null;const normalized=normalizeAdminRole(role);return await sign(exp+'.'+normalized)===sig?normalized:null;}
export async function isAdmin(req:Request){return !!(await adminRole(req));}
export function sessionCookie(req:Request,key:string,value:string,maxAge=28800){return `${key}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${new URL(req.url).protocol==='https:'?'; Secure':''}`;}
export function checkOrigin(req:Request){const origin=req.headers.get('origin');if(origin!==new URL(req.url).origin)throw new Error('Please submit this request from the storefront.');}
