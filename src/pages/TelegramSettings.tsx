
import React, { useState, useEffect } from 'react';
import { PageContainer } from '@/components/Layout/PageContainer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ResetStuckMessages } from '@/components/TelegramManager/ResetStuckMessages';
import { TelegramCard } from '@/components/Settings/Telegram/TelegramCard';
import { supabase } from '@/integrations/supabase/client';

export default function TelegramSettings() {
  const [botToken, setBotToken] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchSettings() {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('settings')
          .select('*')
          .eq('id', '1')
          .single();

        if (error) throw error;

        if (data) {
          setBotToken(data.bot_token || null);
          setWebhookUrl(data.webhook_url || null);
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSettings();
  }, []);

  return (
    <PageContainer>
      <h1 className="text-2xl font-bold mb-4">Telegram Settings</h1>

      <Tabs defaultValue="settings" className="space-y-6">
        <TabsList>
          <TabsTrigger value="settings">Bot Settings</TabsTrigger>
          <TabsTrigger value="management">Message Management</TabsTrigger>
        </TabsList>
        
        <TabsContent value="settings" className="space-y-6">
          <TelegramCard botToken={botToken} webhookUrl={webhookUrl} />
        </TabsContent>
        
        <TabsContent value="management" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Message Management</CardTitle>
              <CardDescription>
                Utilities to manage Telegram messages and their processing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ResetStuckMessages />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
