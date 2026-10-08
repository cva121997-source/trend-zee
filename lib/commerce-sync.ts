import {database,digest} from '@/lib/store-server';
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
    .bind(addressId,customerId,clean(address.label,60)||'Delivery',clean(address.name,100),clean(address.mobile,30),clean(address.address,1000),null,clean(address.city,100),clean(address.state,100),clean(address.pincode,6),'India',address.isDefault?1:0,address.createdAt||now,now).run();
}

export async function syncProductVariants(product:any){
  const db=database(),now=new Date().toISOString(),variants=product.variantStock&&typeof product.variantStock==='object'?product.variantStock:{};
  const activeKeys=Object.keys(variants);
  const existing=await db.prepare('SELECT id,option_data FROM product_variants WHERE product_id=?').bind(product.id).all<any>();
  for(const row of existing.results||[]){
    let key='';try{key=JSON.parse(row.option_data||'{}').key||'';}catch{}
    if(!activeKeys.includes(key))await db.prepare('UPDATE product_variants SET archived=1,updated_at=? WHERE id=?').bind(now,row.id).run();
  }
  for(const [key,stock] of Object.entries(variants)){
    const variantId='VAR-'+await digest(product.id+'::'+key);
    const [size,color]=String(key).split('::');
    await db.prepare(`INSERT INTO product_variants (id,product_id,sku,barcode,size,color,option_data,price,mrp,stock,low_stock_threshold,archived,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET sku=excluded.sku,size=excluded.size,color=excluded.color,option_data=excluded.option_data,price=excluded.price,mrp=excluded.mrp,stock=excluded.stock,archived=0,updated_at=excluded.updated_at`)
      .bind(variantId,product.id,product.sku||null,null,size||null,color||null,JSON.stringify({key}),n(product.price),product.mrp||null,n(stock),5,0,now,now).run();
  }
}

export async function syncOrder(orderId:string,owner:string,order:any){
  const db=database(),now=new Date().toISOString();
  await db.prepare(`INSERT INTO orders (id,customer_id,status,payment_status,currency,subtotal,discount,shipping,tax,total,coupon_code,payment_intent_id,courier,tracking_number,notes,placed_at,paid_at,delivered_at,cancelled_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET status=excluded.status,payment_status=excluded.payment_status,subtotal=excluded.subtotal,discount=excluded.discount,shipping=excluded.shipping,tax=excluded.tax,total=excluded.total,coupon_code=excluded.coupon_code,payment_intent_id=excluded.payment_intent_id,courier=excluded.courier,tracking_number=excluded.tracking_number,notes=excluded.notes,paid_at=excluded.paid_at,delivered_at=excluded.delivered_at,cancelled_at=excluded.cancelled_at,updated_at=excluded.updated_at`)
    .bind(orderId,String(owner).startsWith('guest:')?null:owner,clean(order.status,50),clean(order.paymentStatus,50), 'INR',n(order.subtotal),n(order.discount),n(order.shipping),n(order.tax),n(order.total),clean(order.coupon,50)||null,clean(order.paymentIntentId,150)||null,clean(order.courier,120)||null,clean(order.tracking,150)||null,clean(order.note,1000)||null,order.created||now,order.paidAt||null,order.deliveredAt||null,order.cancelledAt||null,order.created||now,now).run();
  await db.prepare('DELETE FROM order_items WHERE order_id=?').bind(orderId).run();
  for(const item of Array.isArray(order.items)?order.items:[]){
    await db.prepare('INSERT INTO order_items (id,order_id,product_id,variant_id,product_name,sku,size,color,quantity,unit_price,mrp,line_total) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind('OI-'+crypto.randomUUID(),orderId,item.productId,null,clean(item.name,180),clean(item.sku,80)||null,clean(item.size,40)||null,clean(item.color,80)||null,n(item.quantity),n(item.price),item.mrp||null,n(item.price)*n(item.quantity)).run();
  }
}

export async function syncInventoryMovement(movement:any){
  const db=database(),now=movement.at||new Date().toISOString();
  await db.prepare('INSERT INTO inventory_movements (id,product_id,variant_id,before_qty,after_qty,delta_qty,reason,actor_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(clean(movement.id||'INV-'+crypto.randomUUID(),120),clean(movement.productId,120),clean(movement.variantId,120)||null,n(movement.before),n(movement.after),n(movement.adjustment),clean(movement.reason,500)||'Adjustment',clean(movement.actorId,120)||null,now).run();
}

export async function syncCoupon(coupon:any){
  if(!coupon?.code)return;
  const now=new Date().toISOString();
  await database().prepare(`INSERT INTO coupons (code,discount_type,percent,fixed_amount,min_order,max_discount,product_ids,categories,usage_limit,per_user_limit,starts_at,ends_at,active,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(code) DO UPDATE SET discount_type=excluded.discount_type,percent=excluded.percent,fixed_amount=excluded.fixed_amount,min_order=excluded.min_order,max_discount=excluded.max_discount,product_ids=excluded.product_ids,categories=excluded.categories,usage_limit=excluded.usage_limit,per_user_limit=excluded.per_user_limit,starts_at=excluded.starts_at,ends_at=excluded.ends_at,active=excluded.active,updated_at=excluded.updated_at`)
    .bind(clean(coupon.code,30).toUpperCase(),coupon.discountType==='fixed'?'fixed':'percent',n(coupon.percent),n(coupon.fixedAmount),n(coupon.minOrder),n(coupon.maxDiscount),JSON.stringify(Array.isArray(coupon.productIds)?coupon.productIds:[]),JSON.stringify(Array.isArray(coupon.categories)?coupon.categories:[]),n(coupon.usageLimit),n(coupon.perUserLimit),clean(coupon.startsAt,40)||null,clean(coupon.expires,40),coupon.active?1:0,coupon.createdAt||now,now).run();
}

export async function syncReview(review:any){
  if(!review?.id||!review?.productId)return;
  const now=new Date().toISOString();
  await database().prepare(`INSERT INTO reviews (id,product_id,customer_id,order_id,rating,title,body,image_urls,helpful_count,status,moderation_note,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET rating=excluded.rating,title=excluded.title,body=excluded.body,image_urls=excluded.image_urls,helpful_count=excluded.helpful_count,status=excluded.status,moderation_note=excluded.moderation_note,updated_at=excluded.updated_at`)
    .bind(clean(review.id,120),clean(review.productId,120),String(review.owner||'').startsWith('guest:')?null:clean(review.owner,120)||null,clean(review.orderId,120)||null,n(review.rating),clean(review.title,120)||null,clean(review.message,3000),JSON.stringify(Array.isArray(review.imageUrls)?review.imageUrls:[]),n(review.helpfulCount),clean(review.status,40).toLowerCase()||'pending',clean(review.moderationNote,2000)||null,review.created||now,now).run();
}

export async function syncSupportTicket(ticket:any){
  if(!ticket?.id)return;
  const now=new Date().toISOString();
  await database().prepare(`INSERT INTO support_tickets (id,customer_id,order_id,category,subject,message,status,internal_note,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET category=excluded.category,subject=excluded.subject,message=excluded.message,status=excluded.status,internal_note=excluded.internal_note,updated_at=excluded.updated_at`)
    .bind(clean(ticket.id,120),String(ticket.owner||'').startsWith('guest:')?null:clean(ticket.owner,120)||null,clean(ticket.orderId,120)||null,clean(ticket.category,80)||'General',clean(ticket.subject,160),clean(ticket.message,3000),clean(ticket.status,50)||'New',clean(ticket.internalNote,3000)||null,ticket.created||now,now).run();
}

export async function syncReturnCase(item:any){
  if(!item?.id||!item?.orderId)return;
  const now=new Date().toISOString();
  await database().prepare(`INSERT INTO returns (id,order_id,customer_id,reason,status,refund_amount,internal_note,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET status=excluded.status,refund_amount=excluded.refund_amount,internal_note=excluded.internal_note,updated_at=excluded.updated_at`)
    .bind(clean(item.id,120),clean(item.orderId,120),String(item.owner||'').startsWith('guest:')?null:clean(item.owner,120)||null,clean(item.reason,1000),clean(item.status,50)||'Requested',n(item.refundAmount),clean(item.internalNote,3000)||null,item.created||now,now).run();
}

export async function syncAdminUser(user:any){
  if(!user?.id||!user?.email)return;
  const now=new Date().toISOString();
  await database().prepare(`INSERT INTO admin_users (id,email,display_name,role,active,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET email=excluded.email,display_name=excluded.display_name,role=excluded.role,active=excluded.active,updated_at=excluded.updated_at`)
    .bind(clean(user.id,120),clean(user.email,200).toLowerCase(),clean(user.displayName,120)||clean(user.username,120),clean(user.role,40)||'Owner',user.active===false?0:1,user.createdAt||now,now).run();
}

export async function removeAdminUser(userId:string){
  if(!userId)return;
  await database().prepare('DELETE FROM admin_users WHERE id=?').bind(userId).run();
}
