
-- Ensure we have the correct event types in the database
-- This will help with the LogEventType enum in our code

-- Create or update the product_matching_indexes function
CREATE OR REPLACE FUNCTION public.xdelo_ensure_product_matching_schema()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- 1. First ensure the unified_audit_logs table has the right structure
  -- Add created_at column if it doesn't exist
  BEGIN
    ALTER TABLE public.unified_audit_logs 
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
  EXCEPTION WHEN OTHERS THEN
    -- Column might already exist or table doesn't exist
    NULL;
  END;
  
  -- 2. Set up the matching_config column in settings table if needed
  BEGIN
    ALTER TABLE public.settings
    ADD COLUMN IF NOT EXISTS matching_config JSONB DEFAULT '{"similarityThreshold": 0.7, "partialMatch": {"enabled": true}}';
  EXCEPTION WHEN OTHERS THEN
    -- Column might already exist or table doesn't exist
    NULL;
  END;
  
  -- 3. Create RPC function for ensuring matching config
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
  
  -- 4. Create RPC function for SQL migration
  CREATE OR REPLACE FUNCTION public.xdelo_execute_sql_migration(sql_command TEXT)
  RETURNS JSONB
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
  DECLARE
    v_result JSONB;
    v_error TEXT;
  BEGIN
    BEGIN
      EXECUTE sql_command;
      v_result := jsonb_build_object('success', true, 'message', 'SQL migration executed successfully');
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
      v_result := jsonb_build_object('success', false, 'message', 'SQL migration failed', 'error', v_error);
    END;
    
    RETURN v_result;
  END;
  $$;
  
  -- Run the ensure_matching_config function to populate the default config
  PERFORM public.xdelo_ensure_matching_config();
  
  v_result := jsonb_build_object(
    'success', true,
    'message', 'Product matching schema updates completed'
  );
  
  RETURN v_result;
END;
$$;

-- Execute the function to apply all changes
SELECT public.xdelo_ensure_product_matching_schema();
