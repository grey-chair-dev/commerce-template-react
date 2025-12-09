-- Add payment_status column to orders table
-- This tracks payment status separately from order fulfillment status

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT NULL;

-- Add comment to clarify the difference
COMMENT ON COLUMN orders.status IS 'Order fulfillment status: New, In Progress, Ready, Picked Up, Completed, Canceled, Refunded';
COMMENT ON COLUMN orders.payment_status IS 'Payment status: PENDING, APPROVED, COMPLETED, FAILED, CANCELED, VOIDED, REFUNDED';

-- Create index for payment status queries
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

