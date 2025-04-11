
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/useToast";
import { Loader2, Save, ZapIcon } from "lucide-react";
import { fetchMatchingConfig, updateMatchingConfig } from "@/lib/product-matching/config";
import { ProductMatchingConfig, DEFAULT_CONFIG } from "@/lib/product-matching/types";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/database.types";

type GlProduct = Database['public']['Tables']['gl_products']['Row'];

const ProductMatchingCard = () => {
  const [config, setConfig] = useState<ProductMatchingConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    confidence?: number;
    productName?: string;
    error?: string;
  } | null>(null);
  const { toast } = useToast();

  // Load config on component mount
  useEffect(() => {
    async function loadConfig() {
      try {
        const config = await fetchMatchingConfig();
        setConfig(config);
      } catch (err) {
        console.error("Error loading product matching config:", err);
        toast({
          title: "Error loading configuration",
          description: "Could not load product matching settings.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadConfig();
  }, [toast]);

  // Save config
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateMatchingConfig(config);
      toast({
        title: "Settings saved",
        description: "Your product matching settings have been updated.",
      });
    } catch (err) {
      console.error("Error saving settings:", err);
      toast({
        title: "Error saving settings",
        description: "Your changes could not be saved.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Update a config value
  const updateConfig = (key: string, value: any) => {
    if (key.includes('.')) {
      const [section, subKey] = key.split('.');
      setConfig(prev => ({
        ...prev,
        [section]: {
          ...(prev[section as keyof ProductMatchingConfig] as object),
          [subKey]: value,
        },
      }));
    } else {
      setConfig(prev => ({
        ...prev,
        [key]: value,
      }));
    }
  };

  // Test the configuration with a random message
  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    
    try {
      // Get a recent message with caption
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .select('id, caption, analyzed_content')
        .not('analyzed_content', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      if (messageError) throw messageError;
      
      // Test match
      const { data: matchResult, error: matchingError } = await supabase
        .functions.invoke('product-matching', {
          body: {
            request: {
              messageId: message.id,
              minConfidence: config.minConfidence
            },
            config
          }
        });
        
      if (matchingError) throw matchingError;
      
      if (matchResult.bestMatch) {
        // Get product details from gl_products
        const { data: productData, error: productError } = await supabase
          .from('gl_products')
          .select('new_product_name')
          .eq('id', matchResult.bestMatch.product_id)
          .single();
          
        if (productError) {
          console.error("Error fetching product details:", productError);
          throw productError;
        }
          
        const product = productData as GlProduct;
        
        setTestResult({
          success: true,
          confidence: matchResult.bestMatch.confidence,
          productName: product?.new_product_name || 'Unknown Product'
        });
      } else {
        setTestResult({
          success: false
        });
      }
    } catch (error) {
      console.error("Error in product matching test:", error);
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      toast({
        title: "Test failed",
        description: "There was an error running the product matching test.",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Product Matching</CardTitle>
          <CardDescription>Loading configuration...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Product Matching</CardTitle>
        <CardDescription>Configure how products are matched to messages</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label htmlFor="similarity-threshold">
                Similarity Threshold ({Math.round(config.similarityThreshold * 100)}%)
              </Label>
              <Badge variant="outline">
                {config.similarityThreshold < 0.5
                  ? "Lenient"
                  : config.similarityThreshold < 0.7
                  ? "Moderate"
                  : config.similarityThreshold < 0.9
                  ? "Strict"
                  : "Very Strict"}
              </Badge>
            </div>
            <Slider
              id="similarity-threshold"
              min={0.1}
              max={1}
              step={0.05}
              value={[config.similarityThreshold]}
              onValueChange={(value) => updateConfig('similarityThreshold', value[0])}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Sets the required similarity between product names
            </p>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <Label htmlFor="min-confidence">
                Minimum Confidence ({Math.round(config.minConfidence * 100)}%)
              </Label>
              <Badge variant="outline">
                {config.minConfidence < 0.5
                  ? "Low"
                  : config.minConfidence < 0.7
                  ? "Medium"
                  : "High"}
              </Badge>
            </div>
            <Slider
              id="min-confidence"
              min={0.1}
              max={1}
              step={0.05}
              value={[config.minConfidence]}
              onValueChange={(value) => updateConfig('minConfidence', value[0])}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Required confidence level for a match to be considered valid
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="use-partial-match"
              checked={config.partialMatch.enabled}
              onCheckedChange={(value) => updateConfig('partialMatch.enabled', value)}
            />
            <Label htmlFor="use-partial-match">Enable Partial Matching</Label>
          </div>
        </div>

        <div className="rounded-md bg-secondary/50 p-4">
          <h3 className="font-medium mb-2">Matching Methods</h3>
          <ul className="space-y-1 text-sm">
            <li>Product name similarity matching</li>
            <li>Vendor ID matching</li>
            <li>Purchase date matching</li>
          </ul>
        </div>

        {testResult && (
          <div className={`p-4 rounded-md ${
            testResult.success 
              ? "bg-green-50 border border-green-200 text-green-800" 
              : "bg-amber-50 border border-amber-200 text-amber-800"
          }`}>
            <h3 className="font-medium">Test Result</h3>
            {testResult.success ? (
              <p className="text-sm mt-1">
                Matched with {Math.round((testResult.confidence || 0) * 100)}% confidence to "{testResult.productName}"
              </p>
            ) : (
              <p className="text-sm mt-1">
                {testResult.error || "No product match found with current settings"}
              </p>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={handleTest} 
          disabled={isTesting || isSaving}
        >
          {isTesting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Testing</>
          ) : (
            <><ZapIcon className="mr-2 h-4 w-4" /> Test Settings</>
          )}
        </Button>
        
        <Button 
          onClick={handleSave} 
          disabled={isSaving || isTesting}
        >
          {isSaving ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving</>
          ) : (
            <><Save className="mr-2 h-4 w-4" /> Save Settings</>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export { ProductMatchingCard };
