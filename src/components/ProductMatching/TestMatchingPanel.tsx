
import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/useToast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search } from "lucide-react";
import { TestResultsDisplay } from "./TestResultsDisplay";
import { fetchMatchingConfig } from "@/lib/productMatchingConfig";
import { Database } from "@/integrations/supabase/database.types";

type GlProduct = Database['public']['Tables']['gl_products']['Row'];

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
  const [selectedMessageId, setSelectedMessageId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [result, setResult] = useState<TestResult | null>(null);
  const [customText, setCustomText] = useState("");
  const [useCustomText, setUseCustomText] = useState(false);
  const { toast } = useToast();

  const loadRecentMessages = async () => {
    setIsLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id, caption, analyzed_content')
        .not('analyzed_content', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      
      setMessages(data || []);
      
      if (data && data.length > 0) {
        setSelectedMessageId(data[0].id);
      }
    } catch (error) {
      console.error("Error loading messages:", error);
      toast({
        title: "Error loading messages",
        description: "There was a problem loading recent messages.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleRunTest = async () => {
    setIsLoading(true);
    setResult(null);
    
    try {
      // If no message is selected and we're not using custom text, show an error
      if (!selectedMessageId && !useCustomText) {
        toast({
          title: "No message selected",
          description: "Please select a message or enter custom text to test.",
          variant: "destructive",
        });
        return;
      }
      
      // Get the current configuration
      const config = await fetchMatchingConfig();
      
      const startTime = performance.now();
      
      // Call the product matching endpoint
      const { data: matchingResult, error: matchingError } = await supabase
        .functions.invoke('product-matching', {
          body: { 
            ...(useCustomText 
              ? { customText } 
              : { messageId: selectedMessageId }),
            config: {
              similarityThreshold: config.similarityThreshold,
              partialMatchEnabled: config.partialMatch.enabled
            }
          }
        });

      if (matchingError) throw matchingError;
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Find the message content for display
      let messageContent = '';
      if (useCustomText) {
        messageContent = customText;
      } else {
        const message = messages.find(m => m.id === selectedMessageId);
        messageContent = message?.caption || 
                       (message?.analyzed_content 
                         ? `Product: ${message.analyzed_content.product_name || ''}\nVendor: ${message.analyzed_content.vendor_uid || ''}\nDate: ${message.analyzed_content.purchase_date || ''}` 
                         : '');
      }
      
      // If we have a match
      if (matchingResult?.bestMatch) {
        // Get product details from the gl_products table
        const { data: productData, error: productError } = await supabase
          .from('gl_products')
          .select('new_product_name, id')
          .eq('id', matchingResult.bestMatch.product_id)
          .single();
          
        if (productError) {
          console.error("Error fetching product details:", productError);
          throw productError;
        }
          
        const product = productData as GlProduct;
        
        setResult({
          messageId: useCustomText ? 'custom-text' : selectedMessageId,
          message: messageContent,
          hasMatch: true,
          confidence: matchingResult.bestMatch.confidence,
          matchedProduct: {
            id: matchingResult.bestMatch.product_id,
            name: product?.new_product_name || 'Unknown Product',
            matchedFields: matchingResult.bestMatch.match_fields || []
          },
          duration
        });
      } else {
        setResult({
          messageId: useCustomText ? 'custom-text' : selectedMessageId,
          message: messageContent,
          hasMatch: false,
          confidence: 0,
          duration
        });
      }
      
      toast({
        title: matchingResult?.bestMatch ? "Match found" : "No match found",
        description: matchingResult?.bestMatch 
          ? `Found a product match with ${Math.round(matchingResult.bestMatch.confidence * 100)}% confidence.`
          : "No product matches found for the selected message.",
      });
    } catch (error) {
      console.error("Error running match test:", error);
      toast({
        title: "Error running test",
        description: "There was a problem testing the product match.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Load messages when component mounts
  if (messages.length === 0 && !isLoadingMessages) {
    loadRecentMessages();
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Test Product Matching</CardTitle>
          <CardDescription>
            Test how the matching algorithm works with specific messages
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex items-center space-x-2">
              <Switch
                id="use-custom-text"
                checked={useCustomText}
                onCheckedChange={setUseCustomText}
              />
              <Label htmlFor="use-custom-text">Use Custom Text</Label>
            </div>
            
            {useCustomText ? (
              <div className="space-y-2">
                <Label htmlFor="custom-text">Enter Text to Match</Label>
                <Textarea
                  id="custom-text"
                  placeholder="Enter product details to match..."
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  className="min-h-[120px]"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="message-select">Select Message</Label>
                <Select 
                  value={selectedMessageId} 
                  onValueChange={setSelectedMessageId}
                  disabled={isLoadingMessages}
                >
                  <SelectTrigger id="message-select" className="w-full">
                    <SelectValue placeholder={isLoadingMessages ? "Loading messages..." : "Select a message"} />
                  </SelectTrigger>
                  <SelectContent>
                    {messages.map((message) => (
                      <SelectItem key={message.id} value={message.id}>
                        {message.caption?.substring(0, 40) || 
                         (message.analyzed_content?.product_name || "No caption")}
                        {message.caption?.length > 40 ? "..." : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={loadRecentMessages}
                  disabled={isLoadingMessages}
                >
                  {isLoadingMessages ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
                  Refresh Messages
                </Button>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={handleRunTest} 
            disabled={isLoading || (selectedMessageId === "" && !useCustomText)} 
            className="w-full"
          >
            {isLoading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Testing...</>
            ) : (
              <>Run Test Match</>
            )}
          </Button>
        </CardFooter>
      </Card>
      
      <TestResultsDisplay result={result} />
    </div>
  );
};
