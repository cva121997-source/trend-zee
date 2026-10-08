// Trend-Zee homepage CMS model. Pure TypeScript: safe in server and client runtimes.
export const SECTION_TYPES = [
  'hero','trustBar','categoryShowcase','productRow','productGrid','collectionBanner',
  'promoBanner','editorial','testimonials','countdown','recommendations','newsletter','cta'
] as const;
export type SectionType=(typeof SECTION_TYPES)[number];

export const SECTION_LABELS:Record<SectionType,{label:string;hint:string}>={
  hero:{label:'Hero',hint:'Full-screen opening with campaign imagery and primary calls to action.'},
  trustBar:{label:'Trust bar',hint:'Reassurance points such as delivery, returns and support.'},
  categoryShowcase:{label:'Category showcase',hint:'Image-led category tiles for discovery.'},
  productRow:{label:'Product carousel',hint:'Swipeable products, curated or sourced from the catalogue.'},
  productGrid:{label:'Product grid',hint:'A denser product discovery section for desktop and mobile.'},
  collectionBanner:{label:'Collection banner',hint:'Editorial banner that links into a curated collection.'},
  promoBanner:{label:'Campaign / offer',hint:'Promotional moment. Use urgency only for real deadlines.'},
  editorial:{label:'Editorial story',hint:'Image + story treatment for magazine-style storytelling.'},
  testimonials:{label:'Testimonials',hint:'Only publish genuine customer quotes.'},
  countdown:{label:'Countdown offer',hint:'Countdown to a real campaign deadline.'},
  recommendations:{label:'Recommended for you',hint:'Personalised or intent-based product recommendations.'},
  newsletter:{label:'Newsletter',hint:'Simple email capture with explicit consent.'},
  cta:{label:'Closing CTA',hint:'Strong final action after the shopping story.'},
};

export const ANIMATIONS=['none','fade','slide','scale','parallax','reveal'] as const;
export type Animation=(typeof ANIMATIONS)[number];
export const ANIMATION_LABELS:Record<Animation,string>={
  none:'None',fade:'Fade in',slide:'Slide up',scale:'Gentle zoom',parallax:'Parallax image',reveal:'Image reveal'
};
export type SectionItem={title:string;text:string;image:string;href:string};
export type ProductSource='manual'|'newest'|'bestSellers'|'recommended'|'category';

export type Section={
  id:string;type:SectionType;order:number;visible:boolean;startsAt:string;endsAt:string;
  eyebrow:string;title:string;subtitle:string;image:string;mobileImage:string;
  ctaLabel:string;ctaHref:string;secondaryLabel:string;secondaryHref:string;
  align:'left'|'center'|'right';theme:'light'|'dark'|'accent';
  animation:Animation;source:ProductSource;category:string;productIds:string[];items:SectionItem[];
};

const THEMES=['light','dark','accent'] as const;
const ALIGNS=['left','center','right'] as const;
const SOURCES=['manual','newest','bestSellers','recommended','category'] as const;
const text=(v:unknown,max:number)=>String(v??'').trim().slice(0,max);

export function safeImage(v:unknown){const s=text(v,2000);if(!s)return '';if(s.startsWith('/images/')||s.startsWith('/api/image/')||/^https:\/\/[^\s"'<>]+$/.test(s))return s;throw new Error('Images must be uploaded here, use a /images/ asset, or an https:// URL.');}
export function safeHref(v:unknown){const s=text(v,500);if(!s)return '';if(s.startsWith('/')||s.startsWith('#')||/^https:\/\/[^\s"'<>]+$/.test(s))return s;throw new Error('Links must start with /, # or https://');}
function safeDate(v:unknown){const s=text(v,40);if(!s)return '';const t=Date.parse(s);if(!Number.isFinite(t))throw new Error('Check the start/end dates.');return new Date(t).toISOString();}

export function cleanSection(raw:any,fallbackOrder:number):Section{
  const type=String(raw?.type||'') as SectionType;
  if(!SECTION_TYPES.includes(type))throw new Error('Choose a valid homepage section type.');
  const section:Section={
    id:/^[a-zA-Z0-9_-]{3,60}$/.test(String(raw?.id??''))?String(raw.id):'sec-'+crypto.randomUUID().slice(0,8),
    type,order:Number.isFinite(Number(raw?.order))?Number(raw.order):fallbackOrder,
    visible:raw?.visible!==false,startsAt:safeDate(raw?.startsAt),endsAt:safeDate(raw?.endsAt),
    eyebrow:text(raw?.eyebrow,80),title:text(raw?.title,160),subtitle:text(raw?.subtitle,700),
    image:safeImage(raw?.image),mobileImage:safeImage(raw?.mobileImage),
    ctaLabel:text(raw?.ctaLabel,50),ctaHref:safeHref(raw?.ctaHref),
    secondaryLabel:text(raw?.secondaryLabel,50),secondaryHref:safeHref(raw?.secondaryHref),
    align:(ALIGNS as readonly string[]).includes(raw?.align)?raw.align:'left',
    theme:(THEMES as readonly string[]).includes(raw?.theme)?raw.theme:'light',
    animation:(ANIMATIONS as readonly string[]).includes(raw?.animation)?raw.animation:'fade',
    source:(SOURCES as readonly string[]).includes(raw?.source)?raw.source:'manual',
    category:text(raw?.category,100),
    productIds:(Array.isArray(raw?.productIds)?raw.productIds:[]).map((x:unknown)=>text(x,100)).filter(Boolean).slice(0,24),
    items:(Array.isArray(raw?.items)?raw.items:[]).slice(0,8).map((i:any)=>({title:text(i?.title,100),text:text(i?.text,500),image:safeImage(i?.image),href:safeHref(i?.href)})).filter((i:SectionItem)=>i.title||i.text||i.image)
  };
  if(!section.title&&!['trustBar','categoryShowcase'].includes(type))throw new Error('Give this section a title.');
  if(section.startsAt&&section.endsAt&&section.endsAt<=section.startsAt)throw new Error('The end date must be after the start date.');
  if(type==='countdown'&&!section.endsAt)throw new Error('A countdown needs an end date.');
  return section;
}
export function isLive(s:Section,now=new Date().toISOString()){return s.visible&&(!s.startsAt||s.startsAt<=now)&&(!s.endsAt||s.endsAt>=now);}

const blank=():Omit<Section,'id'|'type'|'order'|'title'>=>({
  visible:true,startsAt:'',endsAt:'',eyebrow:'',subtitle:'',image:'',mobileImage:'',
  ctaLabel:'Shop now',ctaHref:'#collection',secondaryLabel:'',secondaryHref:'',
  align:'left',theme:'light',animation:'fade',source:'manual',category:'',productIds:[],items:[]
});
export function newSection(type:SectionType,order:number):Section{
  return {...blank(),id:'sec-'+Math.random().toString(36).slice(2,10),type,order,title:type==='trustBar'||type==='categoryShowcase'?'':SECTION_LABELS[type].label};
}

export const defaultSections:Section[]=[
 { ...blank(),id:'sec-hero',type:'hero',order:0,eyebrow:'NEW CHAPTER · EVERYDAY EDIT',title:'Wear your next chapter.',subtitle:'Clothing, bags and footwear chosen for the different versions of your day.',image:'/images/hero.jpg',ctaLabel:'Shop the edit',ctaHref:'#collection',secondaryLabel:'See what is trending',secondaryHref:'#sec-trending',theme:'dark',animation:'parallax',productIds:['tz-001']},
 { ...blank(),id:'sec-trust',type:'trustBar',order:1,title:'',items:[
  {title:'Clear order status',text:'Know exactly where your order stands.',image:'',href:''},
  {title:'Delivery visibility',text:'Courier and tracking when connected.',image:'',href:''},
  {title:'Easy returns',text:'Simple return requests for eligible orders.',image:'',href:''},
  {title:'Real support',text:'Help from the same account where orders live.',image:'',href:''},
 ],animation:'fade'},
 { ...blank(),id:'sec-categories',type:'categoryShowcase',order:2,eyebrow:'SHOP YOUR STYLE',title:'A little something for every plan.',items:[
  {title:'Clothing',text:'',image:'/images/tee.jpg',href:'/?category=Clothing'},
  {title:'Bags',text:'',image:'/images/bag.jpg',href:'/?category=Bags'},
  {title:'Shoes & Sandals',text:'',image:'/images/sneaker.jpg',href:'/?category=Shoes%20%26%20Sandals'},
  {title:'Slippers',text:'',image:'/images/slide.jpg',href:'/?category=Slippers'},
 ],animation:'slide'},
 { ...blank(),id:'sec-trending',type:'productRow',order:3,eyebrow:'TRENDING NOW',title:'The pieces people are picking up.',subtitle:'High-interest favourites surfaced without the noise.',source:'bestSellers',ctaLabel:'Shop all',ctaHref:'#collection',animation:'product-reveal' as Animation},
 { ...blank(),id:'sec-editorial',type:'editorial',order:4,eyebrow:'WEEKEND EDIT',title:'Make room for somewhere new.',subtitle:'Easy silhouettes, useful carry and a little energy for the days that refuse to stay still.',image:'/images/bag.jpg',ctaLabel:'Shop the weekend edit',ctaHref:'#collection',theme:'dark',animation:'reveal'},
 { ...blank(),id:'sec-new',type:'productGrid',order:5,eyebrow:'FRESH ARRIVALS',title:'New in, before everyone else finds it.',subtitle:'Recently added pieces with just enough edge.',source:'newest',animation:'reveal'},
 { ...blank(),id:'sec-recommend',type:'recommendations',order:6,eyebrow:'FOR YOU',title:'Keep browsing your way.',subtitle:'Recommended from your saved and recently viewed interests.',source:'recommended',animation:'slide'},
 { ...blank(),id:'sec-offer',type:'promoBanner',order:7,eyebrow:'THE TREND-ZEE PROMISE',title:'Your first edit, made easier.',subtitle:'Clear delivery, returns and order status before paid checkout goes live.',image:'/images/tee.jpg',ctaLabel:'Build your bag',ctaHref:'#collection',theme:'dark',animation:'fade'},
 { ...blank(),id:'sec-newsletter',type:'newsletter',order:8,eyebrow:'STAY IN THE KNOW',title:'The next drop lands here first.',subtitle:'Sign up for collection notes and launch updates. No dark patterns, no noisy inbox.',ctaLabel:'Join the list',ctaHref:'#newsletter',animation:'reveal'},
 { ...blank(),id:'sec-cta',type:'cta',order:9,title:'Your next favourite is waiting.',subtitle:'Take another look, save what catches your eye, and shop when it feels right.',ctaLabel:'Start exploring',ctaHref:'#collection',theme:'dark',align:'center',animation:'scale'}
];
