
import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/useToast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Play, Search } from "lucide-react";
import { TestResultsDisplay } from "./TestResultsDisplay";
import { Input } from "@/components/ui/input";

interface TestResult {
  messageId: string;
  message: string;
  hasMatch: boolean;
  confidence: number;
  matchedProduct?: {
    id: string;
    name: string;
    matchedFields: string[];
  };
  duration?: number;
}

export const TestMatchingPanel = () => {
  const [messageId, setMessageId] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult | null>(null);
  const { toast } = useToast();

  const handleRunTest = async () => {
    if (!messageId) {
      toast({
        title: "Message ID required",
        description: "Please enter a message ID to test product matching.",
        variant: "destructive",
      });
      return;
    }

    setIsRunning(true);
    setResults(null);

    try {
      const startTime = performance.now();
      
      // Get message data first
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .select('caption, analyzed_content')
        .eq('id', messageId)
        .single();
      
      if (messageError) {
        throw new Error(`Message not found: ${messageError.message}`);
      }
      
      // Run product matching
      const { data, error } = await supabase
        .functions.invoke('product-matching', {
          body: { messageId }
        });

      if (error) {
        throw new Error(`Failed to run product matching: ${error.message}`);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Format results
      const testResult: TestResult = {
        messageId,
        message: message.caption || 'No caption',
        hasMatch: !!data?.bestMatch,
        confidence: data?.bestMatch?.confidence || 0,
        duration,
      };
      
      if (data?.bestMatch) {
        // Fetch product details
        const { data: product, error: productError } = await supabase
          .from('gl_products')
          .select('new_product_name')
          .eq('id', data.bestMatch.product_id)
          .single();
          
        if (!productError && product) {
          testResult.matchedProduct = {
            id: data.bestMatch.product_id,
            name: product.new_product_name || 'Unknown product',
            matchedFields: data.bestMatch.match_fields || [],
          };
        }
      }
      
      setResults(testResult);
      
      toast({
        title: data?.bestMatch ? "Match found!" : "No match found",
        description: data?.bestMatch 
          ? `Found product match with ${Math.round(data.bestMatch.confidence * 100)}% confidence` 
          : "No products matched the message content",
      });
    } catch (error) {
      console.error("Error running test match:", error);
      toast({
        title: "Test failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleFindRecentMessage = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id')
        .not('analyzed_content', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error) throw error;
      
      if (data?.id) {
        setMessageId(data.id);
        toast({
          title: "Message found",
          description: `Found recent message with ID: ${data.id}`,
        });
      } else {
        toast({
          title: "No messages found",
          description: "No messages with analyzed content were found.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error finding recent message:", error);
      toast({
        title: "Error finding message",
        description: "Failed to find a recent message for testing.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Test Product Matching</CardTitle>
          <CardDescription>
            Test how the product matching algorithm works on a specific message
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="message-id">Message ID</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="message-id"
                  placeholder="Enter message ID"
                  value={messageId}
                  onChange={(e) => setMessageId(e.target.value)}
                  className="flex-1"
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={handleFindRecentMessage}
                  title="Find recent message"
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter a message ID to test the product matching algorithm
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleRunTest} disabled={isRunning || !messageId} className="w-full">
            {isRunning ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Running Test...</>
            ) : (
              <><Play className="mr-2 h-4 w-4" /> Run Test</>
            )}
          </Button>
        </CardFooter>
      </Card>
      
      <TestResultsDisplay result={results} />
    </div>
  );
};
