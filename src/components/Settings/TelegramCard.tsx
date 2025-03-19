
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TelegramCardProps {
  botToken: string | null;
  webhookUrl: string | null;
}

export function TelegramCard({ botToken, webhookUrl }: TelegramCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editedWebhookUrl, setEditedWebhookUrl] = useState(webhookUrl || '');
  const [webhookStatus, setWebhookStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  // Mask the bot token to only show the first few and last few characters
  const maskToken = (token: string | null) => {
    if (!token) return "Not configured";
    if (token.length <= 10) return token;
    return token.substring(0, 6) + "..." + token.substring(token.length - 4);
  };

  // Save webhook URL to database
  const saveWebhookUrl = async () => {
    if (!editedWebhookUrl) {
      toast.error("Webhook URL cannot be empty");
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('settings')
        .update({ webhook_url: editedWebhookUrl })
        .eq('id', '1'); // Converting number to string to fix the type error

      if (error) throw error;
      toast.success("Webhook URL updated successfully");
    } catch (error) {
      console.error("Error updating webhook URL:", error);
      toast.error("Failed to update webhook URL");
    } finally {
      setIsUpdating(false);
    }
  };

  // Check webhook status
  const checkWebhookStatus = async () => {
    setWebhookStatus('checking');
    setStatusMessage('');
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('xdelo_validate_webhook', {
        body: { action: 'validate' }
      });
      
      if (error) throw error;
      
      if (data.success) {
        setWebhookStatus('valid');
        setStatusMessage(data.message || 'Webhook is configured correctly');
      } else {
        setWebhookStatus('invalid');
        setStatusMessage(data.message || 'Webhook configuration is invalid');
      }
    } catch (error) {
      console.error("Error checking webhook status:", error);
      setWebhookStatus('invalid');
      setStatusMessage('Error checking webhook status');
    } finally {
      setIsLoading(false);
    }
  };

  // Set up webhook
  const setupWebhook = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('xdelo_validate_webhook', {
        body: { action: 'setup' }
      });
      
      if (error) throw error;
      
      if (data.success) {
        toast.success("Webhook set up successfully");
        setWebhookStatus('valid');
        setStatusMessage(data.message || 'Webhook is set up correctly');
      } else {
        toast.error("Failed to set up webhook");
        setWebhookStatus('invalid');
        setStatusMessage(data.message || 'Failed to set up webhook');
      }
    } catch (error) {
      console.error("Error setting up webhook:", error);
      toast.error("Error setting up webhook");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Telegram Bot Configuration</CardTitle>
        <CardDescription>
          Configure your Telegram bot's webhook for receiving messages.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="botToken">Bot Token</Label>
          <Input
            id="botToken"
            value={maskToken(botToken)}
            readOnly
            disabled={isLoading}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Bot token can only be updated in the environment variables.
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="webhookUrl">Webhook URL</Label>
          <Input
            id="webhookUrl"
            value={editedWebhookUrl}
            onChange={(e) => setEditedWebhookUrl(e.target.value)}
            placeholder="https://your-api-url.com"
            disabled={isUpdating}
          />
          <p className="text-xs text-muted-foreground mt-1">
            The base URL where Telegram will send updates (without the /webhook path).
          </p>
          <Button 
            variant="outline" 
            onClick={saveWebhookUrl} 
            disabled={isUpdating} 
            className="mt-2"
          >
            {isUpdating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Save URL
          </Button>
        </div>
        
        {webhookStatus !== 'idle' && (
          <div className={`p-3 rounded-md flex items-center gap-2 ${
            webhookStatus === 'checking' ? 'bg-blue-50 text-blue-700' :
            webhookStatus === 'valid' ? 'bg-green-50 text-green-700' :
            'bg-red-50 text-red-700'
          }`}>
            {webhookStatus === 'checking' ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : webhookStatus === 'valid' ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              <XCircle className="h-5 w-5" />
            )}
            <span className="text-sm">{statusMessage}</span>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          onClick={checkWebhookStatus}
          disabled={isLoading}
        >
          {isLoading && webhookStatus === 'checking' ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <AlertCircle className="h-4 w-4 mr-2" />
          )}
          Check Status
        </Button>
        
        <Button
          variant="default"
          onClick={setupWebhook}
          disabled={isLoading}
        >
          {isLoading && webhookStatus !== 'checking' ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : null}
          Setup Webhook
        </Button>
      </CardFooter>
    </Card>
  );
}
