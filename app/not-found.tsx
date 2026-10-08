'use client';

import {Search} from 'lucide-react';

export default function NotFound(){
 return <main className="not-found-page"><span className="logo">TREND ZEE<sup>®</sup></span><span className="eyebrow">404 · LOST THE THREAD</span><h1>This page moved on.</h1><p>The product, collection or page you were looking for is no longer here.</p><div className="not-found-actions"><a className="button" href="/shop">Explore the collection <Search size={16}/></a><a className="text-button" href="/">Return home</a></div></main>;
}
