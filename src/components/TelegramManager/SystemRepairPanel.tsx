
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Wrench } from 'lucide-react';
import { MessageProcessingStats } from '@/types/MessagesTypes';
import { useFileRepair } from '@/hooks/useFileRepair';

interface SystemRepairPanelProps {
  stats: MessageProcessingStats;
  onRefresh: () => Promise<void>;
  isRefetching: boolean;
}

export function SystemRepairPanel({ stats, onRefresh, isRefetching }: SystemRepairPanelProps) {
  const { repairFiles, isRepairing } = useFileRepair();

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Repair Tools</CardTitle>
        <CardDescription>
          Fix common issues with media files and processing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => repairFiles('mime-types')}
            disabled={isRepairing}
          >
            <Wrench className="mr-2 h-4 w-4" />
            Fix MIME Types
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => repairFiles('storage-paths')}
            disabled={isRepairing}
          >
            <Wrench className="mr-2 h-4 w-4" />
            Fix Storage Paths
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => repairFiles('file-ids')}
            disabled={isRepairing}
          >
            <Wrench className="mr-2 h-4 w-4" />
            Fix File IDs
          </Button>
        </div>
      </CardContent>
      <CardFooter className="justify-between">
        <Button 
          variant="secondary" 
          size="sm" 
          onClick={() => repairFiles('all')}
          disabled={isRepairing}
        >
          <Wrench className="mr-2 h-4 w-4" />
          Run All Repairs
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onRefresh}
          disabled={isRefetching}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          Refresh Stats
        </Button>
      </CardFooter>
    </Card>
  );
}
