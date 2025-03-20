
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Loader2, Search, List, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { MatchResult } from '@/types/utils/MatchResult';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const ProductMatchingPage = () => {
  const [productName, setProductName] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [isMatching, setIsMatching] = useState(false);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [bestMatch, setBestMatch] = useState<MatchResult | null>(null);
  const [activeTab, setActiveTab] = useState('single');
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchResults, setBatchResults] = useState<{
    total: number;
    processed: number;
    matched: number;
    failed: number;
  }>({
    total: 0,
    processed: 0,
    matched: 0,
    failed: 0
  });

  // Fetch messages that need matching
  const { data: unprocessedMessages, isLoading: isLoadingMessages } = useQuery({
    queryKey: ['unprocessed-messages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('id, caption, analyzed_content, media_group_id')
        .is('glide_row_id', null)
        .eq('deleted_from_telegram', false)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data;
    },
    refetchOnWindowFocus: false
  });

  const matchSingleProduct = async () => {
    if (!productName) {
      toast.error('Please enter a product name');
      return;
    }

    setIsMatching(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/product-matching`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          type: 'MATCH_PRODUCT',
          request: {
            productName,
            vendorName,
            poNumber,
            minConfidence: 0.6
          }
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setMatchResults(result.data.matches || []);
        setBestMatch(result.data.bestMatch);
        
        if (result.data.matches?.length === 0) {
          toast.info('No matches found for this product');
        } else {
          toast.success(`Found ${result.data.matches.length} potential matches`);
        }
      } else {
        toast.error('Error matching product: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error matching product:', error);
      toast.error('Failed to match product');
    } finally {
      setIsMatching(false);
    }
  };

  const matchBatchProducts = async () => {
    if (!unprocessedMessages || unprocessedMessages.length === 0) {
      toast.error('No messages to process');
      return;
    }

    setIsMatching(true);
    setBatchProgress(0);
    setBatchResults({
      total: unprocessedMessages.length,
      processed: 0,
      matched: 0,
      failed: 0
    });

    try {
      // Get message IDs array
      const messageIds = unprocessedMessages.map(message => message.id);
      
      // Process in chunks of 10 to avoid overloading
      const chunkSize = 10;
      for (let i = 0; i < messageIds.length; i += chunkSize) {
        const chunk = messageIds.slice(i, i + chunkSize);
        
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/product-matching`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            type: 'BULK_MATCH',
            message_ids: chunk
          })
        });

        const result = await response.json();
        
        if (result.success) {
          const matchedCount = result.data.matches ? result.data.matches.length : 0;
          
          setBatchResults(prev => ({
            ...prev,
            processed: prev.processed + chunk.length,
            matched: prev.matched + matchedCount,
            failed: prev.failed + (chunk.length - matchedCount)
          }));
        } else {
          setBatchResults(prev => ({
            ...prev,
            processed: prev.processed + chunk.length,
            failed: prev.failed + chunk.length
          }));
        }
        
        // Update progress
        setBatchProgress(Math.floor(((i + chunk.length) / messageIds.length) * 100));
      }
      
      toast.success('Batch matching completed');
    } catch (error) {
      console.error('Error in batch matching:', error);
      toast.error('Failed to complete batch matching');
    } finally {
      setIsMatching(false);
      setBatchProgress(100);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-bold">Product Matching</h1>
      
      <Tabs defaultValue="single" value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="single">Single Product Matching</TabsTrigger>
          <TabsTrigger value="batch">Batch Matching</TabsTrigger>
        </TabsList>
        
        <TabsContent value="single" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Match a Single Product</CardTitle>
              <CardDescription>
                Enter product details to find matching products in your inventory
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="productName">Product Name</Label>
                    <Input 
                      id="productName" 
                      value={productName} 
                      onChange={(e) => setProductName(e.target.value)}
                      placeholder="Enter product name"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="vendorName">Vendor Name</Label>
                    <Input 
                      id="vendorName" 
                      value={vendorName} 
                      onChange={(e) => setVendorName(e.target.value)}
                      placeholder="Enter vendor name (optional)"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="poNumber">PO Number</Label>
                  <Input 
                    id="poNumber" 
                    value={poNumber} 
                    onChange={(e) => setPoNumber(e.target.value)}
                    placeholder="Enter PO number (optional)"
                  />
                </div>
                
                <Button 
                  onClick={matchSingleProduct} 
                  disabled={isMatching || !productName}
                  className="w-full md:w-auto"
                >
                  {isMatching ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Matching...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Find Matches
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {(matchResults.length > 0 || bestMatch) && (
            <Card>
              <CardHeader>
                <CardTitle>Matching Results</CardTitle>
                {bestMatch && (
                  <CardDescription>
                    Best match: {bestMatch.confidence_score ? `${(bestMatch.confidence_score * 100).toFixed(0)}% confidence` : 'No confidence score available'}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {bestMatch && (
                  <div className="mb-4">
                    <div className="bg-primary/10 p-4 rounded-md border border-primary/20">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-5 w-5 text-primary" />
                        <h3 className="font-medium">Best Match</h3>
                        <Badge variant="outline" className="ml-auto">
                          {(bestMatch.confidence_score * 100).toFixed(0)}% match
                        </Badge>
                      </div>
                      <p className="text-lg font-medium">{bestMatch.product_name || 'Unknown Product'}</p>
                      <div className="text-sm text-muted-foreground mt-1">
                        {bestMatch.match_details || 'No match details available'}
                      </div>
                      <div className="mt-2">
                        <Button size="sm" variant="outline">
                          <ArrowRight className="h-4 w-4 mr-2" />
                          View Product
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <h3 className="font-medium">All Matches ({matchResults.length})</h3>
                  <Separator />
                  {matchResults.length > 0 ? (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {matchResults.map((match, index) => (
                        <div key={index} className="p-3 bg-muted/50 rounded-md">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{match.product_name || 'Unknown Product'}</span>
                            <Badge variant="outline">
                              {(match.confidence_score * 100).toFixed(0)}% match
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {match.match_details || 'No match details available'}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-4 text-center text-muted-foreground">
                      <p>No matches found</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="batch" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Batch Product Matching</CardTitle>
              <CardDescription>
                Match multiple products at once from your unprocessed messages
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {isLoadingMessages 
                      ? 'Loading unprocessed messages...' 
                      : `${unprocessedMessages?.length || 0} unprocessed messages found`}
                  </p>
                </div>
                
                <Button 
                  onClick={matchBatchProducts} 
                  disabled={isMatching || isLoadingMessages || !unprocessedMessages || unprocessedMessages.length === 0}
                >
                  {isMatching ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <List className="mr-2 h-4 w-4" />
                      Match All
                    </>
                  )}
                </Button>
              </div>
              
              {isMatching && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Processing messages</span>
                    <span>{batchProgress}%</span>
                  </div>
                  <Progress value={batchProgress} className="h-2" />
                </div>
              )}
              
              {(batchResults.processed > 0 || isMatching) && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-sm text-muted-foreground">Total</div>
                      <div className="text-2xl font-bold">{batchResults.total}</div>
                      <Progress value={(batchResults.processed / batchResults.total) * 100} className="h-1 mt-2" />
                    </Card>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-sm text-muted-foreground">Processed</div>
                      <div className="text-2xl font-bold">{batchResults.processed}</div>
                      <Progress value={(batchResults.processed / batchResults.total) * 100} className="h-1 mt-2" />
                    </Card>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-sm text-muted-foreground">Matched</div>
                      <div className="text-2xl font-bold text-green-600">{batchResults.matched}</div>
                      <Progress value={(batchResults.matched / batchResults.total) * 100} className="h-1 mt-2 bg-green-100" />
                    </Card>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-sm text-muted-foreground">Failed</div>
                      <div className="text-2xl font-bold text-red-600">{batchResults.failed}</div>
                      <Progress value={(batchResults.failed / batchResults.total) * 100} className="h-1 mt-2 bg-red-100" />
                    </Card>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProductMatchingPage;
