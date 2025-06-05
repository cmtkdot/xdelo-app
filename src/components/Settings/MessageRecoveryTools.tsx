
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { useSupabase } from "@/integrations/supabase/SupabaseProvider";
import { Separator } from "@/components/ui/separator";

export function MessageRecoveryTools() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ recovered: number; errors: number } | null>(null);
  const { toast } = useToast();
  const supabase = useSupabase();

  const handleRecoverDuplicateMessages = async () => {
    setIsProcessing(true);
    setResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('recover-duplicate-messages', {
        method: 'POST'
      });
      
      if (error) throw error;
      
      setResult({
        recovered: data.recovered || 0,
        errors: data.errors || 0
      });
      
      toast({
        title: "Recovery Complete",
        description: `Successfully recovered ${data.recovered} messages with ${data.errors} errors`,
      });
    } catch (error) {
      console.error("Error recovering messages:", error);
      toast({
        title: "Recovery Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Message Recovery Tools</CardTitle>
        <CardDescription>
          Tools to recover messages that got stuck due to processing errors
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="text-lg font-medium mb-2">Duplicate File Recovery</h3>
          <p className="text-sm text-muted-foreground mb-4">
            This will recover messages stuck in error state due to duplicate file_unique_id constraints.
            The recovery process will generate new unique identifiers for these messages and mark them as duplicates.
          </p>
          
          {result && (
            <Alert className="mb-4" variant={result.errors === 0 ? "default" : "destructive"}>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Recovery Results</AlertTitle>
              <AlertDescription>
                {result.recovered} messages successfully recovered with {result.errors} errors.
              </AlertDescription>
            </Alert>
          )}
        </div>
        
        <Separator />
        
        <div className="flex justify-end">
          <Button 
            onClick={handleRecoverDuplicateMessages} 
            disabled={isProcessing}
            className="flex items-center"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <AlertCircle className="mr-2 h-4 w-4" />
                Recover Duplicate Messages
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
