
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { 
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useProcessingSystemRepair } from '@/hooks/useProcessingSystemRepair';
import { useMessageProcessingStats } from '@/hooks/useMessageProcessingStats';
import { 
  Loader2, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp, 
  Clock 
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function ProcessingRepairButton() {
  const [showDetail, setShowDetail] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { 
    repairProcessingSystem, 
    isRepairing,
    repairStuckMessages
  } = useProcessingSystemRepair();
  const {
    fetchProcessingStats,
    processingStats,
    isLoading,
    error,
    clearError
  } = useMessageProcessingStats();

  // Auto-check health on first render
  useEffect(() => {
    if (!processingStats) {
      fetchProcessingStats().catch(console.error);
    }
  }, [processingStats, fetchProcessingStats]);

  const handleRefreshStats = async () => {
    try {
      await fetchProcessingStats();
      setShowDetail(true);
    } catch (error) {
      console.error('Error refreshing processing health stats:', error);
    }
  };
  
  const handleRepairStuckMessages = async () => {
    try {
      await repairStuckMessages();
      // Get updated stats after repair
      await fetchProcessingStats();
    } catch (error) {
      console.error('Error repairing stuck messages:', error);
    }
  };
  
  const handleSystemRepair = async () => {
    try {
      await repairProcessingSystem();
      // Get updated stats after repair
      await fetchProcessingStats();
    } catch (error) {
      console.error('Error repairing processing system:', error);
    }
  };
  
  const hasIssues = processingStats?.media_group_stats?.stuck_in_processing > 0 || 
                   processingStats?.media_group_stats?.unprocessed_with_caption > 0;
  
  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return 'Unknown';
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch (e) {
      return timestamp;
    }
  };
  
  return (
    <div className="mb-4">
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {error}
            <Button 
              variant="link" 
              className="p-0 h-auto text-xs ml-2" 
              onClick={() => {
                clearError();
                fetchProcessingStats();
              }}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}
      
      {showDetail && processingStats && (
        <Card className="mb-4 bg-gray-50 dark:bg-gray-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Processing System Health</CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
            <CardDescription className="text-xs">
              Last updated: {formatTimestamp(processingStats.timestamp)}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="pb-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1.5">
                {processingStats.state_counts?.processing > 0 ? (
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
                <span className="text-sm">
                  {processingStats.state_counts?.processing || 0} in processing
                </span>
              </div>
              
              <div className="flex items-center gap-1.5">
                <span className="text-sm">
                  {processingStats.state_counts?.pending || 0} pending
                </span>
              </div>
              
              <div className="flex items-center gap-1.5 col-span-2">
                <span className="text-sm">
                  {processingStats.media_group_stats?.unprocessed_with_caption || 0} unprocessed with captions
                </span>
              </div>
              
              {expanded && (
                <>
                  <div className="col-span-2 mt-2">
                    <div className="text-xs font-medium mb-1">Detailed Statistics</div>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <div>Completed messages:</div>
                      <div>{processingStats.state_counts?.completed || 0}</div>
                      
                      <div>Error state messages:</div>
                      <div>{processingStats.state_counts?.error || 0}</div>
                      
                      <div>Stuck in processing:</div>
                      <div>{processingStats.media_group_stats?.stuck_in_processing || 0}</div>
                      
                      <div>Orphaned media group messages:</div>
                      <div>{processingStats.media_group_stats?.orphaned_media_group_messages || 0}</div>
                      
                      {processingStats.timing_stats?.oldest_unprocessed_caption_age_hours && (
                        <>
                          <div>Oldest unprocessed caption:</div>
                          <div>{Math.round(processingStats.timing_stats?.oldest_unprocessed_caption_age_hours)} hours</div>
                        </>
                      )}
                      
                      {processingStats.timing_stats?.oldest_stuck_processing_hours && (
                        <>
                          <div>Oldest stuck in processing:</div>
                          <div>{Math.round(processingStats.timing_stats?.oldest_stuck_processing_hours)} hours</div>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {hasIssues && (
                    <div className="col-span-2 mt-2">
                      <div className="text-xs text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-3 w-3 inline-block mr-1" />
                        System has processing issues that need repair.
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
          
          {hasIssues && (
            <CardFooter className="pt-0">
              <div className="flex flex-wrap gap-2">
                {processingStats.state_counts?.processing > 0 && (
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={handleRepairStuckMessages}
                    disabled={isRepairing || isLoading}
                    className="text-xs"
                  >
                    {isRepairing ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3 mr-1" />
                    )}
                    Reset stuck messages
                  </Button>
                )}
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleSystemRepair}
                  disabled={isRepairing || isLoading}
                  className="text-xs"
                >
                  {isRepairing ? (
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3 mr-1" />
                  )}
                  Deep system repair
                </Button>
              </div>
            </CardFooter>
          )}
        </Card>
      )}
      
      <Button 
        variant={hasIssues ? "secondary" : "outline"}
        size="sm"
        onClick={handleRefreshStats}
        disabled={isLoading}
        className="text-xs flex items-center gap-1"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Checking system health...</span>
          </>
        ) : (
          <>
            {hasIssues ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            <span>{showDetail ? "Refresh health status" : "Check processing health"}</span>
          </>
        )}
      </Button>
    </div>
  );
}
