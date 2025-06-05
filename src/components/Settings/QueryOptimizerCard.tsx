
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/useToast";
import { Loader2, Timer, AlertTriangle } from "lucide-react";

export function QueryOptimizerCard() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const { toast } = useToast();
  
  const handleKillLongQueries = async () => {
    try {
      setIsRunning(true);
      
      // Call the RPC function
      const { data, error } = await supabase.rpc(
        'xdelo_kill_long_queries',
        { older_than_seconds: 60 }
      );
      
      if (error) throw error;
      
      setResults(data);
      
      if (!data || data.length === 0) {
        toast({
          title: "No Long-Running Queries",
          description: "There are no queries that need to be terminated.",
        });
      } else {
        toast({
          title: "Long Queries Terminated",
          description: `Successfully terminated ${data.length} long-running ${data.length === 1 ? 'query' : 'queries'}.`,
        });
      }
    } catch (error) {
      console.error('Error killing long queries:', error);
      
      toast({
        title: 'Error',
        description: 'Failed to terminate long-running queries.',
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Timer className="h-5 w-5 text-amber-500" />
          Database Query Optimizer
        </CardTitle>
        <CardDescription>
          Manage long-running database queries that might be blocking webhook processes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Long-running queries can block webhook processing and cause timeouts. This utility can terminate any queries 
          that have been running for more than 60 seconds to prevent database congestion.
        </p>
        
        {results && results.length > 0 && (
          <div className="mt-4 border rounded-md overflow-hidden">
            <div className="bg-muted px-4 py-2 font-medium text-sm">
              Terminated Queries ({results.length})
            </div>
            <div className="p-4 space-y-2">
              {results.map((query, i) => (
                <div key={i} className="bg-destructive/10 p-3 rounded-md">
                  <div className="flex items-center gap-2 text-sm font-medium mb-1">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span>PID: {query.pid}</span>
                    <span className="text-xs px-2 py-0.5 bg-destructive/20 rounded-full">
                      {query.killed ? 'Terminated' : 'Failed to terminate'}
                    </span>
                  </div>
                  <div className="text-xs font-mono bg-card p-2 rounded-sm border overflow-x-auto">
                    {query.query}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    User: {query.usename} | Started: {new Date(query.query_start).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleKillLongQueries}
          disabled={isRunning}
          variant="destructive"
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Terminating Long Queries...
            </>
          ) : (
            "Terminate Long Queries"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
