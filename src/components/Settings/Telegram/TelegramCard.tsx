
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/useToast";
import { useSupabase } from "@/integrations/supabase/SupabaseProvider";
import { BotTokenSelector } from "./BotTokenSelector";
import { WebhookUrlDisplay } from "./WebhookUrlDisplay";
import { WebhookStatus } from "./WebhookStatus";
import { WebhookSetter } from "./WebhookSetter";

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
  const [selectedToken, setSelectedToken] = useState<string>('');
  const [webhookLog, setWebhookLog] = useState<any>(null);
  const [webhookInfo, setWebhookInfo] = useState<WebhookInfo | null>(null);
  const [verificationUrls, setVerificationUrls] = useState<{
    set_webhook?: string;
    get_webhook_info?: string;
  }>({});

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
          setAvailableTokens(botToken ? [botToken] : []);
          setSelectedToken(botToken || '');
        }
      }
    };

    fetchSecrets();
  }, [botToken, supabase.functions]);

  // Initialize selected token if botToken is provided
  useEffect(() => {
    if (botToken && !selectedToken) {
      setSelectedToken(botToken);
    }
  }, [botToken, selectedToken]);

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
      
      if (data && data.webhook_info) {
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Telegram Bot Configuration</CardTitle>
        <CardDescription>
          Configure your Telegram bot settings and webhook.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <BotTokenSelector 
          availableTokens={availableTokens}
          selectedToken={selectedToken}
          setSelectedToken={setSelectedToken}
          onSaveToken={handleSaveToken}
          isLoading={isLoading}
        />
        
        <WebhookUrlDisplay 
          webhookUrl={webhookInfo?.url || webhookUrl}
          onRefresh={fetchWebhookInfo}
          isRefreshing={isFetchingInfo}
          isDisabled={isLoading || !selectedToken || selectedToken === 'custom'}
        />
        
        {webhookInfo && (
          <WebhookStatus 
            webhookInfo={webhookInfo}
            verificationUrls={verificationUrls}
          />
        )}
        
        <WebhookSetter 
          onSetWebhook={handleSetWebhook}
          isSettingWebhook={isSettingWebhook}
          webhookStatus={webhookStatus}
          webhookLog={webhookLog}
          disabled={!selectedToken || (selectedToken === 'custom' && !selectedToken)}
        />
      </CardContent>
    </Card>
  );
}
