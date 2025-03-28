
import { useEffect, useState } from "react";
import { TelegramCard } from "./Telegram/TelegramCard";
import { useSupabase } from "@/integrations/supabase/SupabaseProvider";

export function TelegramSettingsTab() {
  const [botToken, setBotToken] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = useSupabase();
  
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('settings')
          .select('bot_token, webhook_url')
          .eq('id', '1')
          .single();
          
        if (error) throw error;
        
        setBotToken(data.bot_token);
        setWebhookUrl(data.webhook_url);
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSettings();
  }, [supabase]);
  
  if (isLoading) {
    return <div>Loading settings...</div>;
  }
  
  return (
    <div>
      <TelegramCard 
        botToken={botToken} 
        webhookUrl={webhookUrl}
      />
    </div>
  );
}
