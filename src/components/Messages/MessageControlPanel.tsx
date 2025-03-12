
import React from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RefreshCw, Wrench } from "lucide-react";
import { useFileRepair } from '@/hooks/useFileRepair';

interface MessageControlPanelProps {
  onRefresh: () => void;
  isRefreshing: boolean;
  messageCount: number;
}

export function MessageControlPanel({ 
  onRefresh, 
  isRefreshing, 
  messageCount
}: MessageControlPanelProps) {
  const { repairFiles, isRepairing } = useFileRepair();

  return (
    <Card className="p-4">
      <div className="flex flex-wrap gap-2 justify-between items-center">
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button 
            variant="outline" 
            size="sm"
            onClick={() => repairFiles({})}
            disabled={isRepairing}
          >
            <Wrench className="mr-2 h-4 w-4" />
            Repair Files
          </Button>
        </div>

        <div className="text-sm text-muted-foreground">
          Showing {messageCount} message{messageCount !== 1 ? 's' : ''}
        </div>
      </div>
    </Card>
  );
}
