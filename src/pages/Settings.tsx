
import React, { useEffect, useState } from 'react';
import { PageContainer } from '@/components/Layout/PageContainer';
import { AccountCard } from '@/components/Settings/AccountCard';
import { TelegramCard } from '@/components/Settings/TelegramCard';
import { DangerZoneCard } from '@/components/Settings/DangerZoneCard';
import { FixMediaUrlsCard } from '@/components/Settings/FixMediaUrlsCard';
import { FixMessageUrlsCard } from '@/components/Settings/FixMessageUrlsCard';
import { useSupabase } from '@/integrations/supabase/SupabaseProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Database } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

interface FixMissingColumnsResult {
  success: boolean;
  message?: string;
  columns_added?: string[];
  error?: string;
  details?: any;
}

export default function Settings() {
  const [telegramSettings, setTelegramSettings] = useState<{
    botToken: string | null;
    webhookUrl: string | null;
  }>({
    botToken: null,
    webhookUrl: null
  });
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isRunningMissingColumnsRepair, setIsRunningMissingColumnsRepair] = useState(false);
  const [missingColumnsResult, setMissingColumnsResult] = useState<FixMissingColumnsResult>({
    success: false
  });
  const supabase = useSupabase();
  const { toast } = useToast();

  // Fetch user data and settings when the component mounts
  useEffect(() => {
    const fetchUserAndSettings = async () => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email);
      }

      // Get telegram settings
      const { data: settingsData, error } = await supabase
        .from('settings')
        .select('bot_token, webhook_url')
        .limit(1)
        .single();

      if (!error && settingsData) {
        setTelegramSettings({
          botToken: settingsData.bot_token,
          webhookUrl: settingsData.webhook_url
        });
      }
    };

    fetchUserAndSettings();
  }, [supabase]);

  const handleFixMissingColumnsDirectly = async () => {
    try {
      setIsRunningMissingColumnsRepair(true);
      
      // First try using RPC
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('xdelo_run_fix_missing_columns');
      
      if (rpcError) {
        // If RPC fails, try the Edge Function
        console.log('RPC failed, trying Edge Function');
        const { data, error } = await supabase.functions.invoke<FixMissingColumnsResult>('xdelo_run_fix_missing_columns');
        
        if (error) {
          throw error;
        }
        
        setMissingColumnsResult(data);
        
        toast({
          title: "Database Repair Complete",
          description: data.message || `Added columns: ${(data.columns_added || []).join(', ')}`,
          variant: data.success ? "default" : "destructive"
        });
      } else {
        // RPC succeeded
        setMissingColumnsResult(rpcData as FixMissingColumnsResult);
        
        toast({
          title: "Database Repair Complete",
          description: rpcData.message || `Added columns: ${(rpcData.columns_added || []).join(', ')}`,
          variant: rpcData.success ? "default" : "destructive"
        });
      }
    } catch (error) {
      console.error('Error fixing missing columns:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
      setMissingColumnsResult({
        success: false,
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    } finally {
      setIsRunningMissingColumnsRepair(false);
    }
  };

  return (
    <PageContainer title="Settings">
      <div className="grid gap-6 md:grid-cols-2">
        <AccountCard userEmail={userEmail} />
        <TelegramCard 
          botToken={telegramSettings.botToken} 
          webhookUrl={telegramSettings.webhookUrl} 
        />
      </div>
      
      <h2 className="text-xl font-semibold mt-8 mb-4">Database Maintenance</h2>
      
      <div className="grid gap-6 md:grid-cols-2">
        <FixMediaUrlsCard />
        <FixMessageUrlsCard />
        
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-lg">Fix Database Schema</CardTitle>
            <CardDescription>
              Add missing columns to database tables
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              This will add missing columns to the database tables, such as forward_info, telegram_message_id,
              retry_count, last_error_at and message_url to the other_messages table.
            </p>
            
            {missingColumnsResult.success !== undefined && (
              <div className="mt-2 p-3 text-sm border rounded bg-gray-100 dark:bg-gray-800">
                <div className="font-medium mb-1">
                  {missingColumnsResult.success ? (
                    <span className="text-green-600 dark:text-green-400">Operation Successful</span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400">Operation Failed</span>
                  )}
                </div>
                <div className="text-xs">
                  {missingColumnsResult.message}
                  {missingColumnsResult.columns_added && missingColumnsResult.columns_added.length > 0 && (
                    <div className="mt-1">
                      Added columns: {missingColumnsResult.columns_added.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
          
          <CardFooter>
            <Button
              onClick={handleFixMissingColumnsDirectly}
              disabled={isRunningMissingColumnsRepair}
              className="w-full sm:w-auto flex items-center justify-center gap-2"
              variant="default"
            >
              {isRunningMissingColumnsRepair ? (
                <>
                  <Spinner className="h-4 w-4" />
                  Fixing Schema...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4" />
                  Fix Missing Columns
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
      
      <h2 className="text-xl font-semibold mt-8 mb-4">Danger Zone</h2>
      
      <div className="grid gap-6">
        <DangerZoneCard />
      </div>
    </PageContainer>
  );
}
