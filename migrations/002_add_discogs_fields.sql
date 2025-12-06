-- Add Discogs integration fields to Product_Detail table
-- This allows storing tracklists and release information from Discogs API

ALTER TABLE "Product_Detail" 
ADD COLUMN IF NOT EXISTS tracklist JSONB,
ADD COLUMN IF NOT EXISTS discogs_release_id INTEGER,
ADD COLUMN IF NOT EXISTS discogs_year INTEGER,
ADD COLUMN IF NOT EXISTS discogs_label TEXT,
ADD COLUMN IF NOT EXISTS discogs_updated_at TIMESTAMP WITH TIME ZONE;

-- Add index on discogs_release_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_product_detail_discogs_release_id 
ON "Product_Detail"(discogs_release_id);

-- Add comments for documentation
COMMENT ON COLUMN "Product_Detail".tracklist IS 'JSONB array of tracks: [{position, title, duration}, ...]';
COMMENT ON COLUMN "Product_Detail".discogs_release_id IS 'Discogs release ID for this product';
COMMENT ON COLUMN "Product_Detail".discogs_year IS 'Release year from Discogs';
COMMENT ON COLUMN "Product_Detail".discogs_label IS 'Record label from Discogs';
COMMENT ON COLUMN "Product_Detail".discogs_updated_at IS 'When Discogs data was last fetched';

