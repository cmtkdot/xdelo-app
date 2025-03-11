
import React from 'react';

interface StatusCardProps {
  title: string;
  count: number;
  icon: React.ReactNode;
}

export const StatusCard: React.FC<StatusCardProps> = ({ title, count, icon }) => (
  <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
    <div className="flex justify-between items-center">
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
        <p className="text-2xl font-bold">{count}</p>
      </div>
      <div className="text-2xl">{icon}</div>
    </div>
  </div>
);
