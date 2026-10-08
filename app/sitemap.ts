import type { MetadataRoute } from 'next';
import {seedProducts} from '@/lib/catalog';
export default function sitemap():MetadataRoute.Sitemap{
 const base='https://trend-zee.vercel.app';
 const routes=['/','/shop','/search','/wishlist','/account','/checkout'];
 const categories=['clothing','bags','shoes-and-sandals','slippers'];
 return routes.map(url=>({url:base+url,lastModified:new Date(),changeFrequency:'daily' as const,priority:url==='/'?1:.7}))
  .concat(categories.map(slug=>({url:base+'/category/'+slug,lastModified:new Date(),changeFrequency:'daily' as const,priority:.6})))
  .concat(seedProducts.map(p=>({url:base+'/product/'+p.id,lastModified:new Date(),changeFrequency:'weekly' as const,priority:.65})));
}
