
import React from 'react';
import { Badge } from '@/components/ui/badge';

interface StatusBadgeProps {
  status?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  switch (status) {
    case 'completed':
      return <Badge variant="success" className="text-xs">Completed</Badge>;
    case 'processing':
      return <Badge variant="default" className="text-xs">Processing</Badge>;
    case 'error':
      return <Badge variant="destructive" className="text-xs">Error</Badge>;
    case 'pending':
      return <Badge variant="warning" className="text-xs">Pending</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">Unknown</Badge>;
  }
};
