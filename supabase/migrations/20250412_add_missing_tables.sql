
-- Add missing tables referenced in the TypeScript code
-- This is necessary to resolve type errors with the Database interface

-- Create gl_products table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.gl_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    glide_id TEXT,
    new_product_name TEXT,
    vendor_product_name TEXT,
    vendor_uid TEXT,
    product_purchase_date TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    product_name_display TEXT
);

-- Create webhook_configs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.make_webhook_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    url TEXT NOT NULL,
    event_types TEXT[] NOT NULL,
    is_active BOOLEAN DEFAULT true,
    field_selection JSONB,
    payload_template JSONB,
    transformation_code TEXT,
    headers JSONB,
    retry_config JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create make_test_payloads table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.make_test_payloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    is_template BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add migration tracking record
INSERT INTO migration_history (version, name, applied_at, description)
VALUES (
    '12.0',
    'add-missing-tables',
    NOW(),
    'Added gl_products, make_webhook_configs, and make_test_payloads tables to support TypeScript types'
);
