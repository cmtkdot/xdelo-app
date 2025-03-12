
import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Tool, AlertTriangle, CheckCircle, FileText, Clock } from "lucide-react";
import { MessageProcessingStats } from '@/types';
import { useMessageQueue } from '@/hooks/useMessageQueue';
import { xdelo_useFileRepair } from '@/hooks/useFileRepair';
import { format } from 'date-fns';

export const SystemRepairPanel: React.FC = () => {
  const { stats, isLoading, error, handleRefresh, isRefreshing } = useMessageQueue();
  const { repairAll, isRepairing } = xdelo_useFileRepair();
  
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy h:mm a');
    } catch (e) {
      return 'Unknown';
    }
  };
  
  const handleRepairAll = async () => {
    try {
      await repairAll();
      await handleRefresh();
    } catch (error) {
      console.error('Error in system repair:', error);
    }
  };
  
  if (isLoading) {
    return (
      <Card className="w-full h-48 flex items-center justify-center">
        <CardContent className="text-center">
          <div className="flex flex-col items-center">
            <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            <p className="mt-2 text-gray-500">Loading system stats...</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (error) {
    return (
      <Card className="w-full h-48 bg-red-50 dark:bg-red-900/20">
        <CardHeader>
          <CardTitle className="text-red-700 dark:text-red-400 flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            Error Loading System Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600 dark:text-red-300">{error.message}</p>
        </CardContent>
        <CardFooter>
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardFooter>
      </Card>
    );
  }
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>System Health & Maintenance</span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </CardTitle>
        <CardDescription>View system health and perform maintenance operations</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatusCard 
            title="Messages by State" 
            items={[
              { label: 'Pending', value: stats?.by_processing_state?.pending || 0, icon: <Clock className="h-4 w-4 text-yellow-500" /> },
              { label: 'Processing', value: stats?.by_processing_state?.processing || 0, icon: <RefreshCw className="h-4 w-4 text-blue-500" /> },
              { label: 'Completed', value: stats?.by_processing_state?.completed || 0, icon: <CheckCircle className="h-4 w-4 text-green-500" /> },
              { label: 'Error', value: stats?.by_processing_state?.error || 0, icon: <AlertTriangle className="h-4 w-4 text-red-500" /> },
              { label: 'Total', value: stats?.total || 0 }
            ]} 
          />
          
          <StatusCard 
            title="Messages by Type" 
            items={[
              { label: 'Photos', value: stats?.by_media_type?.photo || 0 },
              { label: 'Videos', value: stats?.by_media_type?.video || 0 },
              { label: 'Documents', value: stats?.by_media_type?.document || 0 },
              { label: 'Other', value: stats?.by_media_type?.other || 0 }
            ]} 
          />
          
          <StatusCard 
            title="Processing Times" 
            items={[
              { 
                label: 'Average', 
                value: stats?.processing_times?.avg_seconds 
                  ? `${Math.round(stats.processing_times.avg_seconds)}s` 
                  : 'N/A' 
              },
              { 
                label: 'Maximum', 
                value: stats?.processing_times?.max_seconds 
                  ? `${Math.round(stats.processing_times.max_seconds)}s` 
                  : 'N/A' 
              }
            ]} 
          />
        </div>
        
        <div className="mt-6">
          <h3 className="text-lg font-medium">System Maintenance</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-3">
            Perform maintenance operations to fix common issues
          </p>
          
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleRepairAll}
              disabled={isRepairing}
              className="flex items-center"
            >
              <Tool className="h-4 w-4 mr-2" />
              {isRepairing ? 'Repairing...' : 'Comprehensive System Repair'}
            </Button>
          </div>
        </div>
      </CardContent>
      <CardFooter className="border-t pt-4 text-xs text-gray-500 dark:text-gray-400">
        Last updated: {stats?.latest_update ? formatDate(stats.latest_update) : 'Never'}
      </CardFooter>
    </Card>
  );
};

interface StatusCardProps {
  title: string;
  items: Array<{
    label: string;
    value: number | string;
    icon?: React.ReactNode;
  }>;
}

const StatusCard: React.FC<StatusCardProps> = ({ title, items }) => {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-medium mb-3">{title}</h3>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex justify-between items-center">
            <div className="flex items-center">
              {item.icon && <span className="mr-1.5">{item.icon}</span>}
              <span className="text-sm text-gray-600 dark:text-gray-400">{item.label}</span>
            </div>
            <span className="font-medium">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
