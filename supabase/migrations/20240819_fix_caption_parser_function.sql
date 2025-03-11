
-- Fix the caption parser function that had a syntax error with the position() function

CREATE OR REPLACE FUNCTION public.xdelo_parse_caption(p_caption text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
BEGIN
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
      'partial_success', false
    )
  );
  
  -- Handle empty captions
  IF v_trimmed_caption IS NULL OR v_trimmed_caption = '' THEN
    v_result := jsonb_set(v_result, '{parsing_metadata,error}', to_jsonb('Empty caption'));
    v_result := jsonb_set(v_result, '{parsing_metadata,partial_success}', to_jsonb(true));
    v_result := jsonb_set(v_result, '{parsing_metadata,missing_fields}', 
                         to_jsonb(ARRAY['product_name', 'product_code', 'vendor_uid', 'purchase_date', 'quantity']));
    RETURN v_result;
  END IF;
  
  -- Handle multiple lines
  IF position(E'\n' in v_trimmed_caption) > 0 THEN
    -- Multi-line caption
    DECLARE 
      v_lines text[] := string_to_array(v_trimmed_caption, E'\n');
      v_code_line_idx int := -1;
      i int;
    BEGIN
      -- Extract product name from first line
      IF array_length(v_lines, 1) > 0 THEN
        v_product_name := trim(regexp_replace(v_lines[1], '^[''"]|[''"]$', '', 'g'));
      ELSE
        v_missing_fields := array_append(v_missing_fields, 'product_name');
      END IF;
      
      -- Find line with product code
      FOR i IN 1..array_length(v_lines, 1) LOOP
        IF position('#' in v_lines[i]) > 0 THEN
          v_code_line_idx := i;
          EXIT;
        END IF;
      END LOOP;
      
      -- If found a line with product code
      IF v_code_line_idx > 0 THEN
        DECLARE
          v_code_match text;
        BEGIN
          v_code_match := substring(v_lines[v_code_line_idx] from '#([A-Za-z0-9-]+)');
          
          IF v_code_match IS NOT NULL THEN
            v_product_code := v_code_match;
            
            -- Extract vendor and date
            -- Vendor UID (first 1-4 letters)
            v_vendor_uid := upper(substring(v_code_match from '^([A-Za-z]{1,4})'));
            
            IF v_vendor_uid IS NULL THEN
              v_missing_fields := array_append(v_missing_fields, 'vendor_uid');
            END IF;
            
            -- Purchase date (digits after vendor letters)
            DECLARE
              v_date_digits text;
            BEGIN
              v_date_digits := substring(v_code_match from '^[A-Za-z]{1,4}(\d{5,6})');
              
              IF v_date_digits IS NOT NULL THEN
                BEGIN
                  -- Format the date (mmDDyy -> YYYY-MM-DD)
                  IF length(v_date_digits) = 5 THEN
                    v_date_digits := '0' || v_date_digits;
                  END IF;
                  
                  IF length(v_date_digits) = 6 THEN
                    DECLARE
                      v_month text := substring(v_date_digits from 1 for 2);
                      v_day text := substring(v_date_digits from 3 for 2);
                      v_year text := '20' || substring(v_date_digits from 5 for 2);
                      v_date_value date;
                    BEGIN
                      -- Validate date
                      BEGIN
                        v_date_value := make_date(v_year::int, v_month::int, v_day::int);
                        v_purchase_date := v_year || '-' || v_month || '-' || v_day;
                      EXCEPTION WHEN OTHERS THEN
                        v_missing_fields := array_append(v_missing_fields, 'purchase_date');
                      END;
                    END;
                  ELSE
                    v_missing_fields := array_append(v_missing_fields, 'purchase_date');
                  END IF;
                EXCEPTION WHEN OTHERS THEN
                  v_missing_fields := array_append(v_missing_fields, 'purchase_date');
                END;
              ELSE
                v_missing_fields := array_append(v_missing_fields, 'purchase_date');
              END IF;
            END;
          END IF;
        END;
      ELSE
        v_missing_fields := array_append(v_missing_fields, 'product_code');
        v_missing_fields := array_append(v_missing_fields, 'vendor_uid');
        v_missing_fields := array_append(v_missing_fields, 'purchase_date');
      END IF;
      
      -- Remaining lines become notes
      IF array_length(v_lines, 1) > 1 THEN
        DECLARE
          v_note_lines text[] := '{}';
          j int;
        BEGIN
          FOR j IN 2..array_length(v_lines, 1) LOOP
            IF j != v_code_line_idx THEN
              v_note_lines := array_append(v_note_lines, v_lines[j]);
            END IF;
          END LOOP;
          
          IF array_length(v_note_lines, 1) > 0 THEN
            v_notes := trim(array_to_string(v_note_lines, E'\n'));
          END IF;
        END;
      END IF;
      
      -- Multi-line captions typically don't have quantities
      v_missing_fields := array_append(v_missing_fields, 'quantity');
    END;
  ELSE
    -- Single line caption processing
    
    -- Simple cases first
    
    -- Case: Just a quantity like "14x"
    IF v_trimmed_caption ~ '^\d+x$' THEN
      v_quantity := (substring(v_trimmed_caption from '^(\d+)x$'))::int;
      v_quantity_pattern := v_trimmed_caption;
      v_missing_fields := array_cat(v_missing_fields, ARRAY['product_name', 'product_code', 'vendor_uid', 'purchase_date']);
    
    -- Case: Simple product name without code or quantity
    ELSIF position('#' in v_trimmed_caption) = 0 AND position('x' in v_trimmed_caption) = 0 THEN
      v_product_name := v_trimmed_caption;
      v_missing_fields := array_cat(v_missing_fields, ARRAY['product_code', 'vendor_uid', 'purchase_date', 'quantity']);
    
    -- Case: Simple name with quantity like "Product x 2"
    ELSIF position('#' in v_trimmed_caption) = 0 AND v_trimmed_caption ~ 'x\s*\d+$' THEN
      v_product_name := trim(substring(v_trimmed_caption from '^(.+?)\s+x\s*\d+$'));
      v_quantity := (substring(v_trimmed_caption from 'x\s*(\d+)$'))::int;
      v_quantity_pattern := substring(v_trimmed_caption from 'x\s*\d+$');
      v_missing_fields := array_cat(v_missing_fields, ARRAY['product_code', 'vendor_uid', 'purchase_date']);
    
    -- More complex cases
    ELSE
      -- Special case: "Product #N #CODE123456 x 1"
      IF v_trimmed_caption ~ '^.+?\s+#\d+\s+#[A-Za-z]{1,4}\d{5,6}' THEN
        DECLARE
          v_product_part text;
          v_number_part text;
          v_code_part text;
          v_remaining text;
        BEGIN
          v_product_part := substring(v_trimmed_caption from '^(.+?)\s+#\d+\s+#');
          v_number_part := substring(v_trimmed_caption from '\s+(#\d+)\s+#');
          v_code_part := substring(v_trimmed_caption from '#[A-Za-z]{1,4}\d{5,6}');
          v_product_name := trim(v_product_part || ' ' || v_number_part);
          
          -- Extract product code without the # symbol
          v_product_code := substring(v_code_part from '#(.+)');
          
          -- Process vendor and date from code
          v_vendor_uid := upper(substring(v_product_code from '^([A-Za-z]{1,4})'));
          
          IF v_vendor_uid IS NULL THEN
            v_missing_fields := array_append(v_missing_fields, 'vendor_uid');
          END IF;
          
          DECLARE
            v_date_digits text;
          BEGIN
            v_date_digits := substring(v_product_code from '^[A-Za-z]{1,4}(\d{5,6})');
            
            IF v_date_digits IS NOT NULL THEN
              -- Format date
              IF length(v_date_digits) = 5 THEN
                v_date_digits := '0' || v_date_digits;
              END IF;
              
              IF length(v_date_digits) = 6 THEN
                DECLARE
                  v_month text := substring(v_date_digits from 1 for 2);
                  v_day text := substring(v_date_digits from 3 for 2);
                  v_year text := '20' || substring(v_date_digits from 5 for 2);
                  v_date_value date;
                BEGIN
                  -- Validate date
                  BEGIN
                    v_date_value := make_date(v_year::int, v_month::int, v_day::int);
                    v_purchase_date := v_year || '-' || v_month || '-' || v_day;
                  EXCEPTION WHEN OTHERS THEN
                    v_missing_fields := array_append(v_missing_fields, 'purchase_date');
                  END;
                END;
              ELSE
                v_missing_fields := array_append(v_missing_fields, 'purchase_date');
              END IF;
            ELSE
              v_missing_fields := array_append(v_missing_fields, 'purchase_date');
            END IF;
          END;
          
          -- Look for quantity and notes in remaining text
          v_remaining := substring(v_trimmed_caption from v_code_part || '(.+)$');
          
          -- Find quantity
          DECLARE
            v_qty_match text;
          BEGIN
            v_qty_match := substring(v_remaining from 'x\s*(\d+)');
            
            IF v_qty_match IS NOT NULL THEN
              v_quantity := v_qty_match::int;
              v_quantity_pattern := 'x ' || v_qty_match;
            ELSE
              v_missing_fields := array_append(v_missing_fields, 'quantity');
            END IF;
          END;
          
          -- Find notes in parentheses
          v_notes := substring(v_remaining from '\(([^)]+)\)');
        END;
      ELSE
        -- Standard cases
        DECLARE
          v_hash_positions int[];
          v_product_code_position int := 0;
          v_quantity_position int := 0;
          v_reverse_quantity_position int := 0;
          v_notes_position int := 0;
          v_temp_array text[];
          v_vendor_code text;
          v_is_standard_vendor boolean := false;
        BEGIN
          -- Find all hash positions using string_to_array and unnest
          WITH hash_positions AS (
            SELECT 
              (t.position - 1) as pos
            FROM 
              unnest(string_to_array(v_trimmed_caption, NULL)) WITH ORDINALITY t(char, position)
            WHERE 
              t.char = '#'
          )
          SELECT array_agg(pos) INTO v_hash_positions FROM hash_positions;
          
          -- Extract potential product codes
          IF v_hash_positions IS NOT NULL AND array_length(v_hash_positions, 1) > 0 THEN
            FOREACH v_product_code_position IN ARRAY v_hash_positions LOOP
              v_vendor_code := substring(v_trimmed_caption from v_product_code_position + 2); -- +2 to skip the #
              
              -- Check if it matches vendor pattern
              IF v_vendor_code ~ '^[A-Za-z]{1,4}\d{5,6}' THEN
                v_is_standard_vendor := true;
                v_product_code := substring(v_vendor_code from '^([A-Za-z0-9-]+)');
                EXIT;
              END IF;
            END LOOP;
            
            -- If no standard vendor code found, use the first hash code that's not just a number
            IF NOT v_is_standard_vendor AND array_length(v_hash_positions, 1) > 0 THEN
              FOREACH v_product_code_position IN ARRAY v_hash_positions LOOP
                v_vendor_code := substring(v_trimmed_caption from v_product_code_position + 2); -- +2 to skip the #
                
                -- Skip if it's just a number
                IF v_vendor_code !~ '^\d+$' THEN
                  v_product_code := substring(v_vendor_code from '^([A-Za-z0-9-]+)');
                  EXIT;
                END IF;
              END LOOP;
            END IF;
          END IF;
          
          -- Find quantity positions
          v_quantity_position := position('x ' in v_trimmed_caption);
          IF v_quantity_position = 0 THEN
            v_quantity_position := position('x' in v_trimmed_caption);
          END IF;
          
          -- Find reverse quantity (like "2x")
          SELECT position(m[1] in v_trimmed_caption) INTO v_reverse_quantity_position
          FROM regexp_matches(v_trimmed_caption, '(\d+\s*x)(?!\w)', 'g') m
          LIMIT 1;
          
          -- Find notes positions
          v_notes_position := position('(' in v_trimmed_caption);
          
          -- Extract product name
          IF v_product_code_position > 0 THEN
            -- Default: everything before the product code
            v_product_name := trim(substring(v_trimmed_caption from 1 for v_product_code_position));
            
            -- Adjust if quantity or notes come first
            IF v_quantity_position > 0 AND v_quantity_position < v_product_code_position THEN
              v_product_name := trim(substring(v_trimmed_caption from 1 for v_quantity_position - 1));
            END IF;
            
            IF v_notes_position > 0 AND v_notes_position < v_product_code_position THEN
              v_product_name := trim(substring(v_trimmed_caption from 1 for v_notes_position - 1));
            END IF;
            
            -- Process product code components
            -- Extract vendor UID
            v_vendor_uid := upper(substring(v_product_code from '^([A-Za-z]{1,4})'));
            
            IF v_vendor_uid IS NULL THEN
              v_missing_fields := array_append(v_missing_fields, 'vendor_uid');
            END IF;
            
            -- Extract purchase date
            DECLARE
              v_date_digits text;
            BEGIN
              v_date_digits := substring(v_product_code from '^[A-Za-z]{1,4}(\d{5,6})');
              
              IF v_date_digits IS NOT NULL THEN
                -- Format date
                IF length(v_date_digits) = 5 THEN
                  v_date_digits := '0' || v_date_digits;
                END IF;
                
                IF length(v_date_digits) = 6 THEN
                  DECLARE
                    v_month text := substring(v_date_digits from 1 for 2);
                    v_day text := substring(v_date_digits from 3 for 2);
                    v_year text := '20' || substring(v_date_digits from 5 for 2);
                    v_date_value date;
                  BEGIN
                    -- Validate date
                    BEGIN
                      v_date_value := make_date(v_year::int, v_month::int, v_day::int);
                      v_purchase_date := v_year || '-' || v_month || '-' || v_day;
                    EXCEPTION WHEN OTHERS THEN
                      v_missing_fields := array_append(v_missing_fields, 'purchase_date');
                    END;
                  END;
                ELSE
                  v_missing_fields := array_append(v_missing_fields, 'purchase_date');
                END IF;
              ELSE
                v_missing_fields := array_append(v_missing_fields, 'purchase_date');
              END IF;
            END;
          ELSE
            -- No product code
            v_missing_fields := array_cat(v_missing_fields, ARRAY['product_code', 'vendor_uid', 'purchase_date']);
            
            -- Extract product name based on other delimiters
            IF v_quantity_position > 0 THEN
              v_product_name := trim(substring(v_trimmed_caption from 1 for v_quantity_position - 1));
            ELSIF v_reverse_quantity_position > 0 THEN
              v_product_name := trim(substring(v_trimmed_caption from 1 for v_reverse_quantity_position - 1));
            ELSIF v_notes_position > 0 THEN
              v_product_name := trim(substring(v_trimmed_caption from 1 for v_notes_position - 1));
            ELSE
              v_product_name := v_trimmed_caption;
            END IF;
          END IF;
          
          -- Extract quantity
          IF v_quantity_position > 0 THEN
            v_quantity := (substring(v_trimmed_caption from 'x\s*(\d+)'))::int;
            v_quantity_pattern := substring(v_trimmed_caption from 'x\s*\d+');
          ELSIF v_reverse_quantity_position > 0 THEN
            v_quantity := (substring(v_trimmed_caption from '(\d+)\s*x'))::int;
            v_quantity_pattern := substring(v_trimmed_caption from '\d+\s*x');
          ELSE
            v_missing_fields := array_append(v_missing_fields, 'quantity');
          END IF;
          
          -- Extract notes
          v_notes := substring(v_trimmed_caption from '\(([^)]+)\)');
        END;
      END IF;
    END IF;
  END IF;
  
  -- Check for missing product name
  IF v_product_name IS NULL OR v_product_name = '' THEN
    v_missing_fields := array_append(v_missing_fields, 'product_name');
  END IF;
  
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
  
  RETURN v_result;
END;
$$;
