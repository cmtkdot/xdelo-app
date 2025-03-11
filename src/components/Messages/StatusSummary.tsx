
import React from 'react';
import { Clock, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';
import { StatusCard } from './StatusCard';

interface StatusSummaryProps {
  pendingCount: number;
  processingCount: number;
  completedCount: number;
  errorCount: number;
}

export const StatusSummary: React.FC<StatusSummaryProps> = ({
  pendingCount,
  processingCount,
  completedCount,
  errorCount
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Message Processing Status</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatusCard title="Pending" count={pendingCount} icon={<Clock className="w-5 h-5 text-yellow-500" />} />
        <StatusCard title="Processing" count={processingCount} icon={<ArrowRight className="w-5 h-5 text-blue-500" />} />
        <StatusCard title="Completed" count={completedCount} icon={<CheckCircle className="w-5 h-5 text-green-500" />} />
        <StatusCard title="Error" count={errorCount} icon={<AlertCircle className="w-5 h-5 text-red-500" />} />
      </div>
    </div>
  );
};
