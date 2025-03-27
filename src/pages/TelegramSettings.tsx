
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Settings } from '@/components/Settings/Settings';
import { TelegramWebhookManager } from '@/components/TelegramManager/TelegramWebhookManager';
import { SystemRepairPanel } from '@/components/TelegramManager/SystemRepairPanel';

export default function TelegramSettings() {
  return (
    <div className="container mx-auto py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Telegram Settings</h1>
          <p className="text-muted-foreground">
            Manage your Telegram configuration and system settings
          </p>
        </div>
      </div>
      
      <Separator className="my-6" />
      
      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="settings">Bot Settings</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="system">System Repair</TabsTrigger>
        </TabsList>
        
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Telegram Bot Configuration</CardTitle>
              <CardDescription>
                Manage your Telegram bot token and webhook settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Settings />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="webhooks">
          <TelegramWebhookManager />
        </TabsContent>
        
        <TabsContent value="system">
          <SystemRepairPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
