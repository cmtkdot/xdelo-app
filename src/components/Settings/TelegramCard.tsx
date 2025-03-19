
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/useToast";
import { useSupabase } from "@/integrations/supabase/SupabaseProvider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Check, AlertCircle } from "lucide-react";
import { WebhookLogDisplay } from "@/components/ui/webhook-log-display";

interface TelegramCardProps {
  botToken: string | null;
  webhookUrl: string | null;
}

export function TelegramCard({ botToken, webhookUrl }: TelegramCardProps) {
  const { toast } = useToast();
  const supabase = useSupabase();
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingWebhook, setIsSettingWebhook] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [availableTokens, setAvailableTokens] = useState<string[]>([]);
  const [selectedToken, setSelectedToken] = useState<string>(botToken || '');
  const [webhookLog, setWebhookLog] = useState<any>(null);

  // Fetch available tokens from edge function secrets
  useEffect(() => {
    const fetchSecrets = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('xdelo_telegram-secrets', {
          method: 'GET'
        });
        
        if (error) throw error;
        
        if (data && data.tokens) {
          setAvailableTokens(data.tokens);
          if (data.tokens.length > 0 && !selectedToken) {
            setSelectedToken(data.tokens[0]);
          }
        }
      } catch (error) {
        console.error("Error fetching Telegram secrets:", error);
        // Fallback to static token option if can't fetch secrets
        if (botToken) {
          setAvailableTokens([botToken]);
          setSelectedToken(botToken);
        }
      }
    };

    fetchSecrets();
  }, [botToken, supabase.functions]);

  // Mask the bot token to only show the first few and last few characters
  const maskToken = (token: string | null) => {
    if (!token) return "Not configured";
    if (token.length <= 10) return token;
    return token.substring(0, 6) + "..." + token.substring(token.length - 4);
  };

  const handleSetWebhook = async () => {
    if (!selectedToken) {
      toast({
        title: "Error",
        description: "Please select a bot token first",
        variant: "destructive"
      });
      return;
    }

    setIsSettingWebhook(true);
    setWebhookStatus('idle');
    
    try {
      const { data, error } = await supabase.functions.invoke('xdelo_set-telegram-webhook', {
        method: 'POST',
        body: { token: selectedToken }
      });
      
      if (error) throw error;
      
      setWebhookLog(data);
      setWebhookStatus('success');
      toast({
        title: "Success",
        description: "Telegram webhook has been set successfully",
      });
    } catch (error) {
      console.error("Error setting webhook:", error);
      setWebhookStatus('error');
      toast({
        title: "Error",
        description: "Failed to set Telegram webhook",
        variant: "destructive"
      });
    } finally {
      setIsSettingWebhook(false);
    }
  };

  const handleSaveToken = async () => {
    if (!selectedToken) {
      toast({
        title: "Error",
        description: "Please select a bot token",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({ 
          id: '1', 
          bot_token: selectedToken,
          updated_at: new Date().toISOString()
        });
      
      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Bot token has been saved successfully",
      });
    } catch (error) {
      console.error("Error saving token:", error);
      toast({
        title: "Error",
        description: "Failed to save bot token",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Telegram Bot Configuration</CardTitle>
        <CardDescription>
          Configure your Telegram bot settings and webhook.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="botToken">Bot Token</Label>
          <Select 
            value={selectedToken} 
            onValueChange={setSelectedToken}
            disabled={isLoading}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a bot token" />
            </SelectTrigger>
            <SelectContent>
              {availableTokens.map(token => (
                <SelectItem key={token} value={token}>
                  {maskToken(token)}
                </SelectItem>
              ))}
              <SelectItem value="custom">Add new token...</SelectItem>
            </SelectContent>
          </Select>
          {selectedToken === 'custom' && (
            <Input
              id="customToken"
              placeholder="Enter new bot token"
              value={selectedToken === 'custom' ? '' : selectedToken}
              onChange={(e) => setSelectedToken(e.target.value)}
              disabled={isLoading}
              className="mt-2"
            />
          )}
          <Button 
            onClick={handleSaveToken}
            disabled={isLoading || !selectedToken || selectedToken === 'custom' && !selectedToken}
            className="mt-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Token"
            )}
          </Button>
        </div>
        <div className="space-y-2">
          <Label htmlFor="webhookUrl">Webhook URL</Label>
          <Input
            id="webhookUrl"
            value={webhookUrl || "Not configured"}
            readOnly
            disabled={isLoading}
          />
          <p className="text-xs text-muted-foreground mt-1">
            The webhook URL is where Telegram sends updates to your bot.
          </p>
        </div>
        <div className="space-y-2">
          <Button 
            onClick={handleSetWebhook}
            disabled={isSettingWebhook || !selectedToken || selectedToken === 'custom' && !selectedToken}
            className="w-full"
          >
            {isSettingWebhook ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting Webhook...
              </>
            ) : (
              "Set Telegram Webhook"
            )}
          </Button>
          
          {webhookStatus === 'success' && (
            <div className="flex items-center text-green-500 mt-2">
              <Check className="h-4 w-4 mr-2" />
              <span className="text-sm">Webhook set successfully</span>
            </div>
          )}
          
          {webhookStatus === 'error' && (
            <div className="flex items-center text-red-500 mt-2">
              <AlertCircle className="h-4 w-4 mr-2" />
              <span className="text-sm">Failed to set webhook</span>
            </div>
          )}
        </div>
        
        {webhookLog && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Webhook Setup Log</h4>
            <WebhookLogDisplay log={webhookLog} showDetails={true} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
