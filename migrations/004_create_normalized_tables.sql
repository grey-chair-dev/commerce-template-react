-- Create Normalized Tables for Operations
-- 
-- These tables support operations like orders, inventory, and customer management
-- We're using a simplified architecture:
--   1. product_cache (JSONB) - Fast product reads
--   2. Normalized tables - Operations (this file)
--
-- Run this AFTER migrations/001_create_product_cache.sql

-- ============================================================================
-- PRODUCT TABLES
-- ============================================================================

-- Square_Item: Main product table (normalized from Square)
CREATE TABLE IF NOT EXISTS "Square_Item" (
  square_item_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_price NUMERIC NOT NULL,
  stock_level INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_square_item_name ON "Square_Item"(name);

-- Product_Detail: Extended product information
-- Note: This should already exist from migration 002, but including here for completeness
CREATE TABLE IF NOT EXISTS "Product_Detail" (
  square_item_id TEXT PRIMARY KEY,
  condition_sleeve TEXT,
  condition_media TEXT,
  format TEXT,
  full_description TEXT,
  is_staff_pick BOOLEAN NOT NULL DEFAULT false,
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Discogs fields (from migration 002)
  tracklist JSONB,
  discogs_release_id INTEGER,
  discogs_year INTEGER,
  discogs_label TEXT,
  discogs_updated_at TIMESTAMP WITH TIME ZONE,
  -- Foreign key to Square_Item
  CONSTRAINT fk_product_detail_square_item 
    FOREIGN KEY (square_item_id) 
    REFERENCES "Square_Item"(square_item_id)
);

CREATE INDEX IF NOT EXISTS idx_product_detail_discogs_release_id 
ON "Product_Detail"(discogs_release_id);

-- ============================================================================
-- CUSTOMER TABLES
-- ============================================================================

-- Customer: Customer accounts
CREATE TABLE IF NOT EXISTS "Customer" (
  customer_id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_email ON "Customer"(email);

-- ============================================================================
-- ORDER TABLES
-- ============================================================================

-- Order: Customer orders
CREATE TABLE IF NOT EXISTS "Order" (
  order_id SERIAL PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  customer_id INTEGER,
  total_amount NUMERIC NOT NULL,
  current_status TEXT NOT NULL DEFAULT 'Processing',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_order_customer 
    FOREIGN KEY (customer_id) 
    REFERENCES "Customer"(customer_id)
);

CREATE INDEX IF NOT EXISTS idx_order_customer_id ON "Order"(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_number ON "Order"(order_number);
CREATE INDEX IF NOT EXISTS idx_order_status ON "Order"(current_status);

-- Order_Item: Order line items
CREATE TABLE IF NOT EXISTS "Order_Item" (
  order_item_id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  square_item_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price_at_purchase NUMERIC NOT NULL,
  CONSTRAINT fk_order_item_order 
    FOREIGN KEY (order_id) 
    REFERENCES "Order"(order_id),
  CONSTRAINT fk_order_item_product 
    FOREIGN KEY (square_item_id) 
    REFERENCES "Square_Item"(square_item_id)
);

CREATE INDEX IF NOT EXISTS idx_order_item_order ON "Order_Item"(order_id);
CREATE INDEX IF NOT EXISTS idx_order_item_product ON "Order_Item"(square_item_id);

-- ============================================================================
-- WISHLIST TABLE
-- ============================================================================

-- Wishlist_Item: Customer wishlists
CREATE TABLE IF NOT EXISTS "Wishlist_Item" (
  customer_id INTEGER NOT NULL,
  square_item_id TEXT NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (customer_id, square_item_id),
  CONSTRAINT fk_wishlist_customer 
    FOREIGN KEY (customer_id) 
    REFERENCES "Customer"(customer_id),
  CONSTRAINT fk_wishlist_product 
    FOREIGN KEY (square_item_id) 
    REFERENCES "Square_Item"(square_item_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlist_customer ON "Wishlist_Item"(customer_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_product ON "Wishlist_Item"(square_item_id);

-- ============================================================================
-- MARKETING TABLE
-- ============================================================================

-- email_list: Newsletter/email marketing subscribers
CREATE TABLE IF NOT EXISTS email_list (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  email VARCHAR(255) NOT NULL UNIQUE,
  source VARCHAR(255) DEFAULT 'website',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_list_email ON email_list(email);
CREATE INDEX IF NOT EXISTS idx_email_list_source ON email_list(source);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE "Square_Item" IS 'Main product table - normalized from Square';
COMMENT ON TABLE "Product_Detail" IS 'Extended product information including Discogs tracklists';
COMMENT ON TABLE "Customer" IS 'Customer accounts';
COMMENT ON TABLE "Order" IS 'Customer orders';
COMMENT ON TABLE "Order_Item" IS 'Order line items';
COMMENT ON TABLE "Wishlist_Item" IS 'Customer wishlists';
COMMENT ON TABLE email_list IS 'Newsletter/email marketing subscribers';

