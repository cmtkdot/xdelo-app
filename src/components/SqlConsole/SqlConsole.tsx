
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Play, Code } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';

export function SqlConsole() {
  const [sql, setSql] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const { toast } = useToast();

  const handleExecute = async () => {
    if (!sql.trim()) {
      toast({
        title: "SQL Required",
        description: "Please enter an SQL query to execute",
        variant: "destructive"
      });
      return;
    }

    setIsExecuting(true);
    setResult(null);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('xdelo_run_sql_migration', {
        body: { sql_command: sql }
      });

      if (error) {
        setError(error.message);
        toast({
          title: "Execution Failed",
          description: error.message,
          variant: "destructive"
        });
      } else {
        setResult(data);
        toast({
          title: "SQL Executed",
          description: "Query executed successfully"
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      toast({
        title: "Execution Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Code className="mr-2 h-5 w-5" />
            SQL Query
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Enter SQL query to execute..."
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            className="min-h-[200px] font-mono text-sm"
          />
          <div className="mt-4 flex justify-end">
            <Button 
              onClick={handleExecute} 
              disabled={isExecuting}
              className="flex items-center"
            >
              <Play className="mr-2 h-4 w-4" />
              {isExecuting ? "Executing..." : "Execute SQL"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/10">
          <CardHeader>
            <CardTitle className="flex items-center text-red-600">
              <AlertCircle className="mr-2 h-5 w-5" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-red-600 text-sm">{error}</pre>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Result</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-xs overflow-auto max-h-[400px]">
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
