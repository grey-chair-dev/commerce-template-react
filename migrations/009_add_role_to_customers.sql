-- Migration: Add role field to customers table for RBAC
-- This enables role-based access control (user, admin, staff)

-- Add role column with default 'user'
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user' NOT NULL;

-- Add check constraint to ensure valid roles
ALTER TABLE customers
ADD CONSTRAINT check_role_valid 
CHECK (role IN ('user', 'admin', 'staff'));

-- Create index for role-based queries
CREATE INDEX IF NOT EXISTS idx_customers_role ON customers(role);

-- Add comment
COMMENT ON COLUMN customers.role IS 'User role: user (default), admin, or staff';
