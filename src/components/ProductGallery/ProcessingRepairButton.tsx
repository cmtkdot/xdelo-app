
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { useProcessingSystemRepair } from '@/hooks/useProcessingSystemRepair';
import { Loader2, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';

export function ProcessingRepairButton() {
  const [showDetail, setShowDetail] = useState(false);
  const { 
    repairProcessingSystem, 
    getProcessingStats, 
    isRepairing,
    repairStuckMessages
  } = useProcessingSystemRepair();
  const [stats, setStats] = useState<any>(null);

  const handleCheckAndRepair = async () => {
    try {
      // First check for stuck messages
      const currentStats = await getProcessingStats();
      setStats(currentStats);
      setShowDetail(true);
      
      // If there are stuck messages, offer to repair
      if (currentStats.stuck_count > 0) {
        await repairProcessingSystem();
        // Get updated stats
        const updatedStats = await getProcessingStats();
        setStats(updatedStats);
      }
    } catch (error) {
      console.error('Error checking processing system:', error);
    }
  };
  
  const handleRepairStuckMessages = async () => {
    try {
      await repairStuckMessages();
      // Get updated stats after repair
      const updatedStats = await getProcessingStats();
      setStats(updatedStats);
    } catch (error) {
      console.error('Error repairing stuck messages:', error);
    }
  };
  
  return (
    <div className="mb-4">
      {showDetail && stats && (
        <div className="mb-2 p-3 bg-gray-50 dark:bg-gray-800 rounded text-sm shadow-sm">
          <div className="flex flex-col space-y-2">
            <div className="flex justify-between items-center">
              <h4 className="font-medium text-sm">Processing System Status</h4>
              <Button 
                variant="ghost" 
                className="p-0 h-auto text-xs"
                onClick={() => setShowDetail(false)}
              >
                Hide
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1.5">
                {stats.stuck_count > 0 ? (
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
                <span className="text-sm">
                  {stats.stuck_count > 0 ? `${stats.stuck_count} stuck messages` : 'No stuck messages'}
                </span>
              </div>
              
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {stats.pending_count || 0} pending
                </span>
              </div>
              
              <div className="flex items-center gap-1.5 col-span-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {stats.unprocessed_count || 0} unprocessed with captions
                </span>
              </div>
            </div>
            
            {stats.stuck_count > 0 && (
              <div className="text-xs text-gray-500 mt-1 italic">
                Stuck messages have been in 'processing' state for too long and need to be reset.
              </div>
            )}
            
            {(stats.stuck_count > 0 || stats.unprocessed_count > 0) && (
              <div className="flex gap-2 mt-2">
                {stats.stuck_count > 0 && (
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={handleRepairStuckMessages}
                    disabled={isRepairing}
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
              </div>
            )}
          </div>
        </div>
      )}
      
      <Button 
        variant={stats?.stuck_count > 0 ? "secondary" : "outline"}
        size="sm"
        onClick={handleCheckAndRepair}
        disabled={isRepairing}
        className="text-xs flex items-center gap-1"
      >
        {isRepairing ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Fixing stuck messages...</span>
          </>
        ) : (
          <>
            {stats?.stuck_count > 0 ? <AlertTriangle className="h-3 w-3" /> : null}
            <span>Check processing status</span>
          </>
        )}
      </Button>
    </div>
  );
}
