
-- Make sure we have the necessary index on unified_audit_logs
CREATE INDEX IF NOT EXISTS idx_unified_audit_logs_event_type
ON public.unified_audit_logs (event_type);

-- Create a function to ensure product matching config exists in settings
CREATE OR REPLACE FUNCTION public.xdelo_ensure_product_matching_config()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_config_exists BOOLEAN;
  v_result JSONB;
BEGIN
  -- Check if settings table exists
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'settings'
  ) INTO v_config_exists;
  
  IF NOT v_config_exists THEN
    -- Create settings table if it doesn't exist
    CREATE TABLE IF NOT EXISTS public.settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      bot_token TEXT,
      webhook_url TEXT,
      matching_config JSONB,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    
    v_result := jsonb_build_object(
      'success', true,
      'action', 'created_table',
      'message', 'Created settings table'
    );
  ELSE
    -- Check if matching_config column exists
    SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'settings' 
      AND column_name = 'matching_config'
    ) INTO v_config_exists;
    
    IF NOT v_config_exists THEN
      -- Add matching_config column if it doesn't exist
      ALTER TABLE public.settings
      ADD COLUMN IF NOT EXISTS matching_config JSONB;
      
      v_result := jsonb_build_object(
        'success', true,
        'action', 'added_column',
        'message', 'Added matching_config column to settings table'
      );
    ELSE
      v_result := jsonb_build_object(
        'success', true,
        'action', 'none',
        'message', 'Matching config column already exists'
      );
    END IF;
  END IF;
  
  -- Create RPC function for ensuring matching config if needed
  CREATE OR REPLACE FUNCTION public.xdelo_ensure_matching_config()
  RETURNS JSONB
  LANGUAGE plpgsql
  AS $func$
  DECLARE
    v_exists BOOLEAN;
    v_default_config JSONB := '{"similarityThreshold": 0.7, "weightedScoring": {"productName": 0.4, "vendorUid": 0.3, "purchaseDate": 0.3}, "partialMatch": {"enabled": true, "vendorMinLength": 2, "dateFormat": "YYYY-MM-DD"}}'::JSONB;
    v_result JSONB;
  BEGIN
    -- Check if settings table has any records
    SELECT EXISTS (SELECT 1 FROM public.settings LIMIT 1) INTO v_exists;
    
    IF NOT v_exists THEN
      -- Insert default settings record with matching config
      INSERT INTO public.settings (matching_config)
      VALUES (v_default_config);
      
      v_result := jsonb_build_object(
        'success', true,
        'message', 'Created default matching configuration',
        'config', v_default_config
      );
    ELSE
      -- Update existing record if matching_config is null
      UPDATE public.settings
      SET matching_config = v_default_config
      WHERE matching_config IS NULL;
      
      v_result := jsonb_build_object(
        'success', true, 
        'message', 'Ensured matching configuration exists'
      );
    END IF;
    
    RETURN v_result;
  END;
  $func$;
  
  RETURN v_result;
END;
$$;

-- Execute the function to set up product matching config
SELECT public.xdelo_ensure_product_matching_config();
