
import React from 'react';
import { PageContainer } from "@/components/Layout/PageContainer";
import { AccountCard } from "@/components/Settings/AccountCard";
import { useAuth } from "@/hooks/useAuth";

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <PageContainer title="Settings">
      <div className="space-y-6">
        <AccountCard userEmail={user?.email} />
        {/* Telegram settings removed as the settings table does not exist */}
      </div>
    </PageContainer>
  );
}
