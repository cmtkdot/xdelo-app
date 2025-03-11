
import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AlertCircle, ArrowUpCircle, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { useProcessingHealth } from '@/hooks/useProcessingHealth';
import { useStuckMessageRepair } from '@/hooks/useStuckMessageRepair';

export function MessageHealth() {
  const { processingStats, diagnoseProcessingHealth, isLoading } = useProcessingHealth();
  const { repairStuckMessages, isRepairing } = useStuckMessageRepair();
  
  // Get health metrics on initial load
  useEffect(() => {
    diagnoseProcessingHealth();
  }, [diagnoseProcessingHealth]);
  
  const handleRepair = async () => {
    await repairStuckMessages();
    // Refresh health metrics after repair
    diagnoseProcessingHealth();
  };
  
  return (
    <Card className="bg-white dark:bg-gray-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Processing Health</CardTitle>
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => diagnoseProcessingHealth()}
              disabled={isLoading}
            >
              {isLoading ? <Spinner size="sm" className="mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Refresh
            </Button>
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={handleRepair}
              disabled={isRepairing || !processingStats?.media_group_stats?.stuck_in_processing}
            >
              {isRepairing ? <Spinner size="sm" className="mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Reset Stuck
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center p-4">
            <Spinner size="lg" />
          </div>
        ) : !processingStats ? (
          <div className="text-center py-4">
            <p className="text-gray-500">No health stats available</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatusGroup 
              title="Message States" 
              items={[
                { label: 'Pending', value: processingStats.state_counts?.pending || 0, icon: <Clock className="w-4 h-4 text-amber-500" /> },
                { label: 'Processing', value: processingStats.state_counts?.processing || 0, icon: <ArrowUpCircle className="w-4 h-4 text-blue-500" /> },
                { label: 'Completed', value: processingStats.state_counts?.completed || 0, icon: <CheckCircle className="w-4 h-4 text-green-500" /> },
                { label: 'Error', value: processingStats.state_counts?.error || 0, icon: <AlertCircle className="w-4 h-4 text-red-500" /> },
              ]} 
            />
            
            <StatusGroup 
              title="Media Groups" 
              items={[
                { label: 'Unprocessed with Caption', value: processingStats.media_group_stats?.unprocessed_with_caption || 0 },
                { label: 'Stuck in Processing', value: processingStats.media_group_stats?.stuck_in_processing || 0, alert: true },
                { label: 'Orphaned Messages', value: processingStats.media_group_stats?.orphaned_media_group_messages || 0 },
              ]} 
            />
            
            <StatusGroup 
              title="Processing Times" 
              items={[
                { 
                  label: 'Avg Processing Time', 
                  value: processingStats.timing_stats?.avg_processing_time_seconds ? 
                    `${processingStats.timing_stats.avg_processing_time_seconds.toFixed(1)}s` : 'N/A' 
                },
                { 
                  label: 'Oldest Unprocessed', 
                  value: processingStats.timing_stats?.oldest_unprocessed_caption_age_hours ? 
                    `${processingStats.timing_stats.oldest_unprocessed_caption_age_hours.toFixed(1)}h` : 'N/A',
                  alert: processingStats.timing_stats?.oldest_unprocessed_caption_age_hours ? 
                    processingStats.timing_stats.oldest_unprocessed_caption_age_hours > 1 : false
                },
                { 
                  label: 'Oldest Stuck', 
                  value: processingStats.timing_stats?.oldest_stuck_processing_hours ? 
                    `${processingStats.timing_stats.oldest_stuck_processing_hours.toFixed(1)}h` : 'N/A',
                  alert: processingStats.timing_stats?.oldest_stuck_processing_hours ? 
                    processingStats.timing_stats.oldest_stuck_processing_hours > 1 : false 
                },
              ]} 
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface StatusItemProps {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  alert?: boolean;
}

interface StatusGroupProps {
  title: string;
  items: StatusItemProps[];
}

function StatusGroup({ title, items }: StatusGroupProps) {
  return (
    <div>
      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">{title}</h3>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              {item.icon}
              <span className="text-sm">{item.label}</span>
            </div>
            <Badge variant={item.alert ? "destructive" : "secondary"} className="ml-2">
              {item.value}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
