-- Trend-Zee commerce core v2
-- Existing JSON-backed tables remain compatible; these typed tables provide the scalable production model.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT,
  mobile TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS customers_email ON customers(email);

CREATE TABLE IF NOT EXISTS addresses (
  id TEXT PRIMARY KEY NOT NULL,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Delivery',
  name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT,
  pincode TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'India',
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS addresses_customer ON addresses(customer_id);

CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY NOT NULL,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku TEXT,
  barcode TEXT,
  size TEXT,
  color TEXT,
  option_data TEXT NOT NULL DEFAULT '{}',
  price INTEGER,
  mrp INTEGER,
  stock INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS product_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS product_variants_stock ON product_variants(stock);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  image TEXT,
  banner_image TEXT,
  seo_title TEXT,
  seo_description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  visible INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  cover_image TEXT,
  layout TEXT NOT NULL DEFAULT 'grid',
  sort_order INTEGER NOT NULL DEFAULT 0,
  visible INTEGER NOT NULL DEFAULT 1,
  starts_at TEXT,
  ends_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS collection_products (
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(collection_id, product_id)
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  desktop_image TEXT,
  mobile_image TEXT,
  cta_label TEXT,
  cta_href TEXT,
  category TEXT,
  discount_label TEXT,
  start_date TEXT,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS homepage_sections (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  visible INTEGER NOT NULL DEFAULT 1,
  starts_at TEXT,
  ends_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS homepage_sections_order ON homepage_sections(sort_order, visible);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY NOT NULL,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id TEXT REFERENCES product_variants(id) ON DELETE RESTRICT,
  before_qty INTEGER NOT NULL,
  after_qty INTEGER NOT NULL,
  delta_qty INTEGER NOT NULL,
  reason TEXT NOT NULL,
  actor_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS inventory_movements_product ON inventory_movements(product_id, created_at);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY NOT NULL,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  subtotal INTEGER NOT NULL,
  discount INTEGER NOT NULL DEFAULT 0,
  shipping INTEGER NOT NULL DEFAULT 0,
  tax INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  coupon_code TEXT,
  shipping_address_id TEXT REFERENCES addresses(id) ON DELETE SET NULL,
  payment_intent_id TEXT,
  courier TEXT,
  tracking_number TEXT,
  notes TEXT,
  placed_at TEXT NOT NULL,
  paid_at TEXT,
  delivered_at TEXT,
  cancelled_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS orders_customer ON orders(customer_id, created_at);
CREATE INDEX IF NOT EXISTS orders_status ON orders(status, payment_status);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id TEXT REFERENCES product_variants(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  sku TEXT,
  size TEXT,
  color TEXT,
  quantity INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  mrp INTEGER,
  line_total INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS order_items_product ON order_items(product_id);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_payment_id TEXT,
  provider_order_id TEXT,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL,
  raw_event TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS payments_order ON payments(order_id);
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_payment ON payments(provider, provider_payment_id);

CREATE TABLE IF NOT EXISTS coupons (
  code TEXT PRIMARY KEY NOT NULL,
  discount_type TEXT NOT NULL DEFAULT 'percent',
  percent INTEGER,
  fixed_amount INTEGER,
  min_order INTEGER NOT NULL DEFAULT 0,
  max_discount INTEGER,
  product_ids TEXT NOT NULL DEFAULT '[]',
  categories TEXT NOT NULL DEFAULT '[]',
  usage_limit INTEGER NOT NULL DEFAULT 0,
  per_user_limit INTEGER NOT NULL DEFAULT 0,
  starts_at TEXT,
  ends_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id TEXT PRIMARY KEY NOT NULL,
  coupon_code TEXT NOT NULL REFERENCES coupons(code) ON DELETE RESTRICT,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS coupon_redemptions_coupon ON coupon_redemptions(coupon_code, created_at);
CREATE INDEX IF NOT EXISTS coupon_redemptions_customer ON coupon_redemptions(customer_id, coupon_code);

CREATE TABLE IF NOT EXISTS wishlists (
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY(customer_id, product_id)
);

CREATE TABLE IF NOT EXISTS recently_viewed (
  customer_id TEXT,
  session_id TEXT,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  viewed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS recently_viewed_customer ON recently_viewed(customer_id, viewed_at);
CREATE INDEX IF NOT EXISTS recently_viewed_session ON recently_viewed(session_id, viewed_at);

CREATE TABLE IF NOT EXISTS customer_preferences (
  customer_id TEXT PRIMARY KEY NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  data TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY NOT NULL,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL,
  title TEXT,
  body TEXT NOT NULL,
  image_urls TEXT NOT NULL DEFAULT '[]',
  helpful_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  moderation_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS reviews_product_status ON reviews(product_id, status, created_at);

CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY NOT NULL,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'New',
  internal_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS support_tickets_status ON support_tickets(status, updated_at);

CREATE TABLE IF NOT EXISTS returns (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Requested',
  refund_amount INTEGER NOT NULL DEFAULT 0,
  internal_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS returns_order ON returns(order_id);
CREATE INDEX IF NOT EXISTS returns_status ON returns(status, updated_at);

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Owner',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
