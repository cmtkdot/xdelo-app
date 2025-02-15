-- Create function to extract quantity from analyzed_content
CREATE OR REPLACE FUNCTION public.extract_product_quantity(analyzed_content jsonb)
RETURNS integer AS $$
BEGIN
    RETURN (analyzed_content->>'quantity')::integer;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to update quantity
CREATE OR REPLACE FUNCTION public.update_quantity_trigger()
RETURNS trigger AS $$
BEGIN
    NEW.quantity = extract_product_quantity(NEW.analyzed_content);  -- Update quantity based on analyzed_content
    RETURN NEW;  -- Return the modified row
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trg_update_quantity
BEFORE INSERT OR UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_quantity_trigger();
