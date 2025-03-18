
-- Function to check if specified columns exist in a table
CREATE OR REPLACE FUNCTION xdelo_check_columns_exist(
  table_name TEXT,
  column_names TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_missing_columns TEXT[] := '{}';
  v_sql TEXT;
  v_result JSONB;
BEGIN
  -- Check each column
  FOR i IN 1..array_length(column_names, 1) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = table_name 
      AND column_name = column_names[i]
    ) THEN
      v_missing_columns := array_append(v_missing_columns, column_names[i]);
    END IF;
  END LOOP;
  
  -- Build result object
  v_result := jsonb_build_object(
    'table', table_name,
    'columns_checked', column_names,
    'missing_columns', v_missing_columns,
    'all_exist', array_length(v_missing_columns, 1) IS NULL,
    'timestamp', current_timestamp
  );
  
  RETURN v_result;
END;
$$;
