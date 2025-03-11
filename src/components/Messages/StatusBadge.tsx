
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/generalUtils';

interface StatusBadgeProps {
  status?: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  switch (status) {
    case 'completed':
      return <Badge variant="success" className={cn("text-xs", className)}>Completed</Badge>;
    case 'processing':
      return <Badge variant="default" className={cn("text-xs", className)}>Processing</Badge>;
    case 'error':
      return <Badge variant="destructive" className={cn("text-xs", className)}>Error</Badge>;
    case 'pending':
      return <Badge variant="warning" className={cn("text-xs bg-yellow-500", className)}>Pending</Badge>;
    default:
      return <Badge variant="outline" className={cn("text-xs", className)}>Unknown</Badge>;
  }
};
