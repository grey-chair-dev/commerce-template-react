-- Create product cache table for storing Square product data
-- This table caches transformed product data from Square API
-- Updated via webhooks when Square catalog/inventory changes

CREATE TABLE IF NOT EXISTS product_cache (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups (though key is already primary key)
CREATE INDEX IF NOT EXISTS idx_product_cache_updated_at ON product_cache(updated_at);

-- Add comment for documentation
COMMENT ON TABLE product_cache IS 'Caches transformed Square product data for fast frontend reads';
COMMENT ON COLUMN product_cache.key IS 'Cache key, e.g., square:products:spiralgroove';
COMMENT ON COLUMN product_cache.value IS 'JSONB object containing products array and metadata';
COMMENT ON COLUMN product_cache.updated_at IS 'Timestamp when cache was last updated';

