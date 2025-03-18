
import React from 'react';
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Database } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from '@/hooks/useToast';
import { supabase } from '@/lib/supabase';

export function FixMessageUrlsCard() {
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isFixingColumns, setIsFixingColumns] = React.useState(false);
  const [results, setResults] = React.useState<{
    success: boolean;
    fixed?: number;
    error?: string;
    columns_fixed?: string[];
  } | null>(null);
  
  const { toast } = useToast();

  const handleRunRepair = async () => {
    try {
      setIsProcessing(true);
      
      // Call the edge function to update message URLs
      const { data, error } = await supabase.functions.invoke('xdelo_fix_message_url_generation', {
        body: { action: 'repair' }
      });
      
      if (error) throw error;
      
      setResults({
        success: data.status === 'success',
        fixed: data.updated_count || 0,
        error: data.error
      });
      
      toast({
        title: data.status === 'success' ? 'Repair Successful' : 'Repair Failed',
        description: data.status === 'success' 
          ? `Fixed ${data.updated_count || 0} message URLs` 
          : `Error: ${data.error}`,
        variant: data.status === 'success' ? 'default' : 'destructive'
      });
    } catch (error) {
      console.error('Error repairing message URLs:', error);
      
      setResults({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      toast({
        title: 'Error',
        description: 'Failed to repair message URLs. See console for details.',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFixColumns = async () => {
    try {
      setIsFixingColumns(true);
      
      // First, try using RPC
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('xdelo_run_fix_missing_columns');
      
      if (rpcError) {
        // If RPC fails, try the Edge Function
        const { data, error } = await supabase.functions.invoke('xdelo_fix_missing_columns');
        
        if (error) throw error;
        
        setResults({
          success: data.success,
          columns_fixed: data.columns_added,
          error: data.error
        });
        
        toast({
          title: data.success ? 'Fix Successful' : 'Fix Failed',
          description: data.message || `Added columns: ${(data.columns_added || []).join(', ')}`,
          variant: data.success ? 'default' : 'destructive'
        });
      } else {
        // RPC succeeded
        setResults({
          success: rpcData.success,
          columns_fixed: rpcData.columns_added,
          error: rpcData.error
        });
        
        toast({
          title: rpcData.success ? 'Fix Successful' : 'Fix Failed',
          description: rpcData.message || `Added columns: ${(rpcData.columns_added || []).join(', ')}`,
          variant: rpcData.success ? 'default' : 'destructive'
        });
      }
    } catch (error) {
      console.error('Error fixing missing columns:', error);
      
      setResults({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      toast({
        title: 'Error',
        description: 'Failed to fix missing columns. See console for details.',
        variant: 'destructive'
      });
    } finally {
      setIsFixingColumns(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">Fix Message URLs</CardTitle>
        <CardDescription>
          Repair telegram message URLs in the database
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground mb-4">
          This will fix Telegram message URLs for messages that have missing or incorrect URLs.
          It's also useful after adding chat channels or updating URL formats.
        </p>
        
        {results && (
          <div className="mt-2 p-3 text-sm border rounded bg-gray-100 dark:bg-gray-800">
            <div className="font-medium mb-1">
              {results.success ? (
                <span className="text-green-600 dark:text-green-400">Operation Successful</span>
              ) : (
                <span className="text-red-600 dark:text-red-400">Operation Failed</span>
              )}
            </div>
            <div className="text-xs">
              {results.success 
                ? results.fixed !== undefined 
                  ? `Fixed ${results.fixed} message URLs` 
                  : results.columns_fixed 
                    ? `Added columns: ${results.columns_fixed.join(', ')}` 
                    : 'Operation completed'
                : `Error: ${results.error}`
              }
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
        <Button
          onClick={handleRunRepair}
          disabled={isProcessing || isFixingColumns}
          className="w-full flex items-center justify-center gap-2"
          variant="default"
        >
          {isProcessing ? (
            <>
              <Spinner className="h-4 w-4" />
              Repairing URLs...
            </>
          ) : (
            <>
              <Database className="h-4 w-4" />
              Fix Message URLs
            </>
          )}
        </Button>
        
        <Button
          onClick={handleFixColumns}
          disabled={isProcessing || isFixingColumns}
          className="w-full flex items-center justify-center gap-2"
          variant="outline"
        >
          {isFixingColumns ? (
            <>
              <Spinner className="h-4 w-4" />
              Adding Columns...
            </>
          ) : (
            <>
              <Database className="h-4 w-4" />
              Fix Missing Columns
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
