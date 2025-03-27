
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';
import { ResetStuckMessages } from './ResetStuckMessages';

export function SystemRepairPanel() {
  const [isRepairing, setIsRepairing] = useState(false);
  const [isRecheckingGroups, setIsRecheckingGroups] = useState(false);
  const [isSyncingContent, setIsSyncingContent] = useState(false);
  const { toast } = useToast();

  const handleRepairMetadataFunctions = async () => {
    setIsRepairing(true);
    try {
      const { data, error } = await supabase.functions.invoke('xdelo_run_sql_migration', {
        body: {
          migration: 'add_telegram_metadata_function',
          description: 'Repair telegram metadata extraction function'
        }
      });

      if (error) throw error;

      toast({
        title: 'System functions repaired',
        description: 'The missing metadata functions have been added to the database.',
      });
    } catch (error) {
      console.error('Error repairing system:', error);
      toast({
        title: 'Repair failed',
        description: error.message || 'An unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsRepairing(false);
    }
  };

  const handleRecheckMediaGroups = async () => {
    setIsRecheckingGroups(true);
    try {
      const { data, error } = await supabase.rpc('xdelo_recheck_media_groups');

      if (error) throw error;

      toast({
        title: 'Media groups checked',
        description: 'All media groups have been processed for consistency.',
      });
    } catch (error) {
      console.error('Error checking media groups:', error);
      toast({
        title: 'Check failed',
        description: error.message || 'An unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsRecheckingGroups(false);
    }
  };

  const handleResetStuckMessages = async () => {
    setIsSyncingContent(true);
    try {
      const { data, error } = await supabase.rpc('xdelo_reset_stalled_messages');

      if (error) throw error;

      toast({
        title: 'Stuck messages reset',
        description: 'All stuck messages have been reset to pending state.',
      });
    } catch (error) {
      console.error('Error resetting stuck messages:', error);
      toast({
        title: 'Reset failed',
        description: error.message || 'An unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsSyncingContent(false);
    }
  };

  return (
    <>
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>System Repair</CardTitle>
          <CardDescription>
            Tools to fix system issues and ensure smooth operation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="mb-4">
            <AlertTitle>Database Function Repairs</AlertTitle>
            <AlertDescription>
              If you're seeing errors about missing database functions, use this tool to repair them.
            </AlertDescription>
            <div className="mt-4">
              <Button 
                onClick={handleRepairMetadataFunctions} 
                disabled={isRepairing}
              >
                {isRepairing && <Spinner className="mr-2 h-4 w-4" />}
                Repair Metadata Functions
              </Button>
            </div>
          </Alert>

          <Alert className="mb-4">
            <AlertTitle>Media Group Consistency</AlertTitle>
            <AlertDescription>
              Fix inconsistencies between messages in the same media group.
            </AlertDescription>
            <div className="mt-4">
              <Button 
                onClick={handleRecheckMediaGroups} 
                disabled={isRecheckingGroups}
                variant="outline"
              >
                {isRecheckingGroups && <Spinner className="mr-2 h-4 w-4" />}
                Recheck Media Groups
              </Button>
            </div>
          </Alert>

          <ResetStuckMessages />
        </CardContent>
      </Card>
    </>
  );
}
