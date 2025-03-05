
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { useProcessingSystemRepair } from '@/hooks/useProcessingSystemRepair';

export function ProcessingRepairButton() {
  const [showDetail, setShowDetail] = useState(false);
  const { repairProcessingSystem, getProcessingStats, isRepairing } = useProcessingSystemRepair();
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
  
  return (
    <div className="mb-4">
      {showDetail && stats && (
        <div className="mb-2 p-3 bg-gray-50 rounded text-sm">
          <div className="flex justify-between items-center">
            <div>
              <span className="font-medium">Processing Status:</span>
              <span className={`ml-2 ${stats.stuck_count > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                {stats.stuck_count > 0 ? `${stats.stuck_count} stuck messages` : 'System healthy'}
              </span>
              {stats.pending_count > 0 && (
                <span className="ml-2 text-blue-600">
                  {stats.pending_count} pending
                </span>
              )}
            </div>
            <Button 
              variant="link" 
              className="p-0 h-auto text-xs"
              onClick={() => setShowDetail(false)}
            >
              Hide
            </Button>
          </div>
        </div>
      )}
      
      <Button 
        variant="outline" 
        size="sm"
        onClick={handleCheckAndRepair}
        disabled={isRepairing}
        className="text-xs"
      >
        {isRepairing ? (
          <>
            <span className="animate-spin mr-1">⟳</span>
            Fixing stuck messages...
          </>
        ) : (
          "Check for stuck messages"
        )}
      </Button>
    </div>
  );
}
