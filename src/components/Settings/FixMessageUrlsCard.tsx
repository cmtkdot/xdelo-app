
import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';

export function FixMessageUrlsCard() {
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [result, setResult] = React.useState<{ success: boolean; message: string } | null>(null);
  const { toast } = useToast();

  const runFixMessageUrlTriggers = async () => {
    try {
      setIsProcessing(true);
      setResult(null);
      
      const { data, error } = await supabase.functions.invoke('xdelo_fix_message_url_generation');
      
      if (error) {
        throw new Error(error.message);
      }
      
      setResult({
        success: true,
        message: "Message URL generation has been fixed successfully!"
      });
      
      toast({
        title: "Success",
        description: "Message URL generation has been fixed",
        variant: "default"
      });
    } catch (error) {
      console.error("Error fixing message URL generation:", error);
      
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
      
      toast({
        title: "Error",
        description: "Failed to fix message URL generation",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">Fix Message URL Generation</CardTitle>
        <CardDescription>
          Fix the message URL generation for non-media messages stored in the database
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          This will update the database triggers to properly generate message URLs for non-media messages by extracting
          data from the telegram_data JSON field.
        </p>
        
        {result && (
          <div className={`p-3 mb-4 rounded-md flex items-start gap-2 ${result.success ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400'}`}>
            {result.success ? (
              <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            )}
            <div>
              <p className="font-medium">{result.success ? "Success" : "Error"}</p>
              <p className="text-sm">{result.message}</p>
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter>
        <Button 
          onClick={runFixMessageUrlTriggers} 
          disabled={isProcessing}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Spinner className="mr-2 h-4 w-4" />
              Updating triggers...
            </>
          ) : "Fix Message URL Generation"}
        </Button>
      </CardFooter>
    </Card>
  );
}
