
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/useToast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Check } from "lucide-react";
import { CONFIG } from "@/lib/productMatchingConfig";

const ProductMatchingCard = () => {
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [threshold, setThreshold] = useState(CONFIG.similarityThreshold);
  const [enablePartialMatching, setEnablePartialMatching] = useState(CONFIG.partialMatch.enabled);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testResults, setTestResults] = useState<null | {
    processed: number;
    matched: number;
    confidence: number;
  }>(null);
  const { toast } = useToast();

  // Load current configuration from the database
  useEffect(() => {
    const loadConfig = async () => {
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
          setEnablePartialMatching(config.partialMatch?.enabled !== false);
        } catch (err) {
          console.error("Error parsing product matching config:", err);
        }
      }
    };
    
    loadConfig();
  }, []);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      // Create the updated config object
      const updatedConfig = {
        similarityThreshold: threshold,
        weightedScoring: CONFIG.weightedScoring,
        partialMatch: {
          ...CONFIG.partialMatch,
          enabled: enablePartialMatching
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
      
      setIsConfiguring(false);
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

  const handleRunTest = async () => {
    setIsTestRunning(true);
    setTestResults(null);
    try {
      // Get 5 recent messages with analyzed content
      const { data: messages, error } = await supabase
        .from('messages')
        .select('id, analyzed_content')
        .not('analyzed_content', 'is', null)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      if (!messages || messages.length === 0) {
        toast({
          title: "No messages available",
          description: "No messages with analyzed content were found to test.",
          variant: "destructive",
        });
        return;
      }

      // For each message, run the matching algorithm
      let matchCount = 0;
      let totalConfidence = 0;

      for (const message of messages) {
        // Call the product matching endpoint
        const { data: matchingResult, error: matchingError } = await supabase
          .functions.invoke('product-matching', {
            body: { 
              messageId: message.id,
              config: {
                similarityThreshold: threshold,
                partialMatchEnabled: enablePartialMatching
              }
            }
          });

        if (matchingError) {
          console.error("Error in product matching test:", matchingError);
          continue;
        }

        if (matchingResult?.bestMatch) {
          matchCount++;
          totalConfidence += matchingResult.bestMatch.confidence;
        }
      }

      // Store and display results
      const results = {
        processed: messages.length,
        matched: matchCount,
        confidence: matchCount > 0 ? totalConfidence / matchCount : 0
      };

      setTestResults(results);

      toast({
        title: "Test completed",
        description: `Successfully matched ${matchCount} of ${messages.length} messages (${Math.round(results.confidence * 100)}% confidence).`,
      });
    } catch (error) {
      console.error("Error running test:", error);
      toast({
        title: "Test failed",
        description: "There was an error running the product matching test.",
        variant: "destructive",
      });
    } finally {
      setIsTestRunning(false);
    }
  };

  const renderTestResults = () => {
    if (!testResults) return null;

    return (
      <div className="mt-4 p-4 border rounded-md bg-muted/30">
        <h4 className="font-medium">Test Results</h4>
        <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
          <div>
            <div className="text-muted-foreground">Messages</div>
            <div className="font-medium">{testResults.processed}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Matches</div>
            <div className="font-medium">{testResults.matched}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Confidence</div>
            <div className="font-medium">{Math.round(testResults.confidence * 100)}%</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Product Matching</CardTitle>
        <CardDescription>
          Configure how messages are matched to products in your inventory
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isConfiguring ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="threshold">Matching Threshold: {threshold}</Label>
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

            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="partial-matching">Enable Partial Matching</Label>
              <Switch
                id="partial-matching"
                checked={enablePartialMatching}
                onCheckedChange={setEnablePartialMatching}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Allow partial matches for vendor codes and purchase dates
            </p>
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
              <p className="text-sm font-medium">Features</p>
              <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                <li>Product name similarity matching</li>
                <li>Vendor code exact & partial matching</li>
                <li>Purchase date exact & partial matching</li>
                <li>Weighted scoring algorithm</li>
              </ul>
            </div>
            {renderTestResults()}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        {isConfiguring ? (
          <>
            <Button variant="outline" onClick={() => setIsConfiguring(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSettings} disabled={isSaving}>
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Check className="mr-2 h-4 w-4" /> Save Settings</>}
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={() => setIsConfiguring(true)}>
              Configure
            </Button>
            <Button onClick={handleRunTest} disabled={isTestRunning}>
              {isTestRunning ? 
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Running Test...</> : 
                <>Run Test Match</>
              }
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
};

export { ProductMatchingCard };
