
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AccountCard } from "@/components/Settings/AccountCard";
import { TelegramCard } from "@/components/Settings/TelegramCard";
import { SyncCard } from "@/components/Settings/SyncCard";

const Settings = () => {
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserEmail(user?.email || null);
    };
    getUser();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Settings</h2>
      </div>
      
      <AccountCard userEmail={userEmail} />
      <TelegramCard />
      <SyncCard />
    </div>
  );
};

export default Settings;
