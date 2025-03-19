
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AccountCard } from "@/components/Settings/AccountCard";
import { TelegramCard } from "@/components/Settings/Telegram";
import { DangerZoneCard } from "@/components/Settings/DangerZoneCard";

const Settings = () => {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [botToken, setBotToken] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);

  const loadSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserEmail(user?.email || null);

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

  useEffect(() => {
    loadSettings();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Settings</h2>
      </div>
      
      <AccountCard userEmail={userEmail} />
      <TelegramCard 
        botToken={botToken} 
        webhookUrl={webhookUrl}
      />
      <DangerZoneCard />
    </div>
  );
};

export default Settings;
