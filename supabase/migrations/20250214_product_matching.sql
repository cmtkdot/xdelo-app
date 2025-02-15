-- Create sync_matches table for storing match results
CREATE TABLE IF NOT EXISTS sync_matches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid REFERENCES messages(id),
    product_id uuid REFERENCES gl_products(id),
    match_priority integer,
    confidence_score numeric,
    match_details jsonb,
    status text DEFAULT 'pending',
    applied boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(message_id)
);

-- Add basic tracking columns to messages
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS last_match_attempt_at timestamptz,
ADD COLUMN IF NOT EXISTS match_attempt_count integer DEFAULT 0;

-- Basic updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at trigger to sync_matches
CREATE TRIGGER update_sync_matches_updated_at
    BEFORE UPDATE ON sync_matches
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for frequently queried fields
CREATE INDEX IF NOT EXISTS idx_messages_product_name ON messages (product_name);
CREATE INDEX IF NOT EXISTS idx_messages_vendor_uid ON messages (vendor_uid);
CREATE INDEX IF NOT EXISTS idx_messages_purchase_order ON messages (purchase_order);
CREATE INDEX IF NOT EXISTS idx_gl_products_main_product_name ON gl_products (main_product_name);
CREATE INDEX IF NOT EXISTS idx_gl_products_vendor_product_name ON gl_products (main_vendor_product_name);

-- Grant permissions
GRANT ALL ON sync_matches TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
