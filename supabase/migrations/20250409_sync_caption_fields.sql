-- Migration: 20250409_sync_caption_fields.sql
-- Description: Adds a function to synchronize caption_data and analyzed_content fields
-- and creates a trigger to keep them in sync for future operations

-- Function to retroactively align caption_data and analyzed_content fields
CREATE OR REPLACE FUNCTION public.align_caption_and_analyzed_content() 
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER := 0;
    updated_count2 INTEGER := 0;
BEGIN
    -- Update records where caption_data exists but analyzed_content does not
    UPDATE public.messages
    SET analyzed_content = caption_data::jsonb
    WHERE caption_data IS NOT NULL 
    AND (analyzed_content IS NULL OR analyzed_content = 'null'::jsonb);
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % records with caption_data -> analyzed_content', updated_count;
    
    -- Update records where analyzed_content exists but caption_data does not
    WITH to_update AS (
        SELECT id, analyzed_content 
        FROM public.messages
        WHERE analyzed_content IS NOT NULL 
        AND analyzed_content != 'null'::jsonb
        AND (caption_data IS NULL OR caption_data = '')
    )
    UPDATE public.messages m
    SET caption_data = tu.analyzed_content::text
    FROM to_update tu
    WHERE m.id = tu.id;
    
    GET DIAGNOSTICS updated_count2 = ROW_COUNT;
    RAISE NOTICE 'Updated % records with analyzed_content -> caption_data', updated_count2;
    updated_count := updated_count + updated_count2;
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger function to keep fields in sync going forward
CREATE OR REPLACE FUNCTION public.sync_caption_fields_trigger() 
RETURNS TRIGGER AS $$
BEGIN
    -- When caption_data is updated but analyzed_content is not
    IF (NEW.caption_data IS DISTINCT FROM OLD.caption_data AND NEW.analyzed_content IS NOT DISTINCT FROM OLD.analyzed_content) THEN
        NEW.analyzed_content := NEW.caption_data::jsonb;
    END IF;
    
    -- When analyzed_content is updated but caption_data is not
    IF (NEW.analyzed_content IS DISTINCT FROM OLD.analyzed_content AND NEW.caption_data IS NOT DISTINCT FROM OLD.caption_data) THEN
        NEW.caption_data := NEW.analyzed_content::text;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger on the messages table
CREATE TRIGGER ensure_caption_fields_sync
BEFORE UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.sync_caption_fields_trigger();

-- Comment on the function for documentation
COMMENT ON FUNCTION public.align_caption_and_analyzed_content() IS 
'Retroactively aligns caption_data and analyzed_content fields in the messages table. 
Returns the number of records updated.';

COMMENT ON FUNCTION public.sync_caption_fields_trigger() IS 
'Trigger function to ensure caption_data and analyzed_content fields stay in sync.
When one field is updated but the other is not, the function updates the other field to match.';
