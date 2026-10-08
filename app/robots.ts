import type { MetadataRoute } from 'next';
export default function robots():MetadataRoute.Robots{return{rules:[{userAgent:'*',allow:'/',disallow:['/admin','/api/']}],sitemap:'https://trend-zee.vercel.app/sitemap.xml'};}
