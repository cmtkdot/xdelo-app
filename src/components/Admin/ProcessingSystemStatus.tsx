
import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useProcessingStats } from '@/hooks/useProcessingStats';
import { useProcessingSystemRepair } from '@/hooks/useProcessingSystemRepair';
import { Sparkles } from "lucide-react";
import { Button } from '../ui/button';

export const ProcessingSystemStatus: React.FC = () => {
  const { stats, isLoading, refetch } = useProcessingStats(30000); // Refresh every 30 seconds
  const { repairProcessingFlow, isRepairing } = useProcessingSystemRepair();

  // Calculate the completion percentage
  const getCompletionPercentage = () => {
    if (!stats || stats.total === 0) return 0;
    return Math.round((stats.completed / stats.total) * 100);
  };

  // Calculate error percentage
  const getErrorPercentage = () => {
    if (!stats || stats.total === 0) return 0;
    return Math.round((stats.error / stats.total) * 100);
  };

  // Check if the system is healthy
  const isSystemHealthy = () => {
    if (!stats) return true;
    
    const stallThreshold = 5; // System is unhealthy if more than 5 stalled messages
    const errorThreshold = 0.05; // System is unhealthy if more than 5% errors
    
    const totalStalled = stats.stalled_processing + stats.stalled_pending;
    const errorRate = stats.total > 0 ? stats.error / stats.total : 0;
    
    return totalStalled < stallThreshold && errorRate < errorThreshold;
  };

  const handleRepair = async () => {
    try {
      await repairProcessingFlow({
        limit: 20,
        repair_enums: true,
        force_reset_stalled: true,
        reset_all: false
      });
      refetch();
    } catch (error) {
      console.error('Error during repair:', error);
    }
  };

  // Conditionally refresh stats after a repair operation
  useEffect(() => {
    if (!isRepairing) {
      refetch();
    }
  }, [isRepairing, refetch]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex justify-between items-center">
          <span>Processing System Status</span>
          {!isLoading && !isSystemHealthy() && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRepair}
              disabled={isRepairing}
              className="h-7 text-xs"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              Auto Repair
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : stats ? (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Processing Progress</span>
              <span>{getCompletionPercentage()}% Complete</span>
            </div>
            <Progress value={getCompletionPercentage()} className="h-2" />
            
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-3">
              <div className="text-xs">
                <span className="text-muted-foreground">Total:</span>{' '}
                <span className="font-medium">{stats.total}</span>
              </div>
              <div className="text-xs">
                <span className="text-muted-foreground">Completed:</span>{' '}
                <span className="font-medium">{stats.completed}</span>
              </div>
              <div className="text-xs">
                <span className="text-muted-foreground">In Processing:</span>{' '}
                <span className="font-medium">{stats.processing}</span>
              </div>
              <div className="text-xs">
                <span className="text-muted-foreground">Pending:</span>{' '}
                <span className="font-medium">{stats.pending}</span>
              </div>
              <div className="text-xs">
                <span className="text-muted-foreground">Initialized:</span>{' '}
                <span className="font-medium">{stats.initialized}</span>
              </div>
              <div className="text-xs">
                <span className="text-muted-foreground">Errors:</span>{' '}
                <span className={`font-medium ${getErrorPercentage() > 5 ? 'text-destructive' : ''}`}>
                  {stats.error} ({getErrorPercentage()}%)
                </span>
              </div>
              {(stats.stalled_processing > 0 || stats.stalled_pending > 0) && (
                <div className="text-xs col-span-2 text-amber-500">
                  <span className="text-muted-foreground">Stalled:</span>{' '}
                  <span className="font-medium">
                    {stats.stalled_processing + stats.stalled_pending} messages
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            No processing statistics available
          </div>
        )}
      </CardContent>
    </Card>
  );
};
