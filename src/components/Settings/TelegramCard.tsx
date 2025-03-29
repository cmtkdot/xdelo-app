import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/useToast';
import { supabase } from '@/integrations/supabase/client';
// Fix the import conflict
import WebhookLogDisplayComponent from './WebhookLogDisplay';

const TelegramCard = () => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [logs, setLogs] = useState([]);
  const { toast } = useToast();

  useEffect(() => {
    const fetchWebhookUrl = async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'telegram_webhook_url')
        .single();

      if (error) {
        console.error('Error fetching webhook URL:', error);
        return;
      }

      setWebhookUrl(data?.value || '');
    };

    const fetchWebhookLogs = async () => {
      const { data, error } = await supabase
        .from('unified_audit_logs')
        .select('*')
        .like('event_type', 'telegram_webhook%')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        console.error('Error fetching webhook logs:', error);
        return;
      }

      setLogs(data || []);
    };

    fetchWebhookUrl();
    fetchWebhookLogs();
  }, []);

  const handleSaveWebhookUrl = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({ key: 'telegram_webhook_url', value: webhookUrl }, { onConflict: 'key' });

      if (error) {
        console.error('Error saving webhook URL:', error);
        toast({
          title: 'Error',
          description: 'Failed to save webhook URL',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Success',
        description: 'Webhook URL saved successfully',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Rename the imported component to avoid conflicts
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Telegram Webhook</CardTitle>
        <CardDescription>Configure the Telegram webhook URL for receiving updates.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="webhook-url">Webhook URL</Label>
          <Input
            id="webhook-url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="Enter webhook URL"
          />
        </div>
        <Button onClick={handleSaveWebhookUrl} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
        
        {/* Use the renamed component */}
        <WebhookLogDisplayComponent logs={logs} />
      </CardContent>
    </Card>
  );
};

export default TelegramCard;
