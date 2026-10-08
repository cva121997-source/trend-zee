import {runtimeEnv,envValue} from '@/lib/runtime-env';
import {normalizeAdminRole,type AdminRole} from '@/lib/roles';
type PreparedLike={
  bind(...values:unknown[]):PreparedLike;
  first<T=any>():Promise<T|null>;
  all<T=any>():Promise<{results:T[]}>;
  run():Promise<any>;
};
type DatabaseLike={prepare(sql:string):PreparedLike;batch(statements:PreparedLike[]):Promise<any>};

function normalizeSql(sql:string){
  let q=sql.trim().replace(/;\s*$/,'');
  if(/INSERT\s+OR\s+IGNORE\s+INTO/i.test(q)&&!/ON\s+CONFLICT/i.test(q)){
    q=q.replace(/INSERT\s+OR\s+IGNORE\s+INTO/i,'INSERT INTO')+' ON CONFLICT DO NOTHING';
  }
  return q;
}

async function supabaseSql(sql:string,params:unknown[]){
  const url=(envValue('SUPABASE_URL')||'https://hzlsjwcqdhdckftisgso.supabase.co').replace(/\/$/,'');
  const key=envValue('SUPABASE_SERVICE_ROLE_KEY');
  if(!key)throw new Error('Supabase storage is not configured. Add SUPABASE_SERVICE_ROLE_KEY to Vercel.');
  const response=await fetch(url+'/rest/v1/rpc/trend_zee_sql',{
    method:'POST',
    headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},
    body:JSON.stringify({p_sql:normalizeSql(sql),p_params:params}),
  });
  const body=await response.text();
  if(!response.ok)throw new Error(body.slice(0,500)||'Supabase database request failed.');
  try{return JSON.parse(body);}catch{return [];}
}

class SupabasePreparedStatement implements PreparedLike{
  private readonly sql:string;
  private params:unknown[]=[];
  constructor(sql:string){this.sql=sql;}
  bind(...values:unknown[]){this.params=values;return this;}
  private normalize<T=any>(row:T):T{
    if(row&&typeof row==='object'){
      const copy={...(row as any)};
      if(copy.data&&typeof copy.data==='object')copy.data=JSON.stringify(copy.data);
      return copy as T;
    }
    return row;
  }
  async first<T=any>():Promise<T|null>{const rows=await supabaseSql(this.sql,this.params);return Array.isArray(rows)&&rows[0]?this.normalize(rows[0] as T):null;}
  async all<T=any>():Promise<{results:T[]}>{const rows=await supabaseSql(this.sql,this.params);return {results:Array.isArray(rows)?rows.map(row=>this.normalize(row as T)):[]};}
  async run(){await supabaseSql(this.sql,this.params);return {success:true};}
}
class SupabaseDatabase implements DatabaseLike{
  prepare(sql:string){return new SupabasePreparedStatement(sql);}
  async batch(statements:PreparedLike[]){for(const statement of statements)await statement.run();return statements.map(()=>({success:true}));}
}

let supabaseDatabase:SupabaseDatabase|undefined;
export function database():DatabaseLike{
  const env=runtimeEnv();
  if(env.DB)return env.DB as unknown as DatabaseLike;
  if(envValue('SUPABASE_SERVICE_ROLE_KEY')){
    supabaseDatabase??=new SupabaseDatabase();
    return supabaseDatabase;
  }
  throw new Error('Store storage is temporarily unavailable. Please try again.');
}
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
