export async function api(action:string,data:Record<string,unknown>={}){const r=await fetch('/api/store',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...data})});const json:any=await r.json();if(!r.ok)throw new Error(json.error||'Something went wrong. Please try again.');return json;}

