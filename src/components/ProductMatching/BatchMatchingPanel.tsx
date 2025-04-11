import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/useToast";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BatchResults, ProcessingMessage, GlProduct } from "@/types/ProductMatching";

export const BatchMatchingPanel = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoMatching, setIsAutoMatching] = useState(false);
  const [results, setResults] = useState<BatchResults | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [unprocessedMessages, setUnprocessedMessages] = useState<ProcessingMessage[]>([]);
  const [products, setProducts] = useState<GlProduct[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const { toast } = useToast();

  const mapMessagesToProcessingItems = (messages: Message[]): ProcessingMessage[] => {
    return messages.map(message => {
      let analyzedContent = message.analyzed_content;
      
      if (typeof analyzedContent === 'string') {
        try {
          analyzedContent = JSON.parse(analyzedContent);
        } catch (e) {
          analyzedContent = {};
        }
      }
      
      if (!analyzedContent || typeof analyzedContent !== 'object') {
        analyzedContent = {};
      }
      
      return {
        id: message.id,
        caption: message.caption || '',
        analyzed_content: analyzedContent,
        vendor_uid: analyzedContent?.vendor_uid || '',
        product_name: analyzedContent?.product_name || '',
        purchase_date: analyzedContent?.purchase_date || ''
      };
    });
  };

  const loadUnprocessedMessages = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("id, caption, analyzed_content, vendor_uid, product_name, purchase_date")
        .is("product_id", null)
        .limit(100);

      if (error) throw error;

      const filteredMessages = mapMessagesToProcessingItems(data || []) as ProcessingMessage[];

      setUnprocessedMessages(filteredMessages);

      toast({
        title: "Messages loaded",
        description: `Found ${filteredMessages.length} unprocessed messages with analyzable content`,
      });
    } catch (err) {
      console.error("Error loading unprocessed messages:", err);
      toast({
        title: "Error",
        description: "Failed to load unprocessed messages",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const runBatchMatching = async () => {
    setIsAutoMatching(true);
    setResults(null);
    try {
      const messageIds = unprocessedMessages.map((msg) => msg.id);
      
      const { data, error } = await supabase.functions.invoke("product-matching-batch", {
        body: {
          messageIds,
          minConfidence: 0.6 // Use a slightly lower threshold for batch processing
        }
      });
      
      if (error) throw error;
      
      setResults(data as BatchResults);
      
      toast({
        title: "Batch matching complete",
        description: `Processed ${data.summary.total} messages with ${data.summary.matched} matches found.`,
      });
    } catch (err) {
      console.error("Error running batch matching:", err);
      toast({
        title: "Error",
        description: "Failed to process batch matching",
        variant: "destructive",
      });
    } finally {
      setIsAutoMatching(false);
    }
  };

  const handleManualMatch = async (messageId: string, productId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("set-message-product", {
        body: {
          messageId,
          productId,
          matchType: "manual"
        }
      });
      
      if (error) throw error;
      
      setUnprocessedMessages(prev => prev.filter(msg => msg.id !== messageId));
      
      toast({
        title: "Product matched",
        description: "Message successfully matched to product",
      });
    } catch (err) {
      console.error("Error matching product:", err);
      toast({
        title: "Error",
        description: "Failed to match product",
        variant: "destructive",
      });
    }
  };

  const fetchProductsForMatching = async () => {
    try {
      const { data, error } = await supabase
        .from('gl_products')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching products:', error);
        setErrorMessage(`Failed to fetch products: ${error.message}`);
        return;
      }
      
      setProducts(data as unknown as GlProduct[]);
    } catch (err) {
      console.error('Exception fetching products:', err);
      setErrorMessage(`An error occurred: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const applyAllMatches = async () => {
    if (!results || !results.results) return;
    
    setIsLoading(true);
    try {
      const matchesToApply = results.results
        .filter(r => r.success && r.bestMatch && r.bestMatch.confidence > 0.7)
        .map(r => ({
          messageId: r.bestMatch?.message_id,
          productId: r.bestMatch?.product_id,
          confidence: r.bestMatch?.confidence
        }));
      
      if (matchesToApply.length === 0) {
        toast({
          title: "No matches to apply",
          description: "There are no high-confidence matches to apply.",
        });
        setIsLoading(false);
        return;
      }
      
      const { data, error } = await supabase.functions.invoke("apply-batch-matches", {
        body: { matches: matchesToApply }
      });
      
      if (error) throw error;
      
      toast({
        title: "Matches applied",
        description: `Successfully applied ${data.applied} product matches.`,
      });
      
      loadUnprocessedMessages();
    } catch (err) {
      console.error("Error applying matches:", err);
      toast({
        title: "Error",
        description: "Failed to apply matches",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Batch Product Matching</h3>
        <div className="space-x-2">
          <Button
            variant="outline"
            onClick={loadUnprocessedMessages}
            disabled={isLoading || isAutoMatching}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Load Unprocessed Messages"
            )}
          </Button>
          <Button
            onClick={runBatchMatching}
            disabled={isLoading || isAutoMatching || unprocessedMessages.length === 0}
          >
            {isAutoMatching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Run Auto-Matching"
            )}
          </Button>
        </div>
      </div>

      {unprocessedMessages.length === 0 && !isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          No unprocessed messages found. Click "Load Unprocessed Messages" to find messages that need product matching.
        </div>
      )}

      {unprocessedMessages.length > 0 && (
        <Card className="p-4">
          <h4 className="font-medium mb-4">
            Unprocessed Messages ({unprocessedMessages.length})
          </h4>
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {unprocessedMessages.map((message) => (
              <div
                key={message.id}
                className="p-3 border rounded-md flex justify-between items-start"
              >
                <div>
                  <p className="font-medium line-clamp-1">{message.caption || "No caption"}</p>
                  <div className="text-sm text-muted-foreground mt-1">
                    {message.vendor_uid && <span className="mr-3">Vendor: {message.vendor_uid}</span>}
                    {message.product_name && <span className="mr-3">Product: {message.product_name}</span>}
                    {message.purchase_date && <span>Date: {message.purchase_date}</span>}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const products = await fetchProductsForMatching();
                    const productId = prompt(
                      "Select a product ID to match:\n" +
                      products.map(p => `${p.id}: ${p.new_product_name}`).join("\n")
                    );
                    if (productId) {
                      handleManualMatch(message.id, productId);
                    }
                  }}
                >
                  Manual Match
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {results && (
        <Card className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-medium">
              Matching Results
            </h4>
            <Button 
              onClick={applyAllMatches}
              disabled={isLoading || !results.success}
              size="sm"
            >
              Apply High-Confidence Matches
            </Button>
          </div>
          
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="p-3 bg-muted rounded-md text-center">
              <div className="text-2xl font-bold">{results.summary.total}</div>
              <div className="text-sm text-muted-foreground">Total</div>
            </div>
            <div className="p-3 bg-green-50 text-green-700 rounded-md text-center">
              <div className="text-2xl font-bold">{results.summary.matched}</div>
              <div className="text-sm">Matched</div>
            </div>
            <div className="p-3 bg-amber-50 text-amber-700 rounded-md text-center">
              <div className="text-2xl font-bold">{results.summary.unmatched}</div>
              <div className="text-sm">Unmatched</div>
            </div>
            <div className="p-3 bg-red-50 text-red-700 rounded-md text-center">
              <div className="text-2xl font-bold">{results.summary.failed}</div>
              <div className="text-sm">Failed</div>
            </div>
          </div>
          
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {results.results.map((result, index) => (
              <div 
                key={index}
                className={`p-3 border rounded-md flex items-center ${
                  !result.success 
                    ? 'border-red-200 bg-red-50' 
                    : result.bestMatch 
                      ? 'border-green-200 bg-green-50' 
                      : 'border-amber-200 bg-amber-50'
                }`}
              >
                {!result.success && <XCircle className="h-5 w-5 text-red-500 mr-2" />}
                {result.success && !result.bestMatch && <XCircle className="h-5 w-5 text-amber-500 mr-2" />}
                {result.success && result.bestMatch && <CheckCircle className="h-5 w-5 text-green-500 mr-2" />}
                
                <div className="flex-1">
                  {result.success && result.bestMatch && (
                    <div className="flex justify-between">
                      <span>Match found with {Math.round(result.bestMatch.confidence * 100)}% confidence</span>
                      <span className="font-medium">{result.bestMatch.matches.product_name.value}</span>
                    </div>
                  )}
                  {result.success && !result.bestMatch && (
                    <span>No product match found</span>
                  )}
                  {!result.success && (
                    <span className="text-red-700">Processing error</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
