-- Ensure thumbnail_url column exists in Product_Detail table
-- This stores the primary product image URL from Square
-- (thumbnail_url should already exist from migration 004, but this ensures it)

ALTER TABLE "Product_Detail" 
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Add category column to Product_Detail table
-- This stores the product category (e.g., Rock, Jazz, Hip-Hop, etc.)
ALTER TABLE "Product_Detail" 
ADD COLUMN IF NOT EXISTS category TEXT;

-- Add comments for documentation
COMMENT ON COLUMN "Product_Detail".thumbnail_url IS 'Primary product image URL from Square';
COMMENT ON COLUMN "Product_Detail".category IS 'Product category (e.g., Rock, Jazz, Hip-Hop, etc.)';

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_product_detail_thumbnail_url 
ON "Product_Detail"(thumbnail_url) 
WHERE thumbnail_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_product_detail_category 
ON "Product_Detail"(category) 
WHERE category IS NOT NULL;

