-- Neon Database Schema for Spiral Groove Records
-- This schema supports products, inventory, orders, and user data

-- ============================================
-- PRODUCTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    category VARCHAR(100),
    stock_count INTEGER DEFAULT 0,
    image_url TEXT,
    rating DECIMAL(3, 2) DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INVENTORY TABLE (for tracking stock changes)
-- ============================================
CREATE TABLE IF NOT EXISTS inventory (
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(255) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity_change INTEGER NOT NULL,
    reason VARCHAR(255), -- 'sale', 'restock', 'return', 'adjustment'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- CUSTOMERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    auth_user_id VARCHAR(255), -- References auth.users if using Neon Auth
    default_shipping_address JSONB,
    preferences JSONB, -- Store customer preferences (newsletter, notifications, etc.)
    total_orders INTEGER DEFAULT 0,
    total_spent DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- ORDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(255) PRIMARY KEY,
    order_number VARCHAR(100) UNIQUE NOT NULL,
    customer_id VARCHAR(255) REFERENCES customers(id) ON DELETE SET NULL,
    user_id VARCHAR(255), -- References auth.users if using Neon Auth (for backward compatibility)
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled'
    subtotal DECIMAL(10, 2) NOT NULL,
    shipping DECIMAL(10, 2) DEFAULT 0,
    tax DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) NOT NULL,
    shipping_method VARCHAR(50), -- 'delivery', 'pickup'
    tracking_number VARCHAR(255),
    estimated_delivery_date DATE,
    shipping_address JSONB,
    payment_method VARCHAR(50),
    square_order_id VARCHAR(255), -- Reference to Square order if integrated
    square_payment_id VARCHAR(255), -- Reference to Square payment
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- ORDER ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(255) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id VARCHAR(255) NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    price DECIMAL(10, 2) NOT NULL, -- Price at time of order
    subtotal DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- WISHLIST TABLE (if wishlist feature enabled)
-- ============================================
CREATE TABLE IF NOT EXISTS wishlist (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL, -- References auth.users if using Neon Auth
    product_id VARCHAR(255) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, product_id)
);

-- ============================================
-- CART TABLE (for persistent carts)
-- ============================================
CREATE TABLE IF NOT EXISTS cart (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL, -- References auth.users if using Neon Auth
    product_id VARCHAR(255) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, product_id)
);

-- ============================================
-- INDEXES for Performance
-- ============================================

-- Products indexes
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_stock_count ON products(stock_count);
CREATE INDEX IF NOT EXISTS idx_products_updated_at ON products(updated_at);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);
CREATE INDEX IF NOT EXISTS idx_products_created_at_name ON products(created_at DESC, name ASC);

-- Inventory indexes
CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_created_at ON inventory(created_at);

-- Customers indexes
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_auth_user_id ON customers(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at);

-- Orders indexes
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_square_order_id ON orders(square_order_id);

-- Order items indexes
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- Wishlist indexes
CREATE INDEX IF NOT EXISTS idx_wishlist_user_id ON wishlist(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_product_id ON wishlist(product_id);

-- Cart indexes
CREATE INDEX IF NOT EXISTS idx_cart_user_id ON cart(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_product_id ON cart(product_id);

-- ============================================
-- TRIGGERS for updated_at timestamps
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to automatically update stock_count when inventory changes
CREATE OR REPLACE FUNCTION update_stock_count_from_inventory()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the product's stock_count by adding the quantity_change
    -- Ensure stock_count never goes below 0
    UPDATE products
    SET stock_count = GREATEST(0, stock_count + NEW.quantity_change),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.product_id;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to products
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to orders
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to cart
DROP TRIGGER IF EXISTS update_cart_updated_at ON cart;
CREATE TRIGGER update_cart_updated_at
    BEFORE UPDATE ON cart
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to customers
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to inventory to auto-update stock_count
DROP TRIGGER IF EXISTS update_stock_from_inventory ON inventory;
CREATE TRIGGER update_stock_from_inventory
    AFTER INSERT ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION update_stock_count_from_inventory();

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================

-- Insert sample products for Spiral Groove Records
INSERT INTO products (id, name, description, price, category, stock_count, image_url, rating, review_count) VALUES
    ('vinyl-001', 'The Beatles - Abbey Road', 'Classic 1969 album, remastered vinyl', 29.99, 'Rock', 15, 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600', 4.9, 234),
    ('vinyl-002', 'Miles Davis - Kind of Blue', 'Jazz masterpiece, 180g pressing', 34.99, 'Jazz', 8, 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600', 4.8, 189),
    ('vinyl-003', 'Pink Floyd - The Dark Side of the Moon', 'Progressive rock classic', 32.99, 'Rock', 12, 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600', 4.9, 312),
    ('vinyl-004', 'John Coltrane - A Love Supreme', 'Spiritual jazz album, reissue', 28.99, 'Jazz', 6, 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600', 4.7, 156),
    ('vinyl-005', 'Daft Punk - Random Access Memories', 'Electronic masterpiece', 35.99, 'Electronic', 10, 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600', 4.6, 278)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check if indexes exist
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;

-- Count products
SELECT COUNT(*) as product_count FROM products;

-- Check sample products
SELECT id, name, category, stock_count, price FROM products LIMIT 5;

-- Check customers table
SELECT COUNT(*) as customer_count FROM customers;

