-- Remove stock_level column from Square_Item
-- 
-- Inventory is now tracked in the Inventory dimension table.
-- This migration should be run AFTER migration 006 and AFTER
-- syncing existing inventory data to the Inventory table.

-- First, migrate existing stock_level data to Inventory table (if any exists)
INSERT INTO "Inventory" (square_item_id, stock_level, recorded_at, source)
SELECT 
  square_item_id,
  stock_level,
  updated_at,
  'migration'
FROM "Square_Item"
WHERE stock_level IS NOT NULL
ON CONFLICT DO NOTHING;

-- Now remove the column
ALTER TABLE "Square_Item" 
DROP COLUMN IF EXISTS stock_level;

-- Add comment
COMMENT ON TABLE "Square_Item" IS 'Main product table - normalized from Square (inventory tracked separately in Inventory table)';

