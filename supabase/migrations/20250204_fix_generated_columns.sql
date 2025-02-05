-- First, drop the regular columns that will be replaced with generated ones
ALTER TABLE messages
  DROP COLUMN IF EXISTS product_name,
  DROP COLUMN IF EXISTS product_quantity,
  DROP COLUMN IF EXISTS product_unit,
  DROP COLUMN IF EXISTS vendor_name,
  DROP COLUMN IF EXISTS confidence_score,
  DROP COLUMN IF EXISTS analyzed_at;

-- Now add the generated columns
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS product_name text GENERATED ALWAYS AS (extract_product_name(analyzed_content)) STORED,
  ADD COLUMN IF NOT EXISTS product_quantity numeric GENERATED ALWAYS AS (extract_product_quantity(analyzed_content)) STORED,
  ADD COLUMN IF NOT EXISTS product_unit text GENERATED ALWAYS AS (extract_product_unit(analyzed_content)) STORED,
  ADD COLUMN IF NOT EXISTS vendor_name text GENERATED ALWAYS AS (extract_vendor_name(analyzed_content)) STORED,
  ADD COLUMN IF NOT EXISTS confidence_score numeric GENERATED ALWAYS AS (extract_confidence_score(analyzed_content)) STORED,
  ADD COLUMN IF NOT EXISTS analyzed_at timestamptz GENERATED ALWAYS AS (extract_analyzed_at(analyzed_content)) STORED;

-- Drop the trigger since we don't need it anymore (generated columns handle this automatically)
DROP TRIGGER IF EXISTS trg_update_analyzed_content_columns ON messages;
DROP FUNCTION IF EXISTS update_analyzed_content_columns();

-- Recreate the indexes (they were dropped when we dropped the columns)
CREATE INDEX IF NOT EXISTS idx_messages_product_name 
  ON messages (product_name) 
  WHERE product_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_vendor_name 
  ON messages (vendor_name) 
  WHERE vendor_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_confidence_score 
  ON messages (confidence_score) 
  WHERE confidence_score IS NOT NULL;
