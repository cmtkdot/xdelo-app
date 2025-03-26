
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/useToast";
import { AlertTriangle, CheckCircle } from "lucide-react";

export function LogFixerCard() {
  const [isFixing, setIsFixing] = useState(false);
  const [results, setResults] = useState<{ fixed_count: number } | null>(null);
  const { toast } = useToast();

  const handleRunFix = async () => {
    try {
      setIsFixing(true);
      
      // Call the RPC function to fix invalid UUIDs
      const { data, error } = await supabase.rpc('xdelo_fix_audit_log_uuids');
      
      if (error) throw error;
      
      setResults(data);
      
      toast({
        title: "Log Fix Completed",
        description: `Successfully fixed ${data.fixed_count} audit log entries.`,
      });
    } catch (error) {
      console.error('Error fixing logs:', error);
      
      toast({
        title: 'Error',
        description: 'Failed to fix audit logs.',
        variant: 'destructive',
      });
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Log UUID Fixer
        </CardTitle>
        <CardDescription>
          Fix any invalid UUIDs in the audit logs table that may be causing errors.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          This utility will scan the unified_audit_logs table for any entries with invalid UUIDs 
          and repair them. This can help resolve errors in the Telegram webhook related to UUID validation.
        </p>
        
        {results && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-md flex items-center gap-2 mt-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <p className="text-sm font-medium text-green-700 dark:text-green-300">
              Fixed {results.fixed_count} audit log entries with invalid UUIDs.
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleRunFix}
          disabled={isFixing}
          variant="secondary"
        >
          {isFixing ? "Running Fix..." : "Run Log UUID Fix"}
        </Button>
      </CardFooter>
    </Card>
  );
}
