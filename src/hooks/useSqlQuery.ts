
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './useToast';

interface SqlExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    execution_time_ms: number;
    row_count: number;
    query_hash: string;
  };
}

export function useSqlQuery() {
  const [isExecuting, setIsExecuting] = useState(false);
  const [results, setResults] = useState<SqlExecutionResult | null>(null);
  const { toast } = useToast();

  const executeQuery = async (query: string, params?: any[]) => {
    try {
      setIsExecuting(true);
      
      // Execute the SQL directly using RPC
      const { data, error } = await supabase.rpc(
        "xdelo_execute_sql_migration", 
        { sql_command: query }
      );

      if (error) {
        throw error;
      }

      const result: SqlExecutionResult = {
        success: true,
        data: data,
        metadata: {
          execution_time_ms: 0,
          row_count: 0,
          query_hash: ''
        }
      };

      setResults(result);
      
      toast({
        title: 'Query executed successfully',
        description: `The SQL command completed successfully`
      });
      
      return result;
    } catch (error) {
      const errorResult: SqlExecutionResult = {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
      
      setResults(errorResult);
      
      toast({
        title: 'Query execution failed',
        description: error.message,
        variant: 'destructive'
      });
      
      return errorResult;
    } finally {
      setIsExecuting(false);
    }
  };

  return {
    isExecuting,
    results,
    executeQuery
  };
}
