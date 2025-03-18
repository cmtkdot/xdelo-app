
import React from 'react';
import { PageContainer } from '@/components/Layout/PageContainer';
import { AccountCard } from '@/components/Settings/AccountCard';
import { TelegramCard } from '@/components/Settings/TelegramCard';
import { DangerZoneCard } from '@/components/Settings/DangerZoneCard';
import { FixMediaUrlsCard } from '@/components/Settings/FixMediaUrlsCard';
import { FixMessageUrlsCard } from '@/components/Settings/FixMessageUrlsCard';

export default function Settings() {
  return (
    <PageContainer>
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      
      <div className="grid gap-6 md:grid-cols-2">
        <AccountCard />
        <TelegramCard />
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
