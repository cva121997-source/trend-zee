'use client';

import {useEffect} from 'react';
import {usePathname} from 'next/navigation';

const send=(eventName:string,data:Record<string,unknown>={})=>{
  try{
    const body=JSON.stringify({eventName,...data});
    if(navigator.sendBeacon){navigator.sendBeacon('/api/events',new Blob([body],{type:'application/json'}));}
    else void fetch('/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true});
  }catch{}
};

export default function AnalyticsBeacon(){
  const pathname=usePathname();
  useEffect(()=>{
    if(!pathname||pathname.startsWith('/admin'))return;
    const params=new URLSearchParams(window.location.search);const query=params.get('q')||'';const metadata={referrer:document.referrer||'',utmSource:params.get('utm_source')||'',utmMedium:params.get('utm_medium')||'',utmCampaign:params.get('utm_campaign')||''};
    send('page_view',{path:pathname,query,metadata});
    const productMatch=pathname.match(/^\/product\/([^/]+)/);
    if(productMatch)send('product_view',{path:pathname,productId:decodeURIComponent(productMatch[1])});
    if(pathname==='/shop')send('catalog_view',{path:pathname});
    if(pathname==='/search')send('search_view',{path:pathname,query});
    if(pathname==='/checkout')send('checkout_view',{path:pathname});
  },[pathname]);
  return null;
}
