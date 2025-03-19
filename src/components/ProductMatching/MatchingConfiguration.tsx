
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/useToast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, Check, Settings2 } from "lucide-react";
import { CONFIG } from "@/lib/productMatchingConfig";
import { FeatureCard } from "./FeatureCard";

export const MatchingConfiguration = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [threshold, setThreshold] = useState(CONFIG.similarityThreshold);
  const [enablePartialMatching, setEnablePartialMatching] = useState(CONFIG.partialMatch.enabled);
  const [vendorMinLength, setVendorMinLength] = useState(CONFIG.partialMatch.vendorMinLength);
  const [weightProduct, setWeightProduct] = useState(CONFIG.weightedScoring.productName);
  const [weightVendor, setWeightVendor] = useState(CONFIG.weightedScoring.vendorUid);
  const [weightDate, setWeightDate] = useState(CONFIG.weightedScoring.purchaseDate);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Load current configuration from the database
  useEffect(() => {
    const loadConfig = async () => {
      setIsLoading(true);
      try {
        // First check if the settings table has a matching_config column
        const { data: tableInfo, error: schemaError } = await supabase
          .from('settings')
          .select('*')
          .limit(1);
        
        if (schemaError) {
          console.error("Error checking settings schema:", schemaError);
          return;
        }
        
        // If the table doesn't have a product_matching_config column, we'll try matching_config
        const configColumn = tableInfo && tableInfo[0] && 'matching_config' in tableInfo[0] 
          ? 'matching_config' 
          : 'product_matching_config';
        
        const { data, error } = await supabase
          .from('settings')
          .select(configColumn)
          .single();
        
        if (error) {
          console.error("Error loading product matching config:", error);
          return;
        }

        if (data && data[configColumn]) {
          try {
            const config = JSON.parse(data[configColumn]);
            setThreshold(config.similarityThreshold || 0.7);
            
            if (config.weightedScoring) {
              setWeightProduct(config.weightedScoring.productName || 0.4);
              setWeightVendor(config.weightedScoring.vendorUid || 0.3);
              setWeightDate(config.weightedScoring.purchaseDate || 0.3);
            }
            
            if (config.partialMatch) {
              setEnablePartialMatching(config.partialMatch.enabled !== false);
              setVendorMinLength(config.partialMatch.vendorMinLength || 2);
            }
          } catch (err) {
            console.error("Error parsing product matching config:", err);
          }
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    loadConfig();
  }, []);

  const validateWeights = () => {
    const sum = weightProduct + weightVendor + weightDate;
    return Math.abs(sum - 1.0) < 0.01; // Allow for small floating point errors
  };

  const handleSaveSettings = async () => {
    if (!validateWeights()) {
      toast({
        title: "Invalid weights",
        description: "The weights must sum to 1.0. Please adjust the values.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      // Create the updated config object
      const updatedConfig = {
        similarityThreshold: threshold,
        weightedScoring: {
          productName: weightProduct,
          vendorUid: weightVendor,
          purchaseDate: weightDate
        },
        partialMatch: {
          enabled: enablePartialMatching,
          vendorMinLength: vendorMinLength,
          dateFormat: CONFIG.partialMatch.dateFormat
        }
      };
      
      // Check if settings table already has records
      const { data: existingSettings } = await supabase
        .from('settings')
        .select('id')
        .limit(1);
      
      // Determine if settings table has a matching_config column
      const { data: tableInfo } = await supabase
        .from('settings')
        .select('*')
        .limit(1);
      
      const configColumn = tableInfo && tableInfo[0] && 'matching_config' in tableInfo[0] 
        ? 'matching_config' 
        : 'product_matching_config';
      
      // Prepare upsert data
      const upsertData: Record<string, any> = {
        updated_at: new Date().toISOString()
      };
      
      // Set the appropriate config column
      upsertData[configColumn] = JSON.stringify(updatedConfig);
      
      // Add ID if it exists
      if (existingSettings && existingSettings.length > 0) {
        upsertData.id = existingSettings[0].id;
      }
      
      // Save to settings table
      const { error } = await supabase
        .from('settings')
        .upsert(upsertData);
      
      if (error) throw error;
      
      toast({
        title: "Settings saved",
        description: "Your product matching settings have been updated.",
      });
      
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error saving settings",
        description: "There was a problem saving your settings.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Matching Configuration</CardTitle>
          <CardDescription>
            Configure how messages are matched to products in your inventory
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="threshold">Matching Threshold</Label>
                  <span className="text-sm text-muted-foreground">{(threshold * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  id="threshold"
                  min={0.5}
                  max={0.95}
                  step={0.05}
                  value={[threshold]}
                  onValueChange={(values) => setThreshold(values[0])}
                />
                <p className="text-xs text-muted-foreground">
                  Higher values require closer matches. Recommended: 0.7 (70%)
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium">Field Weights</h3>
                <p className="text-xs text-muted-foreground">
                  Adjust how much each field contributes to the overall match score (must sum to 100%)
                </p>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="weight-product">Product Name Weight</Label>
                    <span className="text-sm text-muted-foreground">{(weightProduct * 100).toFixed(0)}%</span>
                  </div>
                  <Slider
                    id="weight-product"
                    min={0.1}
                    max={0.8}
                    step={0.05}
                    value={[weightProduct]}
                    onValueChange={(values) => setWeightProduct(values[0])}
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="weight-vendor">Vendor Code Weight</Label>
                    <span className="text-sm text-muted-foreground">{(weightVendor * 100).toFixed(0)}%</span>
                  </div>
                  <Slider
                    id="weight-vendor"
                    min={0.1}
                    max={0.8}
                    step={0.05}
                    value={[weightVendor]}
                    onValueChange={(values) => setWeightVendor(values[0])}
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="weight-date">Purchase Date Weight</Label>
                    <span className="text-sm text-muted-foreground">{(weightDate * 100).toFixed(0)}%</span>
                  </div>
                  <Slider
                    id="weight-date"
                    min={0.1}
                    max={0.8}
                    step={0.05}
                    value={[weightDate]}
                    onValueChange={(values) => setWeightDate(values[0])}
                  />
                </div>
                
                {!validateWeights() && (
                  <p className="text-xs text-destructive animate-pulse">
                    Field weights must sum to 100%. Current sum: {((weightProduct + weightVendor + weightDate) * 100).toFixed(0)}%
                  </p>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="font-medium">Partial Matching</h3>
                
                <div className="flex items-center justify-between space-x-2">
                  <Label htmlFor="partial-matching">Enable Partial Matching</Label>
                  <Switch
                    id="partial-matching"
                    checked={enablePartialMatching}
                    onCheckedChange={setEnablePartialMatching}
                  />
                </div>
                
                {enablePartialMatching && (
                  <div className="space-y-2">
                    <Label htmlFor="vendor-min-length">Minimum Vendor Code Length</Label>
                    <Input
                      id="vendor-min-length"
                      type="number"
                      min={1}
                      max={5}
                      value={vendorMinLength}
                      onChange={(e) => setVendorMinLength(Number(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Minimum characters required for partial vendor code matching
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Matching Threshold</p>
                  <p className="text-sm text-muted-foreground">{(threshold * 100).toFixed(0)}%</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Partial Matching</p>
                  <p className="text-sm text-muted-foreground">{enablePartialMatching ? "Enabled" : "Disabled"}</p>
                </div>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm font-medium">Field Weights</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-muted/30 p-2 rounded-md">
                    <p className="text-xs text-muted-foreground">Product Name</p>
                    <p className="font-medium">{(weightProduct * 100).toFixed(0)}%</p>
                  </div>
                  <div className="bg-muted/30 p-2 rounded-md">
                    <p className="text-xs text-muted-foreground">Vendor Code</p>
                    <p className="font-medium">{(weightVendor * 100).toFixed(0)}%</p>
                  </div>
                  <div className="bg-muted/30 p-2 rounded-md">
                    <p className="text-xs text-muted-foreground">Purchase Date</p>
                    <p className="font-medium">{(weightDate * 100).toFixed(0)}%</p>
                  </div>
                </div>
              </div>
              
              {enablePartialMatching && (
                <div className="space-y-1">
                  <p className="text-sm font-medium">Partial Matching Configuration</p>
                  <div className="text-sm text-muted-foreground">
                    <p>Min vendor code length: {vendorMinLength} characters</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveSettings} disabled={isSaving || !validateWeights()}>
                {isSaving ? 
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 
                  <><Save className="mr-2 h-4 w-4" /> Save Settings</>}
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)} className="ml-auto">
              <Settings2 className="mr-2 h-4 w-4" /> Edit Configuration
            </Button>
          )}
        </CardFooter>
      </Card>
      
      <div className="space-y-6">
        <FeatureCard 
          title="Fuzzy Text Matching"
          description="Uses Jaro-Winkler similarity algorithm to match product names even with typos or variations"
          icon="TextSearch"
        />
        
        <FeatureCard 
          title="Weighted Scoring"
          description="Customize how much each field contributes to the overall matching score"
          icon="Scale"
        />
        
        <FeatureCard 
          title="Partial Matching"
          description="Match partial vendor codes and approximate dates for better results"
          icon="Search"
        />
        
        <FeatureCard 
          title="Batch Operations"
          description="Match multiple messages at once for efficient processing"
          icon="ListFilter"
        />
      </div>
    </div>
  );
};
