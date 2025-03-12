
import React from 'react';
import { Clock, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';
import { Card } from "@/components/ui/card";
import type { MessageProcessingStats } from '@/types/MessagesTypes';

interface StatusSummaryProps {
  stats: MessageProcessingStats;
}

export function StatusSummary({ stats }: StatusSummaryProps) {
  const pendingCount = stats?.state_counts?.pending || 0;
  const processingCount = stats?.state_counts?.processing || 0;
  const completedCount = stats?.state_counts?.completed || 0;
  const errorCount = stats?.state_counts?.error || 0;
  
  return (
    <Card className="p-4 mb-4">
      <h3 className="text-lg font-medium mb-2">Message Processing Status</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-yellow-500" />
          <div>
            <div className="text-sm font-medium">Pending</div>
            <div className="text-2xl font-bold">{pendingCount}</div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <ArrowRight className="w-5 h-5 text-blue-500" />
          <div>
            <div className="text-sm font-medium">Processing</div>
            <div className="text-2xl font-bold">{processingCount}</div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-500" />
          <div>
            <div className="text-sm font-medium">Completed</div>
            <div className="text-2xl font-bold">{completedCount}</div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <div>
            <div className="text-sm font-medium">Error</div>
            <div className="text-2xl font-bold">{errorCount}</div>
          </div>
        </div>
      </div>
    </Card>
  );
}
