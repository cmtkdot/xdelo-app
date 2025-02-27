
-- Create trigger function to extract analyzed_content fields
CREATE OR REPLACE FUNCTION public.xdelo_extract_analyzed_content()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Only proceed if analyzed_content has changed and is not null
    IF (TG_OP = 'INSERT' OR OLD.analyzed_content IS DISTINCT FROM NEW.analyzed_content) 
       AND NEW.analyzed_content IS NOT NULL THEN
        
        -- Extract fields from analyzed_content
        NEW.product_name := NEW.analyzed_content->>'product_name';
        NEW.product_code := NEW.analyzed_content->>'product_code';
        NEW.vendor_uid := NEW.analyzed_content->>'vendor_uid';
        NEW.purchase_date := (NEW.analyzed_content->>'purchase_date')::date;
        NEW.product_quantity := (NEW.analyzed_content->>'quantity')::numeric;
        NEW.notes := NEW.analyzed_content->>'notes';
        
        -- Calculate additional fields if present
        IF NEW.analyzed_content->>'unit_price' IS NOT NULL THEN
            NEW.parsed_unit_price := (NEW.analyzed_content->>'unit_price')::numeric;
        END IF;
        
        IF NEW.analyzed_content->>'total_price' IS NOT NULL THEN
            NEW.parsed_total_price := (NEW.analyzed_content->>'total_price')::numeric;
        END IF;
        
        -- Parse vendor-specific information
        NEW.parsed_vendor_uid := NEW.analyzed_content->>'vendor_uid';
        NEW.parsed_product_code := NEW.analyzed_content->>'product_code';
        NEW.parsed_purchase_date := (NEW.analyzed_content->>'purchase_date')::date;
        NEW.parsed_quantity := (NEW.analyzed_content->>'quantity')::numeric;
        NEW.parsed_caption := NEW.analyzed_content->>'caption';
        
        -- Update modifcation timestamp
        NEW.updated_at := NOW();
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Create trigger on messages table
CREATE TRIGGER xdelo_trg_extract_analyzed_content
    BEFORE INSERT OR UPDATE OF analyzed_content
    ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.xdelo_extract_analyzed_content();

-- Add comment to explain trigger purpose
COMMENT ON TRIGGER xdelo_trg_extract_analyzed_content ON public.messages
    IS 'Extracts fields from analyzed_content JSON into separate columns';

