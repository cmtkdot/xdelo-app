
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/useToast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, XCircle, ArrowRight } from "lucide-react";
import { GlProduct } from "@/types/GlProducts";

interface ProductRecommendationProps {
  messageId?: string;
  onApprove?: (matchId: string, productId: string) => void;
  onReject?: (matchId: string) => void;
}

export const ProductRecommendationCard = ({ messageId, onApprove, onReject }: ProductRecommendationProps) => {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<GlProduct[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (messageId) {
      loadRecommendations(messageId);
    }
  }, [messageId]);

  const loadRecommendations = async (id: string) => {
    setLoading(true);
    try {
      // Get matches for this message
      const { data: matchData, error: matchError } = await supabase
        .from('sync_matches')
        .select('*')
        .eq('message_id', id)
        .order('confidence', { ascending: false });

      if (matchError) throw matchError;

      if (matchData && matchData.length > 0) {
        setRecommendations(matchData);

        // Get product details for the matches
        const productIds = matchData.map(match => match.product_id).filter(Boolean);
        if (productIds.length > 0) {
          const { data: productData, error: productError } = await supabase
            .from('gl_products')
            .select('*')
            .in('id', productIds);

          if (productError) throw productError;
          setProducts(productData || []);
        }
      }
    } catch (error) {
      console.error('Error loading recommendations:', error);
      toast({
        title: "Error loading recommendations",
        description: "There was a problem loading product recommendations.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (matchId: string, productId: string) => {
    if (onApprove) {
      onApprove(matchId, productId);
    } else {
      try {
        await supabase
          .from('sync_matches')
          .update({ 
            status: 'approved',
            updated_at: new Date().toISOString()
          })
          .eq('id', matchId);

        toast({
          title: "Match approved",
          description: "The product match has been approved.",
        });

        if (messageId) {
          loadRecommendations(messageId);
        }
      } catch (error) {
        console.error('Error approving match:', error);
        toast({
          title: "Error approving match",
          description: "There was a problem approving the product match.",
          variant: "destructive",
        });
      }
    }
  };

  const handleReject = async (matchId: string) => {
    if (onReject) {
      onReject(matchId);
    } else {
      try {
        await supabase
          .from('sync_matches')
          .update({ 
            status: 'rejected',
            updated_at: new Date().toISOString()
          })
          .eq('id', matchId);

        toast({
          title: "Match rejected",
          description: "The product match has been rejected.",
        });

        if (messageId) {
          loadRecommendations(messageId);
        }
      } catch (error) {
        console.error('Error rejecting match:', error);
        toast({
          title: "Error rejecting match",
          description: "There was a problem rejecting the product match.",
          variant: "destructive",
        });
      }
    }
  };

  const getProductById = (id: string) => {
    return products.find(p => p.id === id);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "bg-green-100 text-green-800 border-green-200";
    if (confidence >= 0.6) return "bg-amber-100 text-amber-800 border-amber-200";
    return "bg-red-100 text-red-800 border-red-200";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Product Recommendations</CardTitle>
        <CardDescription>
          Potential product matches based on message content
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : recommendations.length === 0 ? (
          <div className="text-center p-6 bg-muted/20 rounded-md">
            <p className="text-muted-foreground">No product recommendations available</p>
          </div>
        ) : (
          <div className="space-y-4">
            {recommendations.map((match) => {
              const product = getProductById(match.product_id);
              return (
                <div key={match.id} className="border rounded-md p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">{product?.product_name_display || 'Unknown Product'}</h4>
                      <p className="text-sm text-muted-foreground">
                        {product?.main_vendor_product_name || 'No vendor code'}
                      </p>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={getConfidenceColor(match.confidence)}
                    >
                      {Math.round(match.confidence * 100)}% match
                    </Badge>
                  </div>
                  
                  {match.match_fields && (
                    <div className="flex flex-wrap gap-1">
                      {match.match_fields.map((field: string) => (
                        <Badge key={field} variant="secondary" className="text-xs">
                          {field}
                        </Badge>
                      ))}
                    </div>
                  )}
                  
                  {match.status ? (
                    <div className="flex items-center justify-end gap-2">
                      {match.status === 'approved' ? (
                        <Badge className="bg-green-100 text-green-800 border-green-200">
                          <CheckCircle className="h-3 w-3 mr-1" /> Approved
                        </Badge>
                      ) : match.status === 'rejected' ? (
                        <Badge className="bg-red-100 text-red-800 border-red-200">
                          <XCircle className="h-3 w-3 mr-1" /> Rejected
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                          {match.status}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 hover:bg-red-50"
                        onClick={() => handleReject(match.id)}
                      >
                        <XCircle className="h-4 w-4 mr-1" /> Reject
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-green-600 hover:text-green-700 border-green-200 hover:border-green-300 hover:bg-green-50"
                        onClick={() => handleApprove(match.id, match.product_id)}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" /> Approve
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
      <CardFooter className="justify-end">
        <Button variant="outline" onClick={() => messageId && loadRecommendations(messageId)} disabled={loading}>
          Refresh Recommendations
        </Button>
      </CardFooter>
    </Card>
  );
};
