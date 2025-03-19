
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MatchingConfiguration } from "@/components/ProductMatching/MatchingConfiguration";
import { TestMatchingPanel } from "@/components/ProductMatching/TestMatchingPanel";
import { BatchMatchingPanel } from "@/components/ProductMatching/BatchMatchingPanel";
import { MatchingHistory } from "@/components/ProductMatching/MatchingHistory";
import { ensureMatchingConfigColumn } from "@/components/Settings/ensureMatchingConfigColumn";
import { useToast } from "@/hooks/useToast";
import { Loader2 } from "lucide-react";

const ProductMatching = () => {
  const [isInitializing, setIsInitializing] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const initializeSettings = async () => {
      setIsInitializing(true);
      try {
        const result = await ensureMatchingConfigColumn();
        if (!result) {
          toast({
            title: "Database initialization failed",
            description: "Failed to ensure matching configuration settings are available.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error initializing product matching:", error);
        toast({
          title: "Initialization error",
          description: "Failed to initialize product matching settings.",
          variant: "destructive",
        });
      } finally {
        setIsInitializing(false);
      }
    };

    initializeSettings();
  }, [toast]);

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Initializing product matching...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold">Product Matching</h1>
          <p className="text-muted-foreground mt-2">
            Configure and manage how messages are matched to products in your inventory
          </p>
        </div>

        <Tabs defaultValue="configuration" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="configuration">Configuration</TabsTrigger>
            <TabsTrigger value="testing">Testing</TabsTrigger>
            <TabsTrigger value="batch">Batch Operations</TabsTrigger>
            <TabsTrigger value="history">Match History</TabsTrigger>
          </TabsList>
          
          <TabsContent value="configuration">
            <MatchingConfiguration />
          </TabsContent>
          
          <TabsContent value="testing">
            <TestMatchingPanel />
          </TabsContent>
          
          <TabsContent value="batch">
            <BatchMatchingPanel />
          </TabsContent>
          
          <TabsContent value="history">
            <MatchingHistory />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ProductMatching;
