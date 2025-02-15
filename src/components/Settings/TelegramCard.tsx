
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const TelegramCard = () => {
  const [isSettingWebhook, setIsSettingWebhook] = useState(false);
  const { toast } = useToast();

  const setupTelegramWebhook = async () => {
    try {
      setIsSettingWebhook(true);
      const { error } = await supabase.functions.invoke('setup-telegram-webhook');
      
      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Telegram webhook has been set up successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to set up webhook: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsSettingWebhook(false);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Telegram Integration</h3>
          <p className="text-sm text-gray-500">Manage Telegram webhook settings</p>
        </div>
        <Button 
          onClick={setupTelegramWebhook} 
          disabled={isSettingWebhook}
        >
          {isSettingWebhook ? "Setting up..." : "Setup Webhook"}
        </Button>
      </div>
    </Card>
  );
};
