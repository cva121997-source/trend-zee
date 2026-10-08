export type RuntimeEnv = Record<string, any>;

const root = globalThis as typeof globalThis & {
  __TREND_ZEE_ENV__?: RuntimeEnv;
};

export function setRuntimeEnv(env:unknown){
  root.__TREND_ZEE_ENV__ = (env && typeof env === 'object') ? env as RuntimeEnv : {};
}

export function runtimeEnv():RuntimeEnv{
  return root.__TREND_ZEE_ENV__ || {};
}

export function envValue(name:string){
  const runtime=runtimeEnv();
  const value=runtime[name];
  if(value!==undefined && value!==null && String(value)!=='') return String(value);
  if(typeof process!=='undefined'){
    const processValue=process.env[name];
    if(processValue!==undefined && processValue!==null) return String(processValue);
  }
  return '';
}
