
-- Create a new table to track content flow and validation
CREATE TABLE IF NOT EXISTS public.content_flow_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  required_fields JSONB,
  validations JSONB,
  next_stage TEXT,
  previous_stage TEXT,
  actions JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert predefined flow stages
INSERT INTO public.content_flow_stages (name, description, required_fields, validations, next_stage, previous_stage)
VALUES
  ('initialized', 'Content has been received but not processed', '[]', '[]', 'pending', NULL),
  ('pending', 'Content is ready for processing', '[]', '[]', 'processing', 'initialized'),
  ('processing', 'Content is currently being processed', '[]', '[]', 'completed', 'pending'),
  ('completed', 'Content has been fully processed', '["product_name", "product_code"]', '[{"fields": ["product_name", "product_code"], "type": "required"}]', NULL, 'processing'),
  ('error', 'An error occurred during processing', '[]', '[]', 'pending', 'processing'),
  ('partial_success', 'Processing completed with some missing data', '[]', '[]', 'pending', 'processing')
ON CONFLICT (id) DO NOTHING;

-- Create a function to validate content against rules
CREATE OR REPLACE FUNCTION public.xdelo_validate_content(
  p_content JSONB,
  p_rules JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_result JSONB;
  v_required_fields JSONB;
  v_format_rules JSONB;
  v_custom_rules JSONB;
  v_missing_fields TEXT[] := '{}';
  v_invalid_formats TEXT[] := '{}';
  v_custom_errors JSONB := '{}';
  v_field TEXT;
  v_pattern TEXT;
  v_valid BOOLEAN := TRUE;
BEGIN
  -- Initialize result
  v_result := jsonb_build_object(
    'valid', TRUE,
    'missing_fields', '[]'::JSONB,
    'invalid_formats', '[]'::JSONB,
    'custom_errors', '{}'::JSONB
  );
  
  -- If no rules provided, use default rules for content
  IF p_rules IS NULL THEN
    v_required_fields := '["product_name", "product_code"]'::JSONB;
    v_format_rules := jsonb_build_object(
      'product_code', '^[A-Za-z]{1,4}\d{5,6}(?:-[A-Za-z0-9-]+)?$',
      'purchase_date', '^\d{4}-\d{2}-\d{2}$'
    );
  ELSE
    v_required_fields := COALESCE(p_rules->'required', '[]'::JSONB);
    v_format_rules := COALESCE(p_rules->'format', '{}'::JSONB);
    v_custom_rules := COALESCE(p_rules->'custom', '{}'::JSONB);
  END IF;
  
  -- Check required fields
  FOR v_field IN SELECT jsonb_array_elements_text(v_required_fields)
  LOOP
    IF NOT p_content ? v_field OR p_content->>v_field IS NULL OR p_content->>v_field = '' THEN
      v_missing_fields := array_append(v_missing_fields, v_field);
      v_valid := FALSE;
    END IF;
  END LOOP;
  
  -- Check format rules
  FOR v_field, v_pattern IN SELECT * FROM jsonb_each_text(v_format_rules)
  LOOP
    IF p_content ? v_field AND p_content->>v_field IS NOT NULL AND p_content->>v_field != '' THEN
      IF NOT (p_content->>v_field) ~ v_pattern THEN
        v_invalid_formats := array_append(v_invalid_formats, v_field);
        v_valid := FALSE;
      END IF;
    END IF;
  END LOOP;
  
  -- Build result object
  v_result := jsonb_set(v_result, '{valid}', to_jsonb(v_valid));
  v_result := jsonb_set(v_result, '{missing_fields}', to_jsonb(v_missing_fields));
  v_result := jsonb_set(v_result, '{invalid_formats}', to_jsonb(v_invalid_formats));
  v_result := jsonb_set(v_result, '{custom_errors}', v_custom_errors);
  
  RETURN v_result;
END;
$function$;

-- Create function to advance content through flow stages
CREATE OR REPLACE FUNCTION public.xdelo_advance_content_stage(
  p_message_id UUID,
  p_next_stage TEXT DEFAULT NULL,
  p_correlation_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_message RECORD;
  v_current_stage TEXT;
  v_next_stage TEXT;
  v_flow_stage RECORD;
  v_validation_result JSONB;
  v_correlation_id TEXT;
  v_result JSONB;
BEGIN
  -- Set correlation ID
  v_correlation_id := COALESCE(p_correlation_id, gen_random_uuid()::TEXT);
  
  -- Get message details
  SELECT * INTO v_message
  FROM messages
  WHERE id = p_message_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Message not found',
      'message_id', p_message_id
    );
  END IF;
  
  -- Get current stage
  v_current_stage := COALESCE(v_message.processing_state, 'initialized');
  
  -- Determine next stage
  IF p_next_stage IS NULL THEN
    -- Look up flow configuration
    SELECT * INTO v_flow_stage
    FROM content_flow_stages
    WHERE name = v_current_stage;
    
    IF NOT FOUND THEN
      v_next_stage := 'pending'; -- Default next stage
    ELSE
      v_next_stage := v_flow_stage.next_stage;
    END IF;
  ELSE
    v_next_stage := p_next_stage;
  END IF;
  
  -- If no next stage, we're done
  IF v_next_stage IS NULL THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'message', 'No next stage defined',
      'current_stage', v_current_stage
    );
  END IF;
  
  -- Get target stage info for validation
  SELECT * INTO v_flow_stage
  FROM content_flow_stages
  WHERE name = v_next_stage;
  
  -- Validate content if moving to completed
  IF v_next_stage = 'completed' AND v_flow_stage.validations IS NOT NULL THEN
    v_validation_result := xdelo_validate_content(
      v_message.analyzed_content, 
      jsonb_build_object('required', v_flow_stage.required_fields)
    );
    
    -- If validation fails, move to partial_success instead
    IF NOT (v_validation_result->>'valid')::BOOLEAN THEN
      v_next_stage := 'partial_success';
    END IF;
  END IF;
  
  -- Update message state
  UPDATE messages
  SET 
    processing_state = v_next_stage,
    processing_started_at = CASE 
      WHEN v_next_stage = 'processing' THEN NOW() 
      ELSE processing_started_at 
    END,
    processing_completed_at = CASE 
      WHEN v_next_stage IN ('completed', 'partial_success', 'error') THEN NOW() 
      ELSE processing_completed_at 
    END,
    updated_at = NOW()
  WHERE id = p_message_id;
  
  -- Log the state transition
  INSERT INTO unified_audit_logs (
    event_type,
    entity_id,
    correlation_id,
    metadata,
    event_timestamp
  ) VALUES (
    'content_stage_changed',
    p_message_id,
    v_correlation_id,
    jsonb_build_object(
      'previous_stage', v_current_stage,
      'new_stage', v_next_stage,
      'validation_result', v_validation_result
    ),
    NOW()
  );
  
  -- Return result
  v_result := jsonb_build_object(
    'success', TRUE,
    'message_id', p_message_id,
    'previous_stage', v_current_stage,
    'new_stage', v_next_stage
  );
  
  IF v_validation_result IS NOT NULL THEN
    v_result := jsonb_set(v_result, '{validation_result}', v_validation_result);
  END IF;
  
  RETURN v_result;
END;
$function$;

-- Create trigger to advance content when caption changes
CREATE OR REPLACE FUNCTION public.xdelo_handle_caption_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- If caption changed and is not null/empty
  IF (TG_OP = 'INSERT' OR OLD.caption IS DISTINCT FROM NEW.caption) 
     AND NEW.caption IS NOT NULL 
     AND NEW.caption != '' THEN
    
    -- Reset analyzed content if it's a change
    IF TG_OP = 'UPDATE' THEN
      -- Store old analyzed content in history array
      IF OLD.analyzed_content IS NOT NULL THEN
        NEW.old_analyzed_content := COALESCE(OLD.old_analyzed_content, '[]'::JSONB) || OLD.analyzed_content;
      END IF;
      
      -- Clear analyzed content to trigger reprocessing
      NEW.analyzed_content := NULL;
    END IF;
    
    -- Set processing state to pending
    NEW.processing_state := 'pending';
  ELSIF NEW.caption IS NULL OR NEW.caption = '' THEN
    -- For empty captions, set to initialized if not in a media group
    IF NEW.media_group_id IS NULL THEN
      NEW.processing_state := 'initialized';
    ELSE
      -- For media groups, try to sync from group
      NEW.processing_state := 'pending';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger function for content flow validation on state changes
CREATE OR REPLACE FUNCTION public.xdelo_validate_content_flow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Check if we need to validate (only on certain state transitions)
  IF NEW.processing_state IN ('completed', 'partial_success') 
     AND NEW.analyzed_content IS NOT NULL THEN
    
    -- Validate content against standard rules
    DECLARE
      v_validation_result JSONB;
    BEGIN
      v_validation_result := xdelo_validate_content(NEW.analyzed_content);
      
      -- Adjust processing state based on validation
      IF NOT (v_validation_result->>'valid')::BOOLEAN THEN
        NEW.processing_state := 'partial_success';
        
        -- Add validation info to metadata
        IF NEW.analyzed_content ? 'parsing_metadata' THEN
          NEW.analyzed_content := jsonb_set(
            NEW.analyzed_content, 
            '{parsing_metadata,validation_result}', 
            v_validation_result
          );
          
          NEW.analyzed_content := jsonb_set(
            NEW.analyzed_content, 
            '{parsing_metadata,partial_success}', 
            'true'::JSONB
          );
          
          NEW.analyzed_content := jsonb_set(
            NEW.analyzed_content, 
            '{parsing_metadata,missing_fields}', 
            v_validation_result->'missing_fields'
          );
        END IF;
      END IF;
    END;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Install the triggers
DROP TRIGGER IF EXISTS trg_handle_caption_change ON public.messages;
CREATE TRIGGER trg_handle_caption_change
BEFORE INSERT OR UPDATE OF caption ON public.messages
FOR EACH ROW
EXECUTE FUNCTION xdelo_handle_caption_change();

DROP TRIGGER IF EXISTS trg_validate_content_flow ON public.messages;
CREATE TRIGGER trg_validate_content_flow
BEFORE UPDATE OF processing_state, analyzed_content ON public.messages
FOR EACH ROW
EXECUTE FUNCTION xdelo_validate_content_flow();

-- Update the sync_media_group_content function to include validation
CREATE OR REPLACE FUNCTION public.xdelo_sync_media_group_content(
    p_message_id uuid,
    p_analyzed_content jsonb,
    p_force_sync boolean DEFAULT true,
    p_sync_edit_history boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_message record;
    v_media_group_id text;
    v_correlation_id text;
    v_updated_count integer := 0;
    v_error text;
    v_validation_result jsonb;
BEGIN
    -- Validate the analyzed content first
    v_validation_result := xdelo_validate_content(p_analyzed_content);
    
    -- Get the message and important metadata
    SELECT * INTO v_message
    FROM messages
    WHERE id = p_message_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Message not found',
            'message_id', p_message_id
        );
    END IF;
    
    v_media_group_id := v_message.media_group_id;
    v_correlation_id := COALESCE(v_message.correlation_id, gen_random_uuid()::text);
    
    -- Return early if no media group
    IF v_media_group_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'No media group to sync',
            'message_id', p_message_id,
            'no_media_group', true,
            'validation_result', v_validation_result
        );
    END IF;
    
    -- Update analyzed content with validation result if needed
    DECLARE
        v_updated_content jsonb := p_analyzed_content;
    BEGIN
        IF NOT (v_validation_result->>'valid')::boolean AND v_updated_content ? 'parsing_metadata' THEN
            v_updated_content := jsonb_set(
                v_updated_content, 
                '{parsing_metadata,validation_result}', 
                v_validation_result
            );
            
            v_updated_content := jsonb_set(
                v_updated_content, 
                '{parsing_metadata,partial_success}', 
                'true'::jsonb
            );
            
            v_updated_content := jsonb_set(
                v_updated_content, 
                '{parsing_metadata,missing_fields}', 
                v_validation_result->'missing_fields'
            );
        END IF;
        
        -- Add sync metadata
        v_updated_content := jsonb_set(
            v_updated_content,
            '{sync_metadata}',
            jsonb_build_object(
                'sync_source_message_id', p_message_id,
                'media_group_id', v_media_group_id,
                'sync_timestamp', now()
            )
        );
        
        -- Update the source message with analyzed content
        UPDATE messages
        SET 
            analyzed_content = v_updated_content,
            processing_state = CASE
                WHEN (v_validation_result->>'valid')::boolean THEN 'completed'
                ELSE 'partial_success'
            END,
            processing_completed_at = NOW(),
            is_original_caption = true,
            group_caption_synced = true,
            message_caption_id = p_message_id,
            updated_at = NOW()
        WHERE id = p_message_id;
    END;
    
    -- Log the completion
    INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        correlation_id,
        metadata,
        event_timestamp
    ) VALUES (
        'message_processing_completed',
        p_message_id,
        v_correlation_id,
        jsonb_build_object(
            'processor', 'sync_media_group_content',
            'completion_time', NOW(),
            'has_media_group', true,
            'is_source', true,
            'validation_result', v_validation_result
        ),
        NOW()
    );
    
    -- Update all other messages in the group with the analyzed content
    WITH updated_messages AS (
        UPDATE messages
        SET 
            analyzed_content = p_analyzed_content,
            processing_state = CASE
                WHEN (v_validation_result->>'valid')::boolean THEN 'completed'
                ELSE 'partial_success'
            END,
            group_caption_synced = true,
            message_caption_id = p_message_id,
            is_original_caption = false,
            processing_completed_at = COALESCE(processing_completed_at, NOW()),
            updated_at = NOW(),
            -- Only sync edit history if requested
            old_analyzed_content = CASE 
                WHEN p_sync_edit_history AND v_message.old_analyzed_content IS NOT NULL 
                THEN v_message.old_analyzed_content
                ELSE old_analyzed_content
            END
        WHERE 
            media_group_id = v_media_group_id
            AND id != p_message_id
            AND (p_force_sync = true OR group_caption_synced = false OR analyzed_content IS NULL)
        RETURNING id
    )
    SELECT COUNT(*) INTO v_updated_count FROM updated_messages;

    -- Update media group metadata for all messages
    WITH group_stats AS (
        SELECT 
            COUNT(*) as message_count,
            MIN(created_at) as first_message_time,
            MAX(created_at) as last_message_time
        FROM messages
        WHERE media_group_id = v_media_group_id
    )
    UPDATE messages m
    SET
        group_message_count = gs.message_count,
        group_first_message_time = gs.first_message_time,
        group_last_message_time = gs.last_message_time,
        updated_at = NOW()
    FROM group_stats gs
    WHERE m.media_group_id = v_media_group_id;

    -- Log the sync operation
    INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        correlation_id,
        metadata,
        event_timestamp
    ) VALUES (
        'media_group_content_synced',
        p_message_id,
        v_correlation_id,
        jsonb_build_object(
            'media_group_id', v_media_group_id,
            'updated_messages_count', v_updated_count,
            'force_sync', p_force_sync,
            'sync_edit_history', p_sync_edit_history,
            'validation_result', v_validation_result
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'media_group_id', v_media_group_id,
        'source_message_id', p_message_id, 
        'updated_count', v_updated_count,
        'validation_result', v_validation_result
    );
    
EXCEPTION WHEN OTHERS THEN 
    v_error := SQLERRM;

    -- Log error
    INSERT INTO unified_audit_logs (
        event_type,
        entity_id,
        correlation_id,
        error_message,
        metadata,
        event_timestamp
    ) VALUES (
        'media_group_sync_error',
        p_message_id,
        v_correlation_id,
        v_error,
        jsonb_build_object(
            'media_group_id', v_media_group_id,
            'error', v_error
        ),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', false,
        'error', v_error,
        'media_group_id', v_media_group_id,
        'source_message_id', p_message_id
    );
END;
$function$;
