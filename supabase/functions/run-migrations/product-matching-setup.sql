
-- Create a dedicated table for product matching configuration
CREATE TABLE IF NOT EXISTS public.product_matching_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  similarity_threshold FLOAT NOT NULL DEFAULT 0.7,
  partial_match_enabled BOOLEAN NOT NULL DEFAULT true,
  partial_match_min_length INTEGER DEFAULT 2,
  partial_match_date_format TEXT DEFAULT 'YYYY-MM-DD',
  weight_name FLOAT DEFAULT 0.4,
  weight_vendor FLOAT DEFAULT 0.3,
  weight_purchase_date FLOAT DEFAULT 0.3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default configuration if none exists
INSERT INTO public.product_matching_config (
  similarity_threshold,
  partial_match_enabled,
  partial_match_min_length,
  partial_match_date_format,
  weight_name,
  weight_vendor,
  weight_purchase_date
)
SELECT 
  0.7, -- similarity_threshold
  true, -- partial_match_enabled
  2, -- partial_match_min_length
  'YYYY-MM-DD', -- partial_match_date_format
  0.4, -- weight_name
  0.3, -- weight_vendor
  0.3  -- weight_purchase_date
WHERE NOT EXISTS (SELECT 1 FROM public.product_matching_config LIMIT 1);

-- Create RPC function to get matching configuration
CREATE OR REPLACE FUNCTION public.xdelo_get_product_matching_config()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_config JSONB;
BEGIN
  SELECT jsonb_build_object(
    'similarityThreshold', similarity_threshold,
    'partialMatch', jsonb_build_object(
      'enabled', partial_match_enabled,
      'minLength', partial_match_min_length,
      'dateFormat', partial_match_date_format
    ),
    'weightedScoring', jsonb_build_object(
      'name', weight_name,
      'vendor', weight_vendor,
      'purchaseDate', weight_purchase_date
    )
  ) INTO v_config
  FROM product_matching_config
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Return default config if none exists
  IF v_config IS NULL THEN
    v_config := jsonb_build_object(
      'similarityThreshold', 0.7,
      'partialMatch', jsonb_build_object(
        'enabled', true,
        'minLength', 2,
        'dateFormat', 'YYYY-MM-DD'
      ),
      'weightedScoring', jsonb_build_object(
        'name', 0.4,
        'vendor', 0.3,
        'purchaseDate', 0.3
      )
    );
  END IF;
  
  RETURN v_config;
END;
$$;

-- Create RPC function to update matching configuration
CREATE OR REPLACE FUNCTION public.xdelo_update_product_matching_config(p_config JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_similarity_threshold FLOAT;
  v_partial_match_enabled BOOLEAN;
  v_partial_match_min_length INTEGER;
  v_partial_match_date_format TEXT;
  v_weight_name FLOAT;
  v_weight_vendor FLOAT;
  v_weight_purchase_date FLOAT;
  v_result JSONB;
  v_id UUID;
BEGIN
  -- Extract values from input JSON
  v_similarity_threshold := (p_config->>'similarityThreshold')::FLOAT;
  v_partial_match_enabled := (p_config->'partialMatch'->>'enabled')::BOOLEAN;
  v_partial_match_min_length := (p_config->'partialMatch'->>'minLength')::INTEGER;
  v_partial_match_date_format := p_config->'partialMatch'->>'dateFormat';
  v_weight_name := (p_config->'weightedScoring'->>'name')::FLOAT;
  v_weight_vendor := (p_config->'weightedScoring'->>'vendor')::FLOAT;
  v_weight_purchase_date := (p_config->'weightedScoring'->>'purchaseDate')::FLOAT;
  
  -- Get existing config ID if it exists
  SELECT id INTO v_id FROM product_matching_config ORDER BY created_at DESC LIMIT 1;
  
  -- Insert or update configuration
  IF v_id IS NULL THEN
    -- Insert new config
    INSERT INTO product_matching_config (
      similarity_threshold,
      partial_match_enabled,
      partial_match_min_length,
      partial_match_date_format,
      weight_name,
      weight_vendor,
      weight_purchase_date
    ) VALUES (
      COALESCE(v_similarity_threshold, 0.7),
      COALESCE(v_partial_match_enabled, true),
      COALESCE(v_partial_match_min_length, 2),
      COALESCE(v_partial_match_date_format, 'YYYY-MM-DD'),
      COALESCE(v_weight_name, 0.4),
      COALESCE(v_weight_vendor, 0.3),
      COALESCE(v_weight_purchase_date, 0.3)
    ) RETURNING id INTO v_id;
  ELSE
    -- Update existing config
    UPDATE product_matching_config
    SET 
      similarity_threshold = COALESCE(v_similarity_threshold, similarity_threshold),
      partial_match_enabled = COALESCE(v_partial_match_enabled, partial_match_enabled),
      partial_match_min_length = COALESCE(v_partial_match_min_length, partial_match_min_length),
      partial_match_date_format = COALESCE(v_partial_match_date_format, partial_match_date_format),
      weight_name = COALESCE(v_weight_name, weight_name),
      weight_vendor = COALESCE(v_weight_vendor, weight_vendor),
      weight_purchase_date = COALESCE(v_weight_purchase_date, weight_purchase_date),
      updated_at = now()
    WHERE id = v_id;
  END IF;
  
  -- Return updated config
  v_result := xdelo_get_product_matching_config();
  RETURN v_result;
END;
$$;

-- Execute the function to ensure the config exists
SELECT xdelo_get_product_matching_config();
