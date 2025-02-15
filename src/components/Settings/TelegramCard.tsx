import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface TelegramCardProps {
  botToken: string | null;
  webhookUrl: string | null;
  onUpdate: () => void;
}

export const TelegramCard: React.FC<TelegramCardProps> = ({ botToken, webhookUrl, onUpdate }) => {
  const { toast } = useToast();

  const handleSetWebhook = async () => {
    try {
      const { error } = await supabase.functions.invoke("set-telegram-webhook", {
        body: { webhookUrl },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Telegram webhook set successfully",
      });
      
      onUpdate();
    } catch (error) {
      console.error("Error setting webhook:", error);
      toast({
        title: "Error",
        description: "Failed to set Telegram webhook",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Telegram Integration</CardTitle>
        <CardDescription>Configure your Telegram bot settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="text-sm font-medium mb-2">Bot Token</h3>
          <p className="text-sm text-muted-foreground">
            {botToken ? "••••••••" + botToken.slice(-4) : "Not set"}
          </p>
        </div>
        <div>
          <h3 className="text-sm font-medium mb-2">Webhook URL</h3>
          <p className="text-sm text-muted-foreground break-all">
            {webhookUrl || "Not set"}
          </p>
        </div>
        <Button onClick={handleSetWebhook} disabled={!webhookUrl}>
          Set Webhook
        </Button>
      </CardContent>
    </Card>
  );
};
