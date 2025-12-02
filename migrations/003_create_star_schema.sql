-- Create Star Schema for Analytics
-- 
-- NOTE: This migration is SKIPPED for now (see CURRENT_ARCHITECTURE.md)
-- We're using a simplified two-tier architecture:
--   1. product_cache (JSONB) - Fast product reads
--   2. Normalized tables - Operations
--
-- Add star schema later if:
--   - Analytics queries become slow (>1 second)
--   - You have > 10,000 orders
--   - You need complex dashboards
--
-- To use this migration:
--   1. Run this SQL in Neon SQL Editor
--   2. Run: npm run etl:populate-time
--   3. Run: npm run etl:sync
--
-- ============================================================================
-- DIMENSION TABLES
-- ============================================================================

-- Product Dimension (Denormalized - all product info in one table)
CREATE TABLE IF NOT EXISTS product_dim (
  product_id TEXT PRIMARY KEY,
  product_name TEXT NOT NULL,
  category TEXT,
  artist TEXT,
  genre TEXT,
  label TEXT,
  format TEXT,
  condition_sleeve TEXT,
  condition_media TEXT,
  is_staff_pick BOOLEAN DEFAULT false,
  base_price NUMERIC,
  created_date DATE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_product_dim_artist ON product_dim(artist);
CREATE INDEX IF NOT EXISTS idx_product_dim_genre ON product_dim(genre);
CREATE INDEX IF NOT EXISTS idx_product_dim_category ON product_dim(category);
CREATE INDEX IF NOT EXISTS idx_product_dim_label ON product_dim(label);
CREATE INDEX IF NOT EXISTS idx_product_dim_staff_pick ON product_dim(is_staff_pick);

-- Customer Dimension
CREATE TABLE IF NOT EXISTS customer_dim (
  customer_id INTEGER PRIMARY KEY,
  customer_name TEXT,
  email TEXT,
  customer_segment TEXT, -- e.g., 'VIP', 'Regular', 'New'
  signup_date DATE,
  location_city TEXT,
  location_state TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for customer queries
CREATE INDEX IF NOT EXISTS idx_customer_dim_segment ON customer_dim(customer_segment);
CREATE INDEX IF NOT EXISTS idx_customer_dim_email ON customer_dim(email);

-- Time Dimension (for date-based analytics)
CREATE TABLE IF NOT EXISTS time_dim (
  date DATE PRIMARY KEY,
  day INTEGER NOT NULL,
  month INTEGER NOT NULL,
  quarter INTEGER NOT NULL,
  year INTEGER NOT NULL,
  day_of_week TEXT NOT NULL,
  day_of_week_num INTEGER NOT NULL, -- 1=Monday, 7=Sunday
  is_weekend BOOLEAN NOT NULL,
  is_holiday BOOLEAN DEFAULT false,
  week_number INTEGER NOT NULL,
  month_name TEXT NOT NULL,
  quarter_name TEXT NOT NULL -- e.g., 'Q1 2025'
);

-- Indexes for time queries
CREATE INDEX IF NOT EXISTS idx_time_dim_year ON time_dim(year);
CREATE INDEX IF NOT EXISTS idx_time_dim_month ON time_dim(year, month);
CREATE INDEX IF NOT EXISTS idx_time_dim_quarter ON time_dim(year, quarter);
CREATE INDEX IF NOT EXISTS idx_time_dim_weekend ON time_dim(is_weekend);

-- ============================================================================
-- FACT TABLE
-- ============================================================================

-- Sales Fact Table (the center of the star)
CREATE TABLE IF NOT EXISTS sales_fact (
  sale_id BIGSERIAL PRIMARY KEY,
  product_id TEXT NOT NULL,
  customer_id INTEGER,
  order_date DATE NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  total_amount NUMERIC NOT NULL,
  discount_amount NUMERIC DEFAULT 0,
  order_id TEXT,
  order_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Foreign keys to dimensions
  CONSTRAINT fk_sales_product FOREIGN KEY (product_id) REFERENCES product_dim(product_id),
  CONSTRAINT fk_sales_customer FOREIGN KEY (customer_id) REFERENCES customer_dim(customer_id),
  CONSTRAINT fk_sales_time FOREIGN KEY (order_date) REFERENCES time_dim(date)
);

-- Indexes for fact table queries
CREATE INDEX IF NOT EXISTS idx_sales_fact_product ON sales_fact(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_fact_customer ON sales_fact(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_fact_date ON sales_fact(order_date);
CREATE INDEX IF NOT EXISTS idx_sales_fact_order ON sales_fact(order_id);
CREATE INDEX IF NOT EXISTS idx_sales_fact_date_product ON sales_fact(order_date, product_id);

-- Composite index for common analytics queries
CREATE INDEX IF NOT EXISTS idx_sales_fact_analytics ON sales_fact(order_date, product_id, customer_id);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE product_dim IS 'Product dimension table - denormalized for fast analytics queries (SKIPPED for now)';
COMMENT ON TABLE customer_dim IS 'Customer dimension table - customer attributes for segmentation (SKIPPED for now)';
COMMENT ON TABLE time_dim IS 'Time dimension table - date attributes for time-based analytics (SKIPPED for now)';
COMMENT ON TABLE sales_fact IS 'Sales fact table - transactional sales data for analytics (SKIPPED for now)';
