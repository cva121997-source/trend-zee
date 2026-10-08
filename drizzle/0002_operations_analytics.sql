-- Trend-Zee operations & analytics
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY NOT NULL,
  anonymous_id TEXT NOT NULL,
  customer_id TEXT,
  event_name TEXT NOT NULL,
  path TEXT,
  product_id TEXT,
  order_id TEXT,
  search_query TEXT,
  value INTEGER NOT NULL DEFAULT 0,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS analytics_events_name_time ON analytics_events(event_name,created_at);
CREATE INDEX IF NOT EXISTS analytics_events_product_time ON analytics_events(product_id,created_at);
CREATE INDEX IF NOT EXISTS analytics_events_customer_time ON analytics_events(customer_id,created_at);

CREATE TABLE IF NOT EXISTS analytics_rate (
  id TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL DEFAULT '{}',
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS analytics_rate_expiry ON analytics_rate(expires_at);
