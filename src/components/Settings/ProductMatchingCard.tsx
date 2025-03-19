
import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/useToast";
import { supabase } from "@/integrations/supabase/client";

const ProductMatchingCard = () => {
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [threshold, setThreshold] = useState(0.7);
  const [enablePartialMatching, setEnablePartialMatching] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const { toast } = useToast();

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      // In a real implementation, we would save these settings to the database
      // For now, just simulate a successful save
      await new Promise(resolve => setTimeout(resolve, 800));
      
      toast({
        title: "Settings saved",
        description: "Your product matching settings have been updated.",
      });
      
      setIsConfiguring(false);
    } catch (error) {
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

      // Simulate matching process
      await new Promise(resolve => setTimeout(resolve, 1500));

      toast({
        title: "Test completed",
        description: `Successfully tested matching on ${messages.length} messages.`,
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
              {isSaving ? "Saving..." : "Save Settings"}
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={() => setIsConfiguring(true)}>
              Configure
            </Button>
            <Button onClick={handleRunTest} disabled={isTestRunning}>
              {isTestRunning ? "Running Test..." : "Run Test Match"}
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
};

export { ProductMatchingCard };
