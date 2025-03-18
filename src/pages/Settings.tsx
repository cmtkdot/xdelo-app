
import React, { useEffect, useState } from 'react';
import { PageContainer } from '@/components/Layout/PageContainer';
import { AccountCard } from '@/components/Settings/AccountCard';
import { TelegramCard } from '@/components/Settings/TelegramCard';
import { DangerZoneCard } from '@/components/Settings/DangerZoneCard';
import { FixMediaUrlsCard } from '@/components/Settings/FixMediaUrlsCard';
import { FixMessageUrlsCard } from '@/components/Settings/FixMessageUrlsCard';
import { useSupabase } from '@/integrations/supabase/SupabaseProvider';

export default function Settings() {
  const [telegramSettings, setTelegramSettings] = useState<{
    botToken: string | null;
    webhookUrl: string | null;
  }>({
    botToken: null,
    webhookUrl: null
  });
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const supabase = useSupabase();

  // Fetch user data and settings when the component mounts
  useEffect(() => {
    const fetchUserAndSettings = async () => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email);
      }

      // Get telegram settings
      const { data: settingsData, error } = await supabase
        .from('settings')
        .select('bot_token, webhook_url')
        .limit(1)
        .single();

      if (!error && settingsData) {
        setTelegramSettings({
          botToken: settingsData.bot_token,
          webhookUrl: settingsData.webhook_url
        });
      }
    };

    fetchUserAndSettings();
  }, [supabase]);

  return (
    <PageContainer title="Settings">
      <div className="grid gap-6 md:grid-cols-2">
        <AccountCard userEmail={userEmail} />
        <TelegramCard 
          botToken={telegramSettings.botToken} 
          webhookUrl={telegramSettings.webhookUrl} 
        />
      </div>
      
      <h2 className="text-xl font-semibold mt-8 mb-4">Database Maintenance</h2>
      
      <div className="grid gap-6 md:grid-cols-2">
        <FixMediaUrlsCard />
        <FixMessageUrlsCard />
      </div>
      
      <h2 className="text-xl font-semibold mt-8 mb-4">Danger Zone</h2>
      
      <div className="grid gap-6">
        <DangerZoneCard />
      </div>
    </PageContainer>
  );
}
