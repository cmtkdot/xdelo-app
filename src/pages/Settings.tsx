
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isSettingWebhook, setIsSettingWebhook] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserEmail(user?.email || null);
    };
    getUser();
  }, []);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
      
      navigate("/auth");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const setupTelegramWebhook = async () => {
    try {
      setIsSettingWebhook(true);
      const { error } = await supabase.functions.invoke('setup-telegram-webhook');
      
      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Telegram webhook has been set up successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to set up webhook: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsSettingWebhook(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Settings</h2>
      </div>
      
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Account</h3>
            {userEmail && (
              <p className="text-sm text-gray-500">Logged in as {userEmail}</p>
            )}
          </div>
          <Button variant="destructive" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Telegram Integration</h3>
            <p className="text-sm text-gray-500">Manage Telegram webhook settings</p>
          </div>
          <Button 
            onClick={setupTelegramWebhook} 
            disabled={isSettingWebhook}
          >
            {isSettingWebhook ? "Setting up..." : "Setup Webhook"}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default Settings;
