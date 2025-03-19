
-- Ensure matching_config column exists in the settings table
ALTER TABLE IF EXISTS public.settings 
ADD COLUMN IF NOT EXISTS matching_config JSONB DEFAULT '{"similarityThreshold": 0.7, "partialMatch": {"enabled": true}}';

-- Ensure we have at least one settings record
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM settings LIMIT 1) THEN
    INSERT INTO settings (matching_config) 
    VALUES ('{"similarityThreshold": 0.7, "partialMatch": {"enabled": true}}');
  END IF;
END $$;

-- Create function to ensure matching config
CREATE OR REPLACE FUNCTION public.xdelo_ensure_matching_config()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exists BOOLEAN;
  v_default_config JSONB := '{"similarityThreshold": 0.7, "partialMatch": {"enabled": true, "vendorMinLength": 2, "dateFormat": "YYYY-MM-DD"}, "weights": {"productName": 0.4, "vendorUid": 0.3, "purchaseDate": 0.3}}';
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
    SET matching_config = COALESCE(matching_config, v_default_config)
    WHERE matching_config IS NULL;
    
    v_result := jsonb_build_object(
      'success', true, 
      'message', 'Ensured matching configuration exists'
    );
  END IF;
  
  RETURN v_result;
END;
$$;

-- Execute the function to ensure the config exists
SELECT xdelo_ensure_matching_config();
