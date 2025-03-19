
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AccountCard } from "@/components/Settings/AccountCard";
import { TelegramCard } from "@/components/Settings/TelegramCard";
import { DangerZoneCard } from "@/components/Settings/DangerZoneCard";
import { toast } from "sonner";

const Settings = () => {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [botToken, setBotToken] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      // Load user info
      const { data: { user } } = await supabase.auth.getUser();
      setUserEmail(user?.email || null);

      // Load Telegram settings
      const { data: settings, error } = await supabase
        .from('settings')
        .select('bot_token, webhook_url')
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 means no rows returned, which is fine for new installations
        console.error("Error loading settings:", error);
        toast.error("Failed to load settings");
      }

      if (settings) {
        setBotToken(settings.bot_token);
        setWebhookUrl(settings.webhook_url);
      }
    } catch (err) {
      console.error("Error in loadSettings:", err);
      toast.error("An error occurred while loading settings");
    } finally {
      setIsLoading(false);
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
