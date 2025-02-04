import React from 'react';
import { useGlideSync } from '@/hooks/useGlideSync';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export const GlideSyncStatus = () => {
  const { syncMetrics, isLoadingMetrics, configureMapping } = useGlideSync();

  if (isLoadingMetrics) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Glide Sync Status</h3>
        
        {syncMetrics && (
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Total Messages</p>
              <p className="text-xl font-bold">{syncMetrics.total_messages}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Successful</p>
              <p className="text-xl font-bold text-green-600">
                {syncMetrics.successful_messages}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Failed</p>
              <p className="text-xl font-bold text-red-600">
                {syncMetrics.failed_messages}
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-2">
          <Button
            variant="outline"
            onClick={() => configureMapping()}
          >
            Configure Mapping
          </Button>
        </div>
      </div>
    </Card>
  );
};