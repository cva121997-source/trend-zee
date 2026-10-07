export type StoreRecord = { id:string; kind:string; owner:string; data:unknown; created:string; updated:string };

const PRODUCT_IMAGE_BUCKET = "product-images";

function config(){
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/,"");
  const key = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  if(!url || !key) throw new Error("Supabase server configuration is missing. Set SUPABASE_URL and SUPABASE_SECRET_KEY in Vercel.");
  return {url,key};
}

async function request(service:"rest"|"storage", path:string, init:RequestInit={}){
  const cfg = config();
  const headers = new Headers(init.headers);
  headers.set("apikey",cfg.key);
  headers.set("Authorization","Bearer "+cfg.key);
  headers.set("Cache-Control","no-store");
  return fetch(cfg.url+"/"+service+"/v1/"+path.replace(/^\//,""),{...init,headers,cache:"no-store"});
}

async function readResponse<T>(response:Response):Promise<T>{
  const body = await response.text();
  if(!response.ok) throw new Error("Supabase request failed ("+response.status+"): "+body.slice(0,500));
  if(!body) return undefined as T;
  return JSON.parse(body) as T;
}

function parseData(value:unknown){
  if(typeof value!=="string") return value;
  try{return JSON.parse(value);}catch{return value;}
}

export async function row(id:string):Promise<StoreRecord|null>{
  const q = new URLSearchParams({select:"*",id:"eq."+id,limit:"1"});
  const rows = await readResponse<StoreRecord[]>(await request("rest","records?"+q));
  return rows[0] || null;
}

export async function save(id:string,kind:string,owner:string,data:unknown){
  const old = await row(id);
  const now = new Date().toISOString();
  const payload = [{id,kind,owner,data,created:old?.created || now,updated:now}];
  await readResponse(await request("rest","records?on_conflict=id",{
    method:"POST",
    headers:{"Content-Type":"application/json",Prefer:"resolution=merge-duplicates"},
    body:JSON.stringify(payload)
  }));
}

export async function saveMany(values:Array<{id:string;kind:string;owner:string;data:unknown;created?:string}>){
  const now = new Date().toISOString();
  const payload = values.map(v=>({id:v.id,kind:v.kind,owner:v.owner,data:v.data,created:v.created||now,updated:now}));
  await readResponse(await request("rest","records?on_conflict=id",{
    method:"POST",
    headers:{"Content-Type":"application/json",Prefer:"resolution=merge-duplicates"},
    body:JSON.stringify(payload)
  }));
}

export async function list(kind:string,owner?:string){
  const q = new URLSearchParams({select:"*",kind:"eq."+kind,order:"updated.desc"});
  if(owner) q.set("owner","eq."+owner);
  const rows = await readResponse<StoreRecord[]>(await request("rest","records?"+q));
  return rows.map(r=>({...((parseData(r.data)||{}) as Record<string,unknown>),id:r.id,owner:r.owner,created:r.created,updated:r.updated}));
}

export function read<T=any>(record:StoreRecord|null): T|null;
export function read<T=any>(record:StoreRecord|null,fallback:T): T;
export function read<T=any>(record:StoreRecord|null,fallback:T|null=null):T|null {
  return record ? parseData(record.data) as T : fallback;
}

export function cookie(req:Request,key:string){
  return req.headers.get("cookie")?.split("; ").find(v=>v.startsWith(key+"="))?.slice(key.length+1) || "";
}

const bytes=(v:string)=>new TextEncoder().encode(v);
const hex=(buffer:ArrayBuffer)=>Array.from(new Uint8Array(buffer)).map(v=>v.toString(16).padStart(2,"0")).join("");

export async function digest(value:string){ return hex(await crypto.subtle.digest("SHA-256",bytes(value))); }
export function secret(name:string){ return process.env[name] || ""; }

async function sign(value:string){
  const s=secret("ADMIN_SESSION_SECRET");
  if(!s) throw new Error("Admin sign-in is not configured.");
  const key=await crypto.subtle.importKey("raw",bytes(s),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return hex(await crypto.subtle.sign("HMAC",key,bytes(value)));
}

export async function adminToken(){
  const value=String(Date.now()+8*3600000);
  return value+"."+await sign(value);
}

export async function isAdmin(req:Request){
  const parts=cookie(req,"tz_admin").split(".");
  if(parts.length!==2 || Number(parts[0])<Date.now()) return false;
  return (await sign(parts[0]))===parts[1];
}

export function sessionCookie(req:Request,key:string,value:string,maxAge=28800){
  return key+"="+value+"; Path=/; HttpOnly; SameSite=Strict; Max-Age="+maxAge+(new URL(req.url).protocol==="https:"?"; Secure":"");
}

export function checkOrigin(req:Request){
  const origin=req.headers.get("origin");
  if(origin && origin!==new URL(req.url).origin) throw new Error("Please submit this request from the storefront.");
}

export async function productRow(id:string,archived?:number){
  const q=new URLSearchParams({select:"*",id:"eq."+id,limit:"1"});
  if(archived!==undefined) q.set("archived","eq."+archived);
  const rows=await readResponse<Array<{id:string;data:unknown;archived:number}>>(await request("rest","products?"+q));
  return rows[0]||null;
}

export async function productRows(archived:number){
  const q=new URLSearchParams({select:"data",archived:"eq."+archived,order:"id.asc"});
  return await readResponse<Array<{data:unknown}>>(await request("rest","products?"+q));
}

export async function upsertProducts(products:Array<{id:string;data:unknown;archived:number}>){
  if(!products.length) return;
  await readResponse(await request("rest","products?on_conflict=id",{
    method:"POST",
    headers:{"Content-Type":"application/json",Prefer:"resolution=merge-duplicates"},
    body:JSON.stringify(products)
  }));
}

export async function setProductArchived(id:string,archived:number){
  const q=new URLSearchParams({id:"eq."+id});
  await readResponse(await request("rest","products?"+q,{
    method:"PATCH",
    headers:{"Content-Type":"application/json",Prefer:"return=minimal"},
    body:JSON.stringify({archived})
  }));
}

export async function deleteRecord(id:string){
  const q=new URLSearchParams({id:"eq."+id});
  await readResponse(await request("rest","records?"+q,{method:"DELETE",headers:{Prefer:"return=minimal"}}));
}

export function supabasePublicStorageUrl(path:string){
  return config().url+"/storage/v1/object/public/"+PRODUCT_IMAGE_BUCKET+"/"+path.replace(/^\//,"");
}

export async function ensureProductImageBucket(){
  const existing=await request("storage","bucket/"+PRODUCT_IMAGE_BUCKET);
  if(existing.ok) return;
  if(existing.status!==404) await readResponse(existing);
  const created=await request("storage","bucket",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({id:PRODUCT_IMAGE_BUCKET,name:PRODUCT_IMAGE_BUCKET,public:true,file_size_limit:5*1024*1024,allowed_mime_types:["image/jpeg","image/png","image/webp"]})
  });
  if(!created.ok && created.status!==409) await readResponse(created);
}

export async function uploadProductImage(path:string,data:Uint8Array,contentType:string){
  await ensureProductImageBucket();
  await readResponse(await request("storage","object/"+PRODUCT_IMAGE_BUCKET+"/"+path,{
    method:"POST",
    headers:{"Content-Type":contentType,"Cache-Control":"public,max-age=31536000,immutable","x-upsert":"false"},
    body:new Blob([data.buffer as ArrayBuffer],{type:contentType})
  }));
  return supabasePublicStorageUrl(path);
}

const isSql=(sql:string, fragment:string)=>sql.toLowerCase().replace(/\\s+/g," ").includes(fragment.toLowerCase());

function jsonValue(value:unknown){
  if(typeof value==="string"){try{return JSON.parse(value)}catch{return value}}
  return value;
}

type PreparedStatement = {
  run(): Promise<any>;
  first<T=any>(): Promise<T|null>;
  all<T=any>(): Promise<{results:T[]}>;
};
type DatabaseAdapter = {
  prepare(sql:string): { bind(...args:any[]): PreparedStatement };
  batch(statements:Array<{run():Promise<any>}>): Promise<any[]>;
};

async function runPrepared(sql:string,args:any[],mode:"run"|"first"|"all"):Promise<any>{
  const s=sql.toLowerCase().replace(/\\s+/g," ").trim();

  if(s.startsWith("delete from records where id=?")){
    await deleteRecord(String(args[0]||""));
    return {};
  }

  if(s.startsWith("insert into records")){
    await save(String(args[0]),String(args[1]),String(args[2]),jsonValue(args[3]));
    return {};
  }

  if(s.startsWith("update records set data=?")){
    const existing=await row(String(args[2]));
    if(!existing) return {};
    await save(existing.id,existing.kind,existing.owner,jsonValue(args[0]));
    return {};
  }

  if(s.startsWith("select data from products where archived=")){
    const archived=s.includes("archived=1")?1:0;
    const rows=await productRows(archived);
    return {results:rows.map(r=>({data:typeof r.data==="string"?r.data:JSON.stringify(r.data)}))};
  }

  if(s.startsWith("select data from products where id=?")){
    const id=String(args[0]);
    const archived=s.includes("archived=1")?1:s.includes("archived=0")?0:undefined;
    const r=await productRow(id,archived);
    if(mode==="all") return {results:r?[{data:typeof r.data==="string"?r.data:JSON.stringify(r.data)}]:[]};
    return r?{data:typeof r.data==="string"?r.data:JSON.stringify(r.data)}:null;
  }

  if(s.startsWith("insert or ignore into products")){
    const productId=String(args[0]);
    const existing=await productRow(productId);
    if(!existing) await upsertProducts([{id:productId,data:jsonValue(args[1]),archived:Number(args[2]||0)}]);
    return {};
  }

  if(s.startsWith("insert into products")){
    await upsertProducts([{id:String(args[0]),data:jsonValue(args[1]),archived:Number(args[2]||0)}]);
    return {};
  }

  if(s.startsWith("update products set data=?")){
    const id=String(args[1]), existing=await productRow(id);
    if(!existing) return {};
    await upsertProducts([{id,data:jsonValue(args[0]),archived:Number(existing.archived||0)}]);
    return {};
  }

  if(s.startsWith("update products set archived=")){
    const archived=s.includes("archived=1")?1:0;
    await setProductArchived(String(args[0]),archived);
    return {};
  }

  throw new Error("Unsupported database operation in Vercel Supabase adapter: "+sql);
}

export function database(): DatabaseAdapter {
  return {
    prepare(sql:string){
      return {
        bind(...args:any[]){
          return {
            run:()=>runPrepared(sql,args,"run"),
            first:<T=any>():Promise<T|null>=>runPrepared(sql,args,"first"),
            all:<T=any>():Promise<{results:T[]}>=>runPrepared(sql,args,"all"),
          };
        }
      };
    },
    batch(statements:Array<{run():Promise<any>}>){
      return Promise.all(statements.map(statement=>statement.run()));
    }
  };
}
