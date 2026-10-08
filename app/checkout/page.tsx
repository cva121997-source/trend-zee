'use client';

import {useEffect,useState} from 'react';
import {ArrowLeft,LockKeyhole,ShieldCheck,ShoppingBag,Truck} from 'lucide-react';
import {Toaster,toast} from 'sonner';
import {money} from '@/lib/catalog';
import {api} from '@/lib/client';

const blank={name:'',email:'',mobile:'',address:'',city:'',pincode:'',location:''};

export default function CheckoutPage(){
 const [data,setData]=useState<any>(null);const [profile,setProfile]=useState(blank);const [consent,setConsent]=useState(false);const [coupon,setCoupon]=useState('');const [discount,setDiscount]=useState(0);const [shippingMethods,setShippingMethods]=useState<any[]>([]);const [shippingId,setShippingId]=useState('');const [shipping,setShipping]=useState(0);const [tax,setTax]=useState(0);const [stage,setStage]=useState(1);const [orderId,setOrderId]=useState('');const [provider,setProvider]=useState('preview');const [payment,setPayment]=useState<any>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');

 useEffect(()=>{(async()=>{try{const r=await fetch('/api/store');const d:any=await r.json();if(!r.ok)throw new Error(d.error);setData(d);setProfile({...blank,...(d.profile||{})});}catch(e){setError((e as Error).message)}})()},[]);

 const items=data?.cart?.items||[];const products=data?.products||[];const subtotal=items.reduce((s:number,i:any)=>s+(products.find((p:any)=>p.id===i.productId)?.price||i.price||0)*i.quantity,0);const total=Math.max(0,subtotal-discount+shipping+tax);

 useEffect(()=>{(async()=>{if(!/^\d{6}$/.test(profile.pincode)||!data)return;try{
   const net=Math.max(0,subtotal-discount);
   const [shippingResponse,taxResponse]=await Promise.all([
     fetch('/api/shipping/quote?pincode='+encodeURIComponent(profile.pincode)+'&subtotal='+net),
     fetch('/api/tax/quote?pincode='+encodeURIComponent(profile.pincode)+'&city='+encodeURIComponent(profile.city)+'&subtotal='+net),
   ]);
   const sd:any=await shippingResponse.json();const td:any=await taxResponse.json();
   const methods=shippingResponse.ok?(sd.methods||[]):[];setShippingMethods(methods);const first=methods.find((m:any)=>m.id===shippingId)||methods[0];
   if(first){setShippingId(first.id);setShipping(Number(first.amount)||0)}else{setShippingId('');setShipping(0)}
   setTax(taxResponse.ok?Number(td.amount)||0:0);
 }catch{setShippingMethods([]);setShippingId('');setShipping(0);setTax(0)}})()},[profile.pincode,profile.city,subtotal,discount,data]);

 useEffect(()=>{if(provider!=='razorpay')return;const existing=document.querySelector('script[data-razorpay]');if(existing)return;const script=document.createElement('script');script.src='https://checkout.razorpay.com/v1/checkout.js';script.async=true;script.dataset.razorpay='1';document.body.appendChild(script);},[provider]);

 async function applyCoupon(){try{const d=await api('coupon',{code:coupon});setDiscount(d.discount||0);toast.success('Coupon applied')}catch(e){setDiscount(0);toast.error((e as Error).message)}}

 async function createOrder(){
  setBusy(true);
  try{
   const r:any=await api('order',{profile,consent,method:'Razorpay',coupon,shippingId,note:'',key:crypto.randomUUID()});
   setOrderId(r.id);if(Number.isFinite(Number(r.total)))setTax(Math.max(0,Number(r.total)-Number(r.subtotal||subtotal)+Number(r.discount||0)-Number(r.shipping||shipping)));
   const intent=await fetch('/api/payments/create-intent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId:r.id})});
   const d:any=await intent.json();
   if(!intent.ok){setProvider('preview');setStage(2);toast.message(d.error||'Order request saved as unpaid.');return;}
   setPayment(d);setProvider(d.provider||'preview');setStage(2);
  }catch(e){toast.error((e as Error).message)}finally{setBusy(false)}
 }

 async function payRazorpay(){
  if(!payment?.publicKeyId||!payment?.providerOrderId){toast.error('Payment session is incomplete.');return}
  const Razorpay=(window as any).Razorpay;
  if(!Razorpay){toast.error('Payment checkout is still loading. Please try again.');return}
  setBusy(true);
  const options={
    key:payment.publicKeyId,amount:payment.amount*100,currency:'INR',name:'Trend-Zee',description:'Trend-Zee order '+orderId,order_id:payment.providerOrderId,prefill:{name:profile.name,email:profile.email,contact:profile.mobile},
    theme:{color:'#253d30'},
    handler:async(response:any)=>{
      try{
        const r=await fetch('/api/payments/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId,razorpayOrderId:response.razorpay_order_id,razorpayPaymentId:response.razorpay_payment_id,razorpaySignature:response.razorpay_signature})});
        const d:any=await r.json();if(!r.ok)throw new Error(d.error||'Payment verification failed.');
        toast.success('Payment confirmed');location.href='/account?tab=orders';
      }catch(e){toast.error((e as Error).message)}finally{setBusy(false)}
    },
    modal:{ondismiss:()=>setBusy(false)},
  };
  new Razorpay(options).open();
 }

 async function mockPay(){setBusy(true);try{const r=await fetch('/api/payments/mock-complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId})});const d:any=await r.json();if(!r.ok)throw new Error(d.error);toast.success('Demo payment completed');location.href='/account?tab=orders'}catch(e){toast.error((e as Error).message)}finally{setBusy(false)}}

 if(error)return <main className="checkout-page-shell"><Toaster richColors/><a className="text-button" href="/"><ArrowLeft size={16}/> Back to shop</a><div className="empty"><h1>Checkout unavailable.</h1><p>{error}</p></div></main>;
 if(!data)return <div className="store-loading"><span className="logo">TREND ZEE</span><p>Preparing secure checkout…</p></div>;
 if(!items.length)return <main className="checkout-page-shell"><Toaster richColors/><a className="text-button" href="/shop"><ArrowLeft size={16}/> Shop</a><div className="empty"><ShoppingBag size={36}/><h1>Your bag is empty.</h1><a className="button" href="/shop">Explore products</a></div></main>;

 return <><Toaster richColors/><header className="store-header"><a className="logo" href="/">TREND ZEE<sup>®</sup></a><span className="checkout-lock"><LockKeyhole size={15}/> Secure checkout</span></header><main className="checkout-page-shell">
  <div className="product-page-top"><a className="text-button" href="/"><ArrowLeft size={16}/> Keep shopping</a><span>Step {stage} of 2</span></div>
  <div className="checkout-grid"><section className="checkout-main">
   <div className="checkout-trust"><span><ShieldCheck size={16}/> Trusted checkout flow</span><span><Truck size={16}/> Delivery details verified before payment</span></div>
   {stage===1?<form className="checkout-card" onSubmit={e=>{e.preventDefault();if(consent)createOrder()}}>
    <span className="eyebrow">01 · DELIVERY</span><h1>Where should we send it?</h1>
    <div className="form-grid">
      <label>Full name<input required value={profile.name} onChange={e=>setProfile({...profile,name:e.target.value})}/></label>
      <label>Email<input type="email" required value={profile.email} onChange={e=>setProfile({...profile,email:e.target.value})}/></label>
      <label>Mobile<input required value={profile.mobile} onChange={e=>setProfile({...profile,mobile:e.target.value})}/></label>
      <label>PIN code<input inputMode="numeric" required maxLength={6} value={profile.pincode} onChange={e=>setProfile({...profile,pincode:e.target.value.replace(/\D/g,'')})}/></label>
      <label className="wide">Address<input required value={profile.address} onChange={e=>setProfile({...profile,address:e.target.value})}/></label>
      <label>City<input required value={profile.city} onChange={e=>setProfile({...profile,city:e.target.value})}/></label>
    </div>
    <div className="checkout-coupon"><input value={coupon} onChange={e=>{setCoupon(e.target.value.toUpperCase());setDiscount(0)}} placeholder="Promo code"/><button type="button" className="button outline compact" onClick={applyCoupon} disabled={!coupon}>Apply</button></div>
    {discount>0&&<p className="coupon-success">You save {money(discount)}.</p>}
    <div className="shipping-choice"><b>Delivery method</b>{shippingMethods.length?shippingMethods.map((m:any)=><label key={m.id} className={shippingId===m.id?'selected':''}><input type="radio" name="shipping" checked={shippingId===m.id} onChange={()=>{setShippingId(m.id);setShipping(Number(m.amount)||0)}}/><span><strong>{m.label}</strong><small>{m.eta} · {Number(m.amount)>0?money(m.amount):'Free'}</small></span></label>):<p className="notice">Enter a valid six-digit PIN to load delivery options.</p>}</div>
    <label className="check-line"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>I agree to save my delivery details for this checkout and allow Trend-Zee to contact me about it.</span></label>
    <button className="button full" disabled={busy||!consent}>{busy?'Saving…':'Continue to payment'}</button>
   </form>:<section className="checkout-card">
    <span className="eyebrow">02 · PAYMENT</span><h1>Finish your purchase.</h1>
    {provider==='razorpay'?<><p className="notice">You’ll complete payment in Razorpay’s secure checkout. Trend-Zee only marks the order paid after server-side signature verification.</p><div className="checkout-order-id"><b>{orderId}</b><small>{money(payment?.amount||total)} · INR</small></div><button className="button full" disabled={busy} onClick={payRazorpay}>{busy?'Opening secure payment…':'Pay securely'}</button><p className="small muted">Cards, UPI and other methods are presented by your configured Razorpay account.</p></>:provider==='mock'?<><p className="notice">Development payment mode is enabled. No real money is moved.</p><div className="checkout-order-id"><b>{orderId}</b><small>{money(payment?.amount||total)} · INR</small></div><button className="button full" disabled={busy} onClick={mockPay}>{busy?'Processing…':'Complete demo payment'}</button></>:<><p className="notice">No live payment provider is configured. The order remains clearly marked unpaid.</p><div className="checkout-order-id"><b>{orderId}</b><small>{money(total)} · INR</small></div><div className="notice">Set PAYMENT_PROVIDER=razorpay and the Razorpay credentials to enable live capture and verified webhooks.</div></>}
    <button className="text-button" onClick={()=>setStage(1)}>Edit delivery details</button>
   </section>}
  </section>
  <aside className="checkout-summary"><span className="eyebrow">ORDER SUMMARY</span><h2>{items.length} item{items.length===1?'':'s'}</h2>{items.map((i:any)=>{const p=products.find((x:any)=>x.id===i.productId);return <div className="checkout-line" key={i.productId+i.size+i.color}><img src={p?.images?.[0]} alt=""/><span><b>{p?.name||i.name}</b><small>{i.color} · {i.size} · ×{i.quantity}</small></span><b>{money((p?.price||i.price||0)*i.quantity)}</b></div>})}<div className="checkout-total"><span>Subtotal</span><b>{money(subtotal)}</b></div>{discount>0&&<div className="checkout-total"><span>Discount</span><b>−{money(discount)}</b></div>}<div className="checkout-total"><span>Shipping</span><b>{shipping?money(shipping):'Free'}</b></div><div className="checkout-total"><span>Tax</span><b>{tax?money(tax):'Included / pending rules'}</b></div><div className="checkout-total total"><span>Total</span><b>{money(total)}</b></div><p className="small muted">Final totals are recalculated and validated on the server before payment. Tax/shipping providers can be connected through the environment configuration.</p></aside>
 </div></main></>;
}
