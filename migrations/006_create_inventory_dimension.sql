-- Create Inventory Dimension Table
-- 
-- Inventory is separated from Square_Item because it changes frequently.
-- This allows us to track inventory history and maintain a time-series of stock levels.

-- Inventory: Tracks stock levels over time
CREATE TABLE IF NOT EXISTS "Inventory" (
  inventory_id SERIAL PRIMARY KEY,
  square_item_id TEXT NOT NULL,
  stock_level INTEGER NOT NULL DEFAULT 0,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  source TEXT DEFAULT 'webhook', -- 'webhook', 'manual', 'sync', etc.
  -- Foreign key to Square_Item
  CONSTRAINT fk_inventory_square_item 
    FOREIGN KEY (square_item_id) 
    REFERENCES "Square_Item"(square_item_id)
    ON DELETE CASCADE
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_inventory_square_item_id ON "Inventory"(square_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_recorded_at ON "Inventory"(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_latest ON "Inventory"(square_item_id, recorded_at DESC);

-- Remove stock_level column from Square_Item (if it exists)
-- This will be done in a separate step to avoid breaking existing data
-- ALTER TABLE "Square_Item" DROP COLUMN IF EXISTS stock_level;

-- Add comment for documentation
COMMENT ON TABLE "Inventory" IS 'Time-series dimension table for tracking inventory/stock levels';
COMMENT ON COLUMN "Inventory".square_item_id IS 'Foreign key to Square_Item';
COMMENT ON COLUMN "Inventory".stock_level IS 'Stock level at this point in time';
COMMENT ON COLUMN "Inventory".recorded_at IS 'When this inventory level was recorded';
COMMENT ON COLUMN "Inventory".source IS 'Source of the inventory update (webhook, manual, sync, etc.)';

