
import { AccountCard } from "@/components/Settings/AccountCard";
import { TelegramCard } from "@/components/Settings/Telegram";
import { ProductMatchingCard } from "@/components/Settings/ProductMatchingCard";
import { DatabaseFixCard } from "@/components/Settings/DatabaseFixCard";
import { useAuth } from "@/hooks/useAuth";

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      
      <div className="space-y-6">
        <AccountCard userEmail={user?.email} />
        <TelegramCard botToken={null} webhookUrl={null} />
        <ProductMatchingCard />
        <DatabaseFixCard />
      </div>
    </div>
  );
}
