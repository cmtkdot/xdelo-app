
import React from 'react';
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { X } from 'lucide-react';
import { MessageAnalyticsPanel } from './MessageAnalyticsPanel';
import { MessageDetailsPanel } from './MessageDetailsPanel';
import { useMessagesStore } from '@/hooks/useMessagesStore';
import { useMessageAnalytics } from '@/hooks/useMessageAnalytics';

interface MessagesLayoutProps {
  children: React.ReactNode;
  detailsOpen: boolean;
  analyticsOpen: boolean;
}

export function MessagesLayout({ 
  children, 
  detailsOpen, 
  analyticsOpen 
}: MessagesLayoutProps) {
  const { selectedMessage, setDetailsOpen, setAnalyticsOpen } = useMessagesStore();
  const { data: analyticsData, isLoading: analyticsLoading } = useMessageAnalytics();

  const handleEdit = (message: any) => {
    // This would be handled by a parent component
    console.log('Edit message:', message);
  };

  const handleDelete = (message: any) => {
    // This would be handled by a parent component
    console.log('Delete message:', message);
  };

  return (
    <div className="flex">
      {analyticsOpen && (
        <div className="w-72 mr-6 border rounded-md p-4 h-[calc(100vh-12rem)] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium">Analytics</h3>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setAnalyticsOpen(false)}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {analyticsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <MessageAnalyticsPanel data={analyticsData} />
          )}
        </div>
      )}
      
      <div className="flex-1">
        {children}
      </div>
      
      {detailsOpen && selectedMessage && (
        <div className="w-96 ml-6 border rounded-md p-4 h-[calc(100vh-12rem)] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium">Message Details</h3>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setDetailsOpen(false)}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <MessageDetailsPanel 
            message={selectedMessage} 
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </div>
      )}
    </div>
  );
}
