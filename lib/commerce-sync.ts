import {database} from '@/lib/store-server';

const clean=(v:unknown,max=300)=>String(v??'').trim().slice(0,max);
const n=(v:unknown)=>Number.isFinite(Number(v))?Math.round(Number(v)):0;

export async function syncCustomer(customerId:string,profile:any){
  if(!customerId||!profile?.email)return;
  const now=new Date().toISOString();
  await database().prepare(`INSERT INTO customers (id,email,display_name,mobile,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET email=excluded.email,display_name=excluded.display_name,mobile=excluded.mobile,status=excluded.status,updated_at=excluded.updated_at`)
    .bind(customerId,clean(profile.email,200).toLowerCase(),clean(profile.name,100),clean(profile.mobile,30),'active',profile.createdAt||now,now).run();
}

export async function syncAddress(addressId:string,customerId:string,address:any){
  if(!addressId||!customerId||!address)return;
  const now=new Date().toISOString();
  await database().prepare(`INSERT INTO addresses (id,customer_id,label,name,mobile,address_line1,address_line2,city,state,pincode,country,is_default,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET label=excluded.label,name=excluded.name,mobile=excluded.mobile,address_line1=excluded.address_line1,address_line2=excluded.address_line2,city=excluded.city,state=excluded.state,pincode=excluded.pincode,is_default=excluded.is_default,updated_at=excluded.updated_at`)
    .bind(addressId,customerId,clean(address.label,60)||'Delivery',clean(address.name,100),clean(address.mobile,30),clean(address.address,1000),null,clean(address.city,100),clean(address.state,100),' '+clean(address.pincode,6), 'India',address.isDefault?1:0,address.createdAt||now,now).run();
}

export async function syncProductVariants(product:any){
  const db=database(),now=new Date().toISOString(),variants=product.variantStock&&typeof product.variantStock==='object'?product.variantStock:{};
  for(const [key,stock] of Object.entries(variants)){
    const [size,color]=String(key).split('::');const id='VAR-'+crypto.randomUUID();
    await db.prepare(`INSERT INTO product_variants (id,product_id,sku,barcode,size,color,option_data,price,mrp,stock,low_stock_threshold,archived,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(id,product.id,product.sku||null,null,size||null,color||null,JSON.stringify({key}),n(product.price),product.mrp||null,n(stock),5,0,now,now).run();
  }
}

export async function syncOrder(orderId:string,owner:string,order:any){
  const db=database(),now=new Date().toISOString();
  await db.prepare(`INSERT INTO orders (id,customer_id,status,payment_status,currency,subtotal,discount,shipping,tax,total,coupon_code,payment_intent_id,courier,tracking_number,notes,placed_at,paid_at,delivered_at,cancelled_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET status=excluded.status,payment_status=excluded.payment_status,subtotal=excluded.subtotal,discount=excluded.discount,shipping=excluded.shipping,tax=excluded.tax,total=excluded.total,coupon_code=excluded.coupon_code,payment_intent_id=excluded.payment_intent_id,courier=excluded.courier,tracking_number=excluded.tracking_number,notes=excluded.notes,paid_at=excluded.paid_at,delivered_at=excluded.delivered_at,cancelled_at=excluded.cancelled_at,updated_at=excluded.updated_at`)
    .bind(orderId,owner,clean(order.status,50),clean(order.paymentStatus,50), 'INR',n(order.subtotal),n(order.discount),n(order.shipping),n(order.tax),n(order.total),clean(order.coupon,50)||null,clean(order.paymentIntentId,150)||null,clean(order.courier,120)||null,clean(order.tracking,150)||null,clean(order.note,1000)||null,order.created||now,order.paidAt||null,order.deliveredAt||null,order.cancelledAt||null,order.created||now,now).run();
  await db.prepare('DELETE FROM order_items WHERE order_id=?').bind(orderId).run();
  for(const item of Array.isArray(order.items)?order.items:[]){
    await db.prepare('INSERT INTO order_items (id,order_id,product_id,variant_id,product_name,sku,size,color,quantity,unit_price,mrp,line_total) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind('OI-'+crypto.randomUUID(),orderId,item.productId,null,clean(item.name,180),clean(item.sku,80)||null,clean(item.size,40)||null,clean(item.color,80)||null,n(item.quantity),n(item.price),item.mrp||null,n(item.price)*n(item.quantity)).run();
  }
}
