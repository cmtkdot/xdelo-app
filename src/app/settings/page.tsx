
import { AccountCard } from "@/components/Settings/AccountCard";
import { DatabaseFixCard } from "@/components/Settings/DatabaseFixCard";
import { useUser } from "@/hooks/useUser";

export default function SettingsPage() {
  const { user } = useUser();

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      
      <div className="space-y-6">
        <AccountCard userEmail={user?.email} />
        <DatabaseFixCard />
      </div>
    </div>
  );
}
