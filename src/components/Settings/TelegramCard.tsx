
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/useToast";
import { useSupabase } from "@/integrations/supabase/SupabaseProvider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Check, AlertCircle, RefreshCw, ChevronDown, ExternalLink } from "lucide-react";
import { WebhookLogDisplay } from "@/components/ui/webhook-log-display";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface TelegramCardProps {
  botToken: string | null;
  webhookUrl: string | null;
}

interface WebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  max_connections: number;
  ip_address?: string;
  last_error_date?: number;
  last_error_message?: string;
  last_synchronization_error_date?: number;
  is_active?: boolean;
}

export function TelegramCard({ botToken, webhookUrl }: TelegramCardProps) {
  const { toast } = useToast();
  const supabase = useSupabase();
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingWebhook, setIsSettingWebhook] = useState(false);
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [availableTokens, setAvailableTokens] = useState<string[]>([]);
  const [selectedToken, setSelectedToken] = useState<string>(botToken || '');
  const [webhookLog, setWebhookLog] = useState<any>(null);
  const [webhookInfo, setWebhookInfo] = useState<WebhookInfo | null>(null);
  const [verificationUrls, setVerificationUrls] = useState<{
    set_webhook?: string;
    get_webhook_info?: string;
  }>({});
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

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

  // Fetch webhook info when token changes or on refresh
  useEffect(() => {
    if (selectedToken && selectedToken !== 'custom') {
      fetchWebhookInfo();
    }
  }, [selectedToken]);

  const fetchWebhookInfo = async () => {
    if (!selectedToken || selectedToken === 'custom') {
      return;
    }

    setIsFetchingInfo(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('xdelo_get-telegram-webhook-info', {
        method: 'POST',
        body: { token: selectedToken }
      });
      
      if (error) throw error;
      
      if (data.webhook_info) {
        setWebhookInfo(data.webhook_info);
        setVerificationUrls(data.verification_urls || {});
      }
    } catch (error) {
      console.error("Error fetching webhook info:", error);
      toast({
        title: "Error",
        description: "Failed to fetch webhook information",
        variant: "destructive"
      });
    } finally {
      setIsFetchingInfo(false);
    }
  };

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
      
      // Refresh webhook info after setting webhook
      await fetchWebhookInfo();
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
        .from('telegram_settings')
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
      
      // Refresh webhook info after saving token
      await fetchWebhookInfo();
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

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "Never";
    return new Date(timestamp * 1000).toLocaleString();
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
          <div className="flex justify-between items-center">
            <Label htmlFor="webhookUrl">Webhook URL</Label>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={fetchWebhookInfo} 
              disabled={isFetchingInfo || !selectedToken || selectedToken === 'custom'}
            >
              <RefreshCw className={`h-4 w-4 ${isFetchingInfo ? 'animate-spin' : ''}`} />
              <span className="ml-1 sr-only">Refresh</span>
            </Button>
          </div>
          <Input
            id="webhookUrl"
            value={webhookInfo?.url || webhookUrl || "Not configured"}
            readOnly
            disabled={isLoading}
          />
          <p className="text-xs text-muted-foreground mt-1">
            The webhook URL is where Telegram sends updates to your bot.
          </p>
        </div>
        
        {webhookInfo && (
          <div className="space-y-2 mt-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium">Webhook Status:</h3>
              {webhookInfo.url ? (
                <Badge variant={webhookInfo.last_error_message ? "outline" : "default"}>
                  {webhookInfo.last_error_message ? "Issues detected" : "Active"}
                </Badge>
              ) : (
                <Badge variant="destructive">Not configured</Badge>
              )}
            </div>
              
            <Collapsible
              open={isDetailsOpen}
              onOpenChange={setIsDetailsOpen}
              className="mt-2 space-y-2"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">
                  Webhook Details
                </h4>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <ChevronDown className={`h-4 w-4 transition-transform ${isDetailsOpen ? 'rotate-180' : ''}`} />
                    <span className="sr-only">Toggle details</span>
                  </Button>
                </CollapsibleTrigger>
              </div>
              
              <CollapsibleContent className="space-y-2">
                <div className="rounded-md border p-3 text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pending updates:</span>
                    <span>{webhookInfo.pending_update_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max connections:</span>
                    <span>{webhookInfo.max_connections}</span>
                  </div>
                  {webhookInfo.ip_address && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Server IP:</span>
                      <span>{webhookInfo.ip_address}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Custom certificate:</span>
                    <span>{webhookInfo.has_custom_certificate ? "Yes" : "No"}</span>
                  </div>
                  {webhookInfo.last_error_date && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last error:</span>
                      <span>{formatDate(webhookInfo.last_error_date)}</span>
                    </div>
                  )}
                  {webhookInfo.last_error_message && (
                    <div className="pt-1">
                      <span className="text-muted-foreground">Error message:</span>
                      <p className="mt-1 text-xs p-2 bg-muted rounded">{webhookInfo.last_error_message}</p>
                    </div>
                  )}
                  
                  {verificationUrls.set_webhook && (
                    <>
                      <Separator className="my-2" />
                      <div className="pt-1">
                        <span className="text-muted-foreground">Verification Links:</span>
                        <div className="mt-2 flex flex-col gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-xs justify-start"
                            onClick={() => window.open(verificationUrls.get_webhook_info, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3 mr-2" />
                            Get Webhook Info
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
        
        <div className="space-y-2 pt-2">
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
