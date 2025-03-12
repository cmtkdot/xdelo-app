
import { useState } from 'react';
import { useSupabaseClient } from '@/integrations/supabase/client';
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
  const supabaseClient = useSupabaseClient();

  const executeQuery = async (query: string, params?: any[]) => {
    try {
      setIsExecuting(true);
      
      const { data, error } = await supabaseClient.functions.invoke('xdelo_execute_sql', {
        body: { 
          query,
          params
        }
      });

      if (error) {
        throw error;
      }

      const result: SqlExecutionResult = {
        success: true,
        data: data.data,
        metadata: data.metadata
      };

      setResults(result);
      
      toast({
        title: 'Query executed successfully',
        description: `Retrieved ${data.metadata?.row_count || 0} rows in ${data.metadata?.execution_time_ms || 0}ms`
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
