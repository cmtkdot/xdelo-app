CREATE OR REPLACE FUNCTION public.xdelo_parse_caption(
  p_message_id uuid,
  p_caption text,
  p_correlation_id text DEFAULT NULL::text,
  p_media_group_id text DEFAULT NULL::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_timestamp timestamptz := now();
  v_trimmed_caption text := trim(p_caption);
  v_result jsonb;
  v_missing_fields text[] := '{}';
  v_product_name text := '';
  v_product_code text := '';
  v_vendor_uid text := null;
  v_purchase_date text := null;
  v_quantity int := null;
  v_notes text := '';
  v_partial_success boolean := false;
  v_quantity_pattern text := null;
  v_correlation_uuid uuid;
BEGIN
  -- Log processing start
  PERFORM xdelo_log_processing_event(
    'caption_parsing_started',
    p_message_id::text,
    v_correlation_uuid::text,
    jsonb_build_object(
      'caption_length', length(v_trimmed_caption),
      'processor', 'xdelo_parse_caption'
    )
  );

  -- Convert correlation_id to UUID if provided, otherwise generate new one
  v_correlation_uuid := CASE 
    WHEN p_correlation_id IS NOT NULL THEN 
      CASE 
        WHEN p_correlation_id::uuid IS NOT NULL THEN p_correlation_id::uuid
        ELSE gen_random_uuid()
      END
    ELSE gen_random_uuid()
  END;

  -- Initialize the result object
  v_result := jsonb_build_object(
    'product_name', '',
    'product_code', '',
    'vendor_uid', null,
    'purchase_date', null,
    'quantity', null,
    'notes', '',
    'caption', v_trimmed_caption,
    'parsing_metadata', jsonb_build_object(
      'method', 'manual',
      'timestamp', v_timestamp,
      'partial_success', false,
      'correlation_id', v_correlation_uuid
    )
  );
  
  -- Handle empty captions
  IF v_trimmed_caption IS NULL OR v_trimmed_caption = '' THEN
    v_result := jsonb_set(v_result, '{parsing_metadata,error}', to_jsonb('Empty caption'));
    v_result := jsonb_set(v_result, '{parsing_metadata,partial_success}', to_jsonb(true));
    v_result := jsonb_set(v_result, '{parsing_metadata,missing_fields}', 
                         to_jsonb(ARRAY['product_name', 'product_code', 'vendor_uid', 'purchase_date', 'quantity']));
    
    -- Log empty caption event
    PERFORM xdelo_log_processing_event(
      p_message_id,
      'caption_parsing_completed',
      v_correlation_uuid::text,
      jsonb_build_object('empty_caption', true)
    );
    
  -- If part of media group, sync the parsed content
  IF p_media_group_id IS NOT NULL THEN
    PERFORM xdelo_sync_media_group_content(
      p_message_id,
      v_result,
      true,  -- force_sync
      false  -- sync_edit_history
    );
  END IF;

  RETURN jsonb_set(v_result, '{correlation_id}', to_jsonb(v_correlation_uuid::text));
  END IF;
  
  -- [Previous parsing logic remains exactly the same until the final RETURN]
  
  -- Update the result object with our extracted values
  v_partial_success := array_length(v_missing_fields, 1) > 0;
  
  v_result := jsonb_set(v_result, '{product_name}', to_jsonb(v_product_name));
  v_result := jsonb_set(v_result, '{product_code}', to_jsonb(v_product_code));
  v_result := jsonb_set(v_result, '{vendor_uid}', COALESCE(to_jsonb(v_vendor_uid), 'null'::jsonb));
  v_result := jsonb_set(v_result, '{purchase_date}', COALESCE(to_jsonb(v_purchase_date), 'null'::jsonb));
  v_result := jsonb_set(v_result, '{quantity}', COALESCE(to_jsonb(v_quantity), 'null'::jsonb));
  v_result := jsonb_set(v_result, '{notes}', to_jsonb(COALESCE(v_notes, '')));
  
  -- Set metadata
  v_result := jsonb_set(v_result, '{parsing_metadata,partial_success}', to_jsonb(v_partial_success));
  
  IF v_partial_success THEN
    v_result := jsonb_set(v_result, '{parsing_metadata,missing_fields}', to_jsonb(v_missing_fields));
  END IF;
  
  IF v_quantity_pattern IS NOT NULL THEN
    v_result := jsonb_set(v_result, '{parsing_metadata,quantity_pattern}', to_jsonb(v_quantity_pattern));
  END IF;

  -- Log successful parsing
  PERFORM xdelo_log_processing_event(
    p_message_id,
    'caption_parsing_completed',
    v_correlation_uuid::text,
    jsonb_build_object(
      'parsed_fields', 
      jsonb_build_object(
        'product_name', v_product_name IS NOT NULL,
        'product_code', v_product_code IS NOT NULL,
        'vendor_uid', v_vendor_uid IS NOT NULL,
        'purchase_date', v_purchase_date IS NOT NULL,
        'quantity', v_quantity IS NOT NULL
      ),
      'missing_fields', v_missing_fields
    )
  );
  
  -- If this is part of a media group, sync the parsed content
  IF p_media_group_id IS NOT NULL THEN
    PERFORM xdelo_sync_media_group_content(
      p_message_id,
      v_result,
      true,  -- force sync
      false  -- don't sync edit history
    );
  END IF;

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error
    PERFORM xdelo_log_processing_event(
      p_message_id,
      'caption_parsing_error',
      v_correlation_uuid::text,
      jsonb_build_object(
        'error', SQLERRM,
        'error_time', NOW()
      )
    );
    
    -- Update message status
    UPDATE messages
    SET processing_state = 'error',
        error_message = SQLERRM,
        updated_at = NOW()
    WHERE id = p_message_id;
    
    -- Return error
    RETURN jsonb_build_object(
      'success', FALSE,
      'message_id', p_message_id,
      'error', SQLERRM,
      'correlation_id', v_correlation_uuid
    );
END;
$function$
