
import React from 'react';
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { X } from 'lucide-react';
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { MessageAnalyticsPanel } from './MessageAnalyticsPanel';
import { MessageDetailsPanel } from './MessageDetailsPanel';
import { useMessagesStore } from '@/hooks/useMessagesStore';
import { useMessageAnalytics } from '@/hooks/useMessageAnalytics';
import { useIsMobile } from '@/hooks/useMobile';
import { cn } from '@/lib/utils';

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
  const isMobile = useIsMobile();

  const handleEdit = (message: any) => {
    // This would be handled by a parent component
    console.log('Edit message:', message);
  };

  const handleDelete = (message: any) => {
    // This would be handled by a parent component
    console.log('Delete message:', message);
  };

  return (
    <div className={cn(
      "flex",
      isMobile ? "flex-col" : "flex-row"
    )}>
      {/* Analytics Panel - Desktop */}
      {!isMobile && analyticsOpen && (
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
      
      {/* Analytics Panel - Mobile */}
      {isMobile && analyticsOpen && (
        <div className="border rounded-md p-3 mb-4">
          <div className="flex justify-between items-center mb-3">
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
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <div className="max-h-[40vh] overflow-y-auto">
              <MessageAnalyticsPanel data={analyticsData} />
            </div>
          )}
        </div>
      )}
      
      {/* Main Content */}
      <div className={cn(
        "flex-1",
        isMobile && detailsOpen && "mb-4"
      )}>
        {children}
      </div>
      
      {/* Details Panel - Desktop */}
      {!isMobile && detailsOpen && selectedMessage && (
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
      
      {/* Details Panel - Mobile */}
      {isMobile && detailsOpen && selectedMessage && (
        <div className="border rounded-md p-3">
          <div className="flex justify-between items-center mb-3">
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
          
          <div className="max-h-[40vh] overflow-y-auto">
            <MessageDetailsPanel 
              message={selectedMessage} 
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </div>
        </div>
      )}
    </div>
  );
}
