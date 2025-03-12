
-- Function to execute SQL queries (with security measures)
CREATE OR REPLACE FUNCTION xdelo_execute_sql_query(p_query text, p_params text[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_start_time timestamptz := clock_timestamp();
  v_query_text text := p_query;
  v_query_hash text;
  v_row_count int;
  v_sensitive_pattern text := '(?i)(password|secret|key|token|credential)';
BEGIN
  -- Basic security checks
  IF p_query IS NULL OR trim(p_query) = '' THEN
    RAISE EXCEPTION 'Empty query not allowed';
  END IF;
  
  -- Block DROP, TRUNCATE, and other dangerous commands
  IF p_query ~* '(?i)(^|\s)(drop|truncate|alter\s+user|create\s+user|grant\s+all|alter\s+system|alter\s+database)' THEN
    RAISE EXCEPTION 'Dangerous command detected and blocked';
  END IF;
  
  -- Block tampering with audit logs or sensitive tables
  IF p_query ~* '(?i)(^|\s)(delete\s+from|update|drop)\s+(audit|log|unified_audit_logs|secrets|auth\.users)' THEN
    RAISE EXCEPTION 'Operations on audit or sensitive tables are not allowed';
  END IF;
  
  -- Compute query hash for logging
  v_query_hash := encode(digest(p_query, 'sha256'), 'hex');
  
  -- Execute the query and capture the results
  BEGIN
    EXECUTE 'WITH query_result AS (' || p_query || ') 
             SELECT jsonb_agg(to_jsonb(query_result)) AS result, 
                    count(*) AS row_count 
             FROM query_result'
    INTO v_result, v_row_count;
    
    -- Handle NULL result (e.g., for UPDATE/INSERT statements that don't return rows)
    IF v_result IS NULL THEN
      -- Try to get affected row count for DML statements
      GET DIAGNOSTICS v_row_count = ROW_COUNT;
      v_result := jsonb_build_object('affected_rows', v_row_count);
    END IF;
    
    -- Add metadata
    v_result := jsonb_build_object(
      'data', v_result,
      'metadata', jsonb_build_object(
        'execution_time_ms', extract(milliseconds from clock_timestamp() - v_start_time),
        'row_count', v_row_count,
        'query_hash', v_query_hash
      )
    );
    
    -- Log the SQL execution (redact sensitive information)
    v_query_text := regexp_replace(v_query_text, v_sensitive_pattern || '\s*=\s*''[^'']*''', '\1=''[REDACTED]''', 'g');
    
    INSERT INTO unified_audit_logs (
      event_type,
      metadata,
      event_timestamp
    ) VALUES (
      'sql_query_executed',
      jsonb_build_object(
        'query_hash', v_query_hash,
        'query_text', v_query_text,
        'row_count', v_row_count,
        'execution_time_ms', extract(milliseconds from clock_timestamp() - v_start_time)
      ),
      clock_timestamp()
    );
    
    RETURN v_result;
    
  EXCEPTION WHEN OTHERS THEN
    -- Log the error
    INSERT INTO unified_audit_logs (
      event_type,
      error_message,
      metadata,
      event_timestamp
    ) VALUES (
      'sql_query_error',
      SQLERRM,
      jsonb_build_object(
        'query_hash', v_query_hash,
        'query_text', v_query_text,
        'error_detail', SQLSTATE
      ),
      clock_timestamp()
    );
    
    RAISE;
  END;
END;
$$;
