export type MotionPreset='none'|'fade'|'slide'|'scale'|'parallax'|'horizontal'|'sticky'|'reveal'|'product-reveal';
export type HomepageSectionType='hero'|'ticker'|'category-showcase'|'product-carousel'|'product-grid'|'collection-banner'|'full-image'|'video'|'editorial'|'testimonials'|'promo'|'newsletter'|'countdown'|'recommendations'|'best-sellers'|'new-arrivals'|'final-cta';

export type HomepageSection={
  id:string;
  type:HomepageSectionType;
  kicker:string;
  title:string;
  description:string;
  ctaLabel:string;
  ctaHref:string;
  secondaryCtaLabel:string;
  secondaryCtaHref:string;
  image:string;
  mobileImage:string;
  category:string;
  collectionId:string;
  productIds:string[];
  theme:'paper'|'ink'|'forest'|'sand'|'white';
  layout:'standard'|'split'|'immersive'|'sticky'|'marquee'|'grid';
  motion:MotionPreset;
  visible:boolean;
  sortOrder:number;
  scheduleStart:string;
  scheduleEnd:string;
};

export type Collection={
  id:string;
  title:string;
  description:string;
  coverImage:string;
  productIds:string[];
  layout:'editorial'|'grid'|'split';
  visible:boolean;
  sortOrder:number;
  scheduleStart:string;
  scheduleEnd:string;
};

export type Campaign={
  id:string;
  name:string;
  title:string;
  description:string;
  desktopImage:string;
  mobileImage:string;
  ctaLabel:string;
  ctaHref:string;
  productIds:string[];
  category:string;
  discountLabel:string;
  startDate:string;
  endDate:string;
  status:'draft'|'scheduled'|'live'|'ended';
};

export type CategoryContent={
  id:string;
  slug:string;
  title:string;
  description:string;
  image:string;
  bannerImage:string;
  visible:boolean;
  sortOrder:number;
};

const section=(x:Partial<HomepageSection>&Pick<HomepageSection,'id'|'type'|'title'|'sortOrder'>):HomepageSection=>({
  id:x.id,
  type:x.type,
  title:x.title,
  sortOrder:x.sortOrder,
  kicker:x.kicker||'',
  description:x.description||'',
  ctaLabel:x.ctaLabel||'Shop now',
  ctaHref:x.ctaHref||'#collection',
  secondaryCtaLabel:x.secondaryCtaLabel||'',
  secondaryCtaHref:x.secondaryCtaHref||'',
  image:x.image||'',
  mobileImage:x.mobileImage||'',
  category:x.category||'All',
  collectionId:x.collectionId||'',
  productIds:x.productIds||[],
  theme:x.theme||'paper',
  layout:x.layout||'standard',
  motion:x.motion||'fade',
  visible:x.visible!==false,
  scheduleStart:x.scheduleStart||'',
  scheduleEnd:x.scheduleEnd||'',
});

export const defaultHomepageSections:HomepageSection[]=[
  section({id:'hero',type:'hero',sortOrder:10,kicker:'NEW CHAPTER · EVERYDAY EDIT',title:'Wear your next chapter.',description:'Clothing, bags and footwear chosen for the different versions of your day.',ctaLabel:'Shop the edit',ctaHref:'#collection',secondaryCtaLabel:'See what is trending',secondaryCtaHref:'#trending',image:'/images/hero.jpg',theme:'ink',layout:'split',motion:'parallax'}),
  section({id:'discovery',type:'ticker',sortOrder:20,title:'Shop your way',description:'Save favourites · discover new drops · move at your own pace',theme:'sand',layout:'marquee',motion:'none'}),
  section({id:'categories',type:'category-showcase',sortOrder:30,kicker:'SHOP YOUR STYLE',title:'A little something for every plan.',description:'From everyday layers to the pieces that finish the look.',ctaLabel:'Explore all categories',ctaHref:'#collection',theme:'paper',layout:'split',motion:'reveal'}),
  section({id:'trending',type:'product-carousel',sortOrder:40,kicker:'TRENDING NOW',title:'The pieces people are picking up.',description:'High-interest favourites, surfaced without the noise.',ctaLabel:'Shop all trending',ctaHref:'#collection',theme:'white',layout:'standard',motion:'product-reveal',productIds:['tz-001','tz-002','tz-003','tz-004']}),
  section({id:'editorial',type:'editorial',sortOrder:50,kicker:'THE WEEKEND EDIT',title:'Make room for somewhere new.',description:'Easy silhouettes, useful carry and a little energy for the days that refuse to stay still.',ctaLabel:'Shop the weekend edit',ctaHref:'#collection',image:'/images/bag.jpg',theme:'forest',layout:'sticky',motion:'sticky'}),
  section({id:'new-arrivals',type:'new-arrivals',sortOrder:60,kicker:'FRESH ARRIVALS',title:'New in, before everyone else finds it.',description:'Recently added pieces with just enough edge.',ctaLabel:'See new arrivals',ctaHref:'#collection',theme:'paper',layout:'grid',motion:'reveal',productIds:['tz-004','tz-005','tz-006']}),
  section({id:'best-sellers',type:'best-sellers',sortOrder:70,kicker:'BEST SELLERS',title:'Reliable favourites. Better together.',description:'Start with the products that earn their place in the rotation.',ctaLabel:'Shop best sellers',ctaHref:'#collection',theme:'white',layout:'grid',motion:'product-reveal',productIds:['tz-001','tz-002','tz-005']}),
  section({id:'offer',type:'promo',sortOrder:80,kicker:'THE TREND-ZEE PROMISE',title:'Your first edit, made easier.',description:'Save your favourites, keep your bag together and get clear delivery and return information before a paid checkout goes live.',ctaLabel:'Build your bag',ctaHref:'#collection',secondaryCtaLabel:'Read the details',secondaryCtaHref:'#trust',theme:'sand',layout:'split',motion:'fade',image:'/images/tee.jpg'}),
  section({id:'final',type:'final-cta',sortOrder:90,kicker:'KEEP MOVING',title:'Your next favourite is waiting.',description:'Take another look, save what catches your eye, and shop when it feels right.',ctaLabel:'Start exploring',ctaHref:'#collection',theme:'ink',layout:'immersive',motion:'reveal',image:'/images/slide.jpg'}),
];

export const defaultCollections:Collection[]=[
  {id:'weekend-edit',title:'Weekend Edit',description:'Easy pieces for the days that keep changing plans.',coverImage:'/images/bag.jpg',productIds:['tz-001','tz-002','tz-003','tz-005'],layout:'editorial',visible:true,sortOrder:10,scheduleStart:'',scheduleEnd:''},
  {id:'everyday-essentials',title:'Everyday Essentials',description:'The dependable layer, carry and comfort rotation.',coverImage:'/images/tee.jpg',productIds:['tz-001','tz-003','tz-006'],layout:'grid',visible:true,sortOrder:20,scheduleStart:'',scheduleEnd:''},
  {id:'after-hours',title:'After Hours',description:'A little more statement for evenings worth remembering.',coverImage:'/images/shirt.jpg',productIds:['tz-004','tz-002'],layout:'split',visible:true,sortOrder:30,scheduleStart:'',scheduleEnd:''},
];

export const defaultCampaigns:Campaign[]=[
  {id:'always-on',name:'Always On',title:'Discover what is next.',description:'The core Trend-Zee edit.',desktopImage:'/images/hero.jpg',mobileImage:'/images/hero.jpg',ctaLabel:'Shop now',ctaHref:'#collection',productIds:['tz-001','tz-002','tz-003'],category:'All',discountLabel:'',startDate:'',endDate:'',status:'live'},
  {id:'welcome-edit',name:'Welcome Edit',title:'Your first look starts here.',description:'Build a bag around pieces you will actually wear.',desktopImage:'/images/slide.jpg',mobileImage:'/images/slide.jpg',ctaLabel:'Explore the edit',ctaHref:'#collection',productIds:['tz-005','tz-006'],category:'Shoes & Sandals',discountLabel:'',startDate:'',endDate:'',status:'scheduled'},
];

export const defaultCategories:CategoryContent[]=[
  {id:'clothing',slug:'clothing',title:'Clothing',description:'Everyday layers with a little more personality.',image:'/images/tee.jpg',bannerImage:'/images/shirt.jpg',visible:true,sortOrder:10},
  {id:'bags',slug:'bags',title:'Bags',description:'Carry what the day asks for.',image:'/images/bag.jpg',bannerImage:'/images/bag.jpg',visible:true,sortOrder:20},
  {id:'footwear',slug:'footwear',title:'Shoes & Sandals',description:'A better step changes the whole day.',image:'/images/sneaker.jpg',bannerImage:'/images/sandal.jpg',visible:true,sortOrder:30},
  {id:'slippers',slug:'slippers',title:'Slippers',description:'Off-duty, without the off-brand feeling.',image:'/images/slide.jpg',bannerImage:'/images/slide.jpg',visible:true,sortOrder:40},
];

export function isScheduleActive(start:string,end:string,now=new Date()):boolean{
  const time=now.getTime();
  if(start){const t=new Date(start).getTime();if(Number.isFinite(t)&&time<t)return false;}
  if(end){const t=new Date(end).getTime();if(Number.isFinite(t)&&time>t)return false;}
  return true;
}

export function slugify(value:string){return value.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');}
