
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/useToast";
import { Loader2, Check, Save } from "lucide-react";
import { ProductMatchingConfig } from "@/types/entities/ProductMatching";
import { fetchMatchingConfig, updateMatchingConfig, DEFAULT_CONFIG } from "@/lib/productMatchingConfig";
import { ProductRecommendationCard } from "./ProductRecommendationCard";

export const MatchingConfiguration = () => {
  const [config, setConfig] = useState<ProductMatchingConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const loadedConfig = await fetchMatchingConfig();
      setConfig(loadedConfig);
    } catch (error) {
      console.error("Error loading configuration:", error);
      toast({
        title: "Error loading configuration",
        description: "Failed to load product matching configuration.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateMatchingConfig(config);
      toast({
        title: "Configuration saved",
        description: "Product matching configuration has been updated.",
      });
    } catch (error) {
      console.error("Error saving configuration:", error);
      toast({
        title: "Error saving configuration",
        description: "Failed to save product matching configuration.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleThresholdChange = (values: number[]) => {
    setConfig({
      ...config,
      similarityThreshold: values[0],
    });
  };

  const handlePartialMatchChange = (checked: boolean) => {
    setConfig({
      ...config,
      partialMatch: {
        ...config.partialMatch,
        enabled: checked,
      },
    });
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Matching Algorithm Configuration</CardTitle>
          <CardDescription>
            Configure how products are matched from message content
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="threshold">Matching Threshold: {config.similarityThreshold}</Label>
                  <span className="text-sm text-muted-foreground">
                    {(config.similarityThreshold * 100).toFixed(0)}%
                  </span>
                </div>
                <Slider
                  id="threshold"
                  min={0.5}
                  max={0.95}
                  step={0.05}
                  value={[config.similarityThreshold]}
                  onValueChange={handleThresholdChange}
                />
                <p className="text-xs text-muted-foreground">
                  Higher values require closer matches. Recommended: 0.7 (70%)
                </p>
              </div>

              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="partial-matching">Enable Partial Matching</Label>
                <Switch
                  id="partial-matching"
                  checked={config.partialMatch.enabled}
                  onCheckedChange={handlePartialMatchChange}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Allow partial matches for vendor codes and purchase dates
              </p>

              <div className="space-y-2">
                <Label>Weighted Scoring</Label>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs">Product Name</Label>
                    <div className="font-medium">{config.weightedScoring.name * 100}%</div>
                  </div>
                  <div>
                    <Label className="text-xs">Vendor Code</Label>
                    <div className="font-medium">{config.weightedScoring.vendor * 100}%</div>
                  </div>
                  <div>
                    <Label className="text-xs">Purchase Date</Label>
                    <div className="font-medium">{config.weightedScoring.purchaseDate * 100}%</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleSave} disabled={isSaving || isLoading} className="ml-auto">
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" /> Save Configuration
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      <Tabs defaultValue="algorithm">
        <TabsList className="mb-4 w-full">
          <TabsTrigger value="algorithm">Algorithm Details</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>
        <TabsContent value="algorithm">
          <Card>
            <CardHeader>
              <CardTitle>Matching Algorithm</CardTitle>
              <CardDescription>How the product matching algorithm works</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium">String Similarity</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Uses Jaro-Winkler distance to compare product names, providing better results for names that share a common prefix.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium">Vendor Code Matching</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Exact matching for vendor codes. When partial matching is enabled, it will match the first few characters of vendor codes.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium">Purchase Date Matching</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Exact date matching. With partial matching, it will consider matches within the same month and year.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium">Weighted Scoring</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Different fields contribute different weights to the final confidence score, based on their importance.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="recommendations">
          <ProductRecommendationCard />
        </TabsContent>
      </Tabs>
    </div>
  );
};
