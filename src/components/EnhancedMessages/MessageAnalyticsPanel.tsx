
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  BarChart, 
  PieChart, 
  Image as ImageIcon, 
  FileVideo, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Users, 
  Tag
} from 'lucide-react';

interface AnalyticsData {
  totalMessages: number;
  mediaTypes: {
    images: number;
    videos: number;
    documents: number;
    other: number;
  };
  processingStates: {
    completed: number;
    error: number;
    processing: number;
    pending: number;
    initialized: number;
  };
  mediaGroups: {
    total: number;
    averageSize: number;
    maxSize: number;
  };
  vendorStats: {
    totalVendors: number;
    topVendors: Array<{ name: string; count: number }>;
  };
  timePeriods: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    older: number;
  };
}

interface MessageAnalyticsPanelProps {
  data?: AnalyticsData;
}

export const MessageAnalyticsPanel: React.FC<MessageAnalyticsPanelProps> = ({ data }) => {
  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const {
    totalMessages,
    mediaTypes,
    processingStates,
    mediaGroups,
    vendorStats,
    timePeriods
  } = data;

  // Calculate percentages
  const getPercentage = (value: number, total: number) => {
    return total > 0 ? Math.round((value / total) * 100) : 0;
  };
  
  // Media type percentages
  const imagePercentage = getPercentage(mediaTypes.images, totalMessages);
  const videoPercentage = getPercentage(mediaTypes.videos, totalMessages);
  const docPercentage = getPercentage(mediaTypes.documents, totalMessages);
  const otherPercentage = getPercentage(mediaTypes.other, totalMessages);
  
  // Processing state percentages
  const completedPercentage = getPercentage(processingStates.completed, totalMessages);
  const errorPercentage = getPercentage(processingStates.error, totalMessages);
  const processingPercentage = getPercentage(processingStates.processing, totalMessages);
  const pendingPercentage = getPercentage(processingStates.pending, totalMessages);

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div>
        <h4 className="text-sm font-medium mb-3 flex items-center">
          <BarChart className="mr-2 h-4 w-4" />
          Overview
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Total Messages</p>
              <p className="text-xl font-bold">{totalMessages.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Media Groups</p>
              <p className="text-xl font-bold">{mediaGroups.total.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Media Type Distribution */}
      <div>
        <h4 className="text-sm font-medium mb-3 flex items-center">
          <PieChart className="mr-2 h-4 w-4" />
          Media Types
        </h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <ImageIcon className="h-4 w-4 mr-2 text-blue-500" />
              <span className="text-sm">Images</span>
            </div>
            <Badge variant="outline">{imagePercentage}%</Badge>
          </div>
          <Progress value={imagePercentage} className="h-2" />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <FileVideo className="h-4 w-4 mr-2 text-red-500" />
              <span className="text-sm">Videos</span>
            </div>
            <Badge variant="outline">{videoPercentage}%</Badge>
          </div>
          <Progress value={videoPercentage} className="h-2 bg-muted" />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <FileVideo className="h-4 w-4 mr-2 text-yellow-500" />
              <span className="text-sm">Other</span>
            </div>
            <Badge variant="outline">{docPercentage + otherPercentage}%</Badge>
          </div>
          <Progress value={docPercentage + otherPercentage} className="h-2 bg-muted" />
        </div>
      </div>

      <Separator />
      
      {/* Processing State */}
      <div>
        <h4 className="text-sm font-medium mb-3 flex items-center">
          <Clock className="mr-2 h-4 w-4" />
          Processing Status
        </h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
              <span className="text-sm">Completed</span>
            </div>
            <Badge variant="outline">{completedPercentage}%</Badge>
          </div>
          <Progress value={completedPercentage} className="h-2 bg-muted" />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <AlertCircle className="h-4 w-4 mr-2 text-red-500" />
              <span className="text-sm">Error</span>
            </div>
            <Badge variant="outline">{errorPercentage}%</Badge>
          </div>
          <Progress value={errorPercentage} className="h-2 bg-muted" />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-2 text-blue-500" />
              <span className="text-sm">Processing</span>
            </div>
            <Badge variant="outline">{processingPercentage + pendingPercentage}%</Badge>
          </div>
          <Progress value={processingPercentage + pendingPercentage} className="h-2 bg-muted" />
        </div>
      </div>

      <Separator />
      
      {/* Vendor Stats */}
      <div>
        <h4 className="text-sm font-medium mb-3 flex items-center">
          <Tag className="mr-2 h-4 w-4" />
          Top Vendors
        </h4>
        {vendorStats.topVendors.length > 0 ? (
          <div className="space-y-2">
            {vendorStats.topVendors.slice(0, 5).map((vendor, index) => (
              <div key={index} className="flex justify-between items-center text-sm">
                <span className="truncate">{vendor.name}</span>
                <Badge variant="outline">{vendor.count}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No vendor data available</p>
        )}
      </div>
      
      {/* Time Period Stats */}
      <div>
        <h4 className="text-sm font-medium mb-3 flex items-center">
          <Users className="mr-2 h-4 w-4" />
          Time Periods
        </h4>
        <div className="grid grid-cols-2 gap-2 text-center">
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Today</p>
              <p className="text-lg font-bold">{timePeriods.today}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">This Week</p>
              <p className="text-lg font-bold">{timePeriods.thisWeek}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
