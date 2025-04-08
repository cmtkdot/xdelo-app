
import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/useToast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, PlayCircle, BarChart, AlertCircle, Info } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { BatchResultsDisplay } from "./BatchResultsDisplay";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { BatchProcessingTable } from "./BatchProcessingTable";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AnalyzedContent } from "@/types/utils/AnalyzedContent";

interface BatchResults {
  total: number;
  matched: number;
  unmatched: number;
  failed: number;
  averageConfidence: number;
  topMatches: {
    messageId: string;
    productName: string;
    confidence: number;
  }[];
}

interface ProcessingMessage {
  id: string;
  productName?: string;
  vendorUid?: string;
  purchaseDate?: string;
  status: 'processing' | 'matched' | 'unmatched' | 'error';
  matchConfidence?: number;
  matchedProductId?: string;
  matchedProductName?: string;
  processingStartedAt?: string;
  processingCompletedAt?: string;
  errorMessage?: string;
}

export const BatchMatchingPanel = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<BatchResults | null>(null);
  const [matchType, setMatchType] = useState<string>("recent");
  const [messagesCount, setMessagesCount] = useState<number>(20);
  const [processedMessages, setProcessedMessages] = useState<ProcessingMessage[]>([]);
  const { toast } = useToast();

  const handleRunBatchMatch = async () => {
    setIsProcessing(true);
    setProgress(0);
    setResults(null);
    setProcessedMessages([]);
    
    try {
      // Get messages based on selected criteria
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('id, caption, analyzed_content, vendor_uid, product_name, purchase_date')
        .not('analyzed_content', 'is', null)
        .order('created_at', { ascending: false })
        .limit(messagesCount);
      
      if (messagesError) throw messagesError;
      
      if (!messages || messages.length === 0) {
        toast({
          title: "No messages found",
          description: "No suitable messages were found for batch matching.",
          variant: "destructive",
        });
        return;
      }
      
      toast({
        title: "Batch matching started",
        description: `Processing ${messages.length} messages. Check the table for progress.`,
      });
      
      // Initialize progress tracking and processed messages
      let completedMessages = 0;
      const totalMessages = messages.length;
      
      // Create initial processing state for all messages
      const initialProcessingState = messages.map(msg => {
        // Safely extract properties from analyzed_content
        let productName: string | undefined;
        let vendorUid: string | undefined;
        let purchaseDate: string | undefined;
        
        if (msg.analyzed_content && typeof msg.analyzed_content === 'object' && !Array.isArray(msg.analyzed_content)) {
          productName = (msg.analyzed_content as Record<string, any>).product_name;
          vendorUid = (msg.analyzed_content as Record<string, any>).vendor_uid;
          purchaseDate = (msg.analyzed_content as Record<string, any>).purchase_date;
        }
        
        return {
          id: msg.id,
          productName: msg.product_name || productName,
          vendorUid: msg.vendor_uid || vendorUid,
          purchaseDate: msg.purchase_date || purchaseDate,
          status: 'processing' as const,
          processingStartedAt: new Date().toISOString(),
        };
      });
      
      setProcessedMessages(initialProcessingState);
      
      const updateProgress = () => {
        completedMessages++;
        const newProgress = Math.round((completedMessages / totalMessages) * 100);
        setProgress(newProgress);
      };
      
      // Process messages in batches of 5
      const batchSize = 5;
      const batchResults = [];
      
      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize);
        const batchIds = batch.map(m => m.id);
        
        try {
          // Process batch
          const { data: batchData, error: batchError } = await supabase
            .functions.invoke('product-matching', {
              body: { 
                messageIds: batchIds,
                batch: true
              }
            });
            
          if (batchError) {
            console.error("Error in batch processing:", batchError);
            
            // Update status for failed messages
            const updatedMessages = [...processedMessages];
            batchIds.forEach(id => {
              const msgIndex = updatedMessages.findIndex(m => m.id === id);
              if (msgIndex >= 0) {
                updatedMessages[msgIndex] = {
                  ...updatedMessages[msgIndex],
                  status: 'error',
                  errorMessage: batchError.message || "Failed to process",
                  processingCompletedAt: new Date().toISOString(),
                };
              }
            });
            setProcessedMessages(updatedMessages);
            continue;
          }
          
          if (batchData?.results) {
            batchResults.push(...batchData.results);
            
            // Update messages with match results
            const updatedMessages = [...processedMessages];
            
            // For each result, update the corresponding message
            batchData.results.forEach(result => {
              const messageId = result.messageId || result.message_id;
              const msgIndex = updatedMessages.findIndex(m => m.id === messageId);
              
              if (msgIndex >= 0) {
                let status: 'matched' | 'unmatched' | 'error' = 'unmatched';
                let matchedProduct = null;
                
                if (result.success && result.bestMatch) {
                  status = 'matched';
                  matchedProduct = result.bestMatch;
                } else if (!result.success) {
                  status = 'error';
                }
                
                updatedMessages[msgIndex] = {
                  ...updatedMessages[msgIndex],
                  status,
                  matchConfidence: matchedProduct?.confidence || 0,
                  matchedProductId: matchedProduct?.product_id,
                  matchedProductName: matchedProduct?.product_name,
                  errorMessage: !result.success ? "Failed to match" : undefined,
                  processingCompletedAt: new Date().toISOString(),
                };
              }
            });
            
            setProcessedMessages(updatedMessages);
          }
        } catch (error) {
          console.error("Error processing batch:", error);
          
          // Update status for failed messages
          const updatedMessages = [...processedMessages];
          batchIds.forEach(id => {
            const msgIndex = updatedMessages.findIndex(m => m.id === id);
            if (msgIndex >= 0) {
              updatedMessages[msgIndex] = {
                ...updatedMessages[msgIndex],
                status: 'error',
                errorMessage: error instanceof Error ? error.message : "Unknown error",
                processingCompletedAt: new Date().toISOString(),
              };
            }
          });
          setProcessedMessages(updatedMessages);
        }
        
        // Update progress for all messages in batch
        batch.forEach(() => updateProgress());
        
        // Toast notification for batch completion
        toast({
          title: "Batch progress",
          description: `Processed ${Math.min((i + batchSize), messages.length)} of ${messages.length} messages.`,
        });
      }
      
      // Process results
      const matchedResults = batchResults.filter(r => r.success && r.bestMatch);
      
      // Get product names for top matches
      const topMatches = matchedResults
        .sort((a, b) => (b.bestMatch?.confidence || 0) - (a.bestMatch?.confidence || 0))
        .slice(0, 5);
        
      const topMatchesWithDetails = await Promise.all(
        topMatches.map(async (match) => {
          const { data: product } = await supabase
            .from('gl_products')
            .select('new_product_name')
            .eq('id', match.bestMatch?.product_id)
            .single();
            
          return {
            messageId: match.bestMatch?.message_id || '',
            productName: product?.new_product_name || 'Unknown product',
            confidence: match.bestMatch?.confidence || 0
          };
        })
      );
      
      // Calculate summary
      const summaryResults: BatchResults = {
        total: batchResults.length,
        matched: matchedResults.length,
        unmatched: batchResults.filter(r => r.success && !r.bestMatch).length,
        failed: batchResults.filter(r => !r.success).length,
        averageConfidence: matchedResults.length > 0 
          ? matchedResults.reduce((sum, r) => sum + (r.bestMatch?.confidence || 0), 0) / matchedResults.length
          : 0,
        topMatches: topMatchesWithDetails
      };
      
      setResults(summaryResults);
      
      // Final toast notification
      toast({
        title: "Batch matching complete",
        description: `Matched ${summaryResults.matched} of ${summaryResults.total} messages.`,
      });
    } catch (error) {
      console.error("Error in batch matching:", error);
      toast({
        title: "Batch matching failed",
        description: "An error occurred during batch matching.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setProgress(100);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Batch Product Matching</CardTitle>
            <CardDescription>
              Process multiple messages at once to match them with products
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Messages to Process</Label>
                <RadioGroup defaultValue="recent" value={matchType} onValueChange={setMatchType} className="grid grid-cols-2 gap-4">
                  <div>
                    <RadioGroupItem value="recent" id="recent" className="peer sr-only" />
                    <Label
                      htmlFor="recent"
                      className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                    >
                      <span className="text-sm font-medium">Recent Messages</span>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="unmatched" id="unmatched" className="peer sr-only" disabled />
                    <Label
                      htmlFor="unmatched"
                      className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-not-allowed opacity-50"
                    >
                      <span className="text-sm font-medium">Unmatched Messages</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              
              <div className="space-y-2">
                <Label>Number of Messages</Label>
                <RadioGroup defaultValue="20" value={messagesCount.toString()} onValueChange={(v) => setMessagesCount(Number(v))} className="grid grid-cols-3 gap-4">
                  <div>
                    <RadioGroupItem value="10" id="m-10" className="peer sr-only" />
                    <Label
                      htmlFor="m-10"
                      className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                    >
                      <span className="text-sm font-medium">10</span>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="20" id="m-20" className="peer sr-only" />
                    <Label
                      htmlFor="m-20"
                      className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                    >
                      <span className="text-sm font-medium">20</span>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="50" id="m-50" className="peer sr-only" />
                    <Label
                      htmlFor="m-50"
                      className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                    >
                      <span className="text-sm font-medium">50</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              
              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Processing Messages</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleRunBatchMatch} disabled={isProcessing} className="w-full">
              {isProcessing ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
              ) : (
                <><PlayCircle className="mr-2 h-4 w-4" /> Start Batch Match</>
              )}
            </Button>
          </CardFooter>
        </Card>
        
        <BatchResultsDisplay results={results} />
      </div>
      
      {/* New section for showing processing messages in a table */}
      {processedMessages.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center">
              <Info className="mr-2 h-4 w-4" /> 
              Processing Details
            </CardTitle>
            <CardDescription>
              Detailed information about each message being processed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all">
              <TabsList className="mb-4">
                <TabsTrigger value="all">All Messages ({processedMessages.length})</TabsTrigger>
                <TabsTrigger value="matched">
                  Matched ({processedMessages.filter(m => m.status === 'matched').length})
                </TabsTrigger>
                <TabsTrigger value="unmatched">
                  Unmatched ({processedMessages.filter(m => m.status === 'unmatched').length})
                </TabsTrigger>
                <TabsTrigger value="error">
                  Errors ({processedMessages.filter(m => m.status === 'error').length})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="all">
                <BatchProcessingTable 
                  messages={processedMessages} 
                  isLoading={isProcessing && processedMessages.every(m => m.status === 'processing')} 
                />
              </TabsContent>
              
              <TabsContent value="matched">
                <BatchProcessingTable 
                  messages={processedMessages.filter(m => m.status === 'matched')} 
                  isLoading={isProcessing} 
                />
              </TabsContent>
              
              <TabsContent value="unmatched">
                <BatchProcessingTable 
                  messages={processedMessages.filter(m => m.status === 'unmatched')} 
                  isLoading={isProcessing} 
                />
              </TabsContent>
              
              <TabsContent value="error">
                <BatchProcessingTable 
                  messages={processedMessages.filter(m => m.status === 'error')} 
                  isLoading={isProcessing} 
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
