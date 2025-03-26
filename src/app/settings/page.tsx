
import React from 'react';
import { PageContainer } from "@/components/Layout/PageContainer";
import { AccountCard } from "@/components/Settings/AccountCard";
import { TelegramCard } from "@/components/Settings/Telegram";
import { ProductMatchingCard } from "@/components/Settings/ProductMatchingCard";
import { DatabaseFixCard } from "@/components/Settings/DatabaseFixCard";
import { LogFixerCard } from "@/components/Settings/LogFixerCard";
import { DangerZoneCard } from "@/components/Settings/DangerZoneCard";
import { useAuth } from "@/hooks/useAuth";
import { useSupabase } from "@/integrations/supabase/SupabaseProvider";
import { useState, useEffect } from "react";

export default function SettingsPage() {
  const { user } = useAuth();
  const supabase = useSupabase();
  const [botToken, setBotToken] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      // Load Telegram settings
      const { data: settings, error } = await supabase
        .from('settings')
        .select('bot_token, webhook_url')
        .single();

      if (!error && settings) {
        setBotToken(settings.bot_token);
        setWebhookUrl(settings.webhook_url);
      }
    };

    loadSettings();
  }, [supabase]);

  return (
    <PageContainer title="Settings">
      <div className="space-y-6">
        <AccountCard userEmail={user?.email} />
        <TelegramCard botToken={botToken} webhookUrl={webhookUrl} />
        <ProductMatchingCard />
        <LogFixerCard />
        <DatabaseFixCard />
        <DangerZoneCard />
      </div>
    </PageContainer>
  );
}
