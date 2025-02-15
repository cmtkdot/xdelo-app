
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const SyncCard = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  const triggerSync = async () => {
    try {
      setIsSyncing(true);
      const { data, error } = await supabase.rpc('glide_sync_products');
      
      if (error) throw error;
      
      toast({
        title: "Success",
        description: `Successfully matched ${data} messages with products.`,
      });

    } catch (error: any) {
      console.error('Sync error:', error);
      toast({
        title: "Error",
        description: `Failed to trigger sync: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Product-Message Sync</h3>
          <p className="text-sm text-gray-500">Manually trigger synchronization between products and messages</p>
        </div>
        <Button 
          onClick={triggerSync} 
          disabled={isSyncing}
        >
          {isSyncing ? "Syncing..." : "Trigger Sync"}
        </Button>
      </div>
    </Card>
  );
};
