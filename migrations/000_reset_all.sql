-- RESET DATABASE - Drop All Tables
-- 
-- WARNING: This will delete ALL data in your database!
-- 
-- Use this to start fresh with a clean database.
-- Run this BEFORE running other migrations.
--
-- Usage:
--   1. Go to Neon SQL Editor: https://console.neon.tech
--   2. Select your project
--   3. Click "SQL Editor"
--   4. Copy and paste this ENTIRE file
--   5. Click "Run"
--   6. Then run migrations/001_create_product_cache.sql
--   7. Then run migrations/002_add_discogs_fields.sql (if using Discogs)

-- Drop all tables (CASCADE handles foreign keys)
DROP TABLE IF EXISTS "Artist" CASCADE;
DROP TABLE IF EXISTS "Customer" CASCADE;
DROP TABLE IF EXISTS "Genre" CASCADE;
DROP TABLE IF EXISTS "Label" CASCADE;
DROP TABLE IF EXISTS "Order" CASCADE;
DROP TABLE IF EXISTS "Order_Item" CASCADE;
DROP TABLE IF EXISTS "Product_Detail" CASCADE;
DROP TABLE IF EXISTS "Square_Item" CASCADE;
DROP TABLE IF EXISTS "Staff_User" CASCADE;
DROP TABLE IF EXISTS "Vinyl_Artist" CASCADE;
DROP TABLE IF EXISTS "Vinyl_Genre" CASCADE;
DROP TABLE IF EXISTS "Wishlist_Item" CASCADE;
-- Note: email_list will be recreated in migration 004
DROP TABLE IF EXISTS email_list CASCADE;
DROP TABLE IF EXISTS product_cache CASCADE;
DROP TABLE IF EXISTS schema_migrations CASCADE;

-- Drop star schema tables (if they exist)
DROP TABLE IF EXISTS sales_fact CASCADE;
DROP TABLE IF EXISTS product_dim CASCADE;
DROP TABLE IF EXISTS customer_dim CASCADE;
DROP TABLE IF EXISTS time_dim CASCADE;

-- Drop any remaining sequences
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT sequence_name 
        FROM information_schema.sequences 
        WHERE sequence_schema = 'public'
    ) LOOP
        EXECUTE 'DROP SEQUENCE IF EXISTS ' || quote_ident(r.sequence_name) || ' CASCADE';
    END LOOP;
END $$;

-- Verify tables are dropped
SELECT 
    COUNT(*) as remaining_tables
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE';

-- Success message
SELECT 'Database reset complete! Now run migrations/001_create_product_cache.sql' as message;
