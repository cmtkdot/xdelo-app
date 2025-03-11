
import { useState } from 'react';
import { useProcessingHealth } from './useProcessingHealth';
import { useToast } from './useToast';
import { useProcessingSystemRepair } from './useProcessingSystemRepair';
import { useMediaGroupRepair } from './useMediaGroupRepair';
import { useStuckMessageRepair } from './useStuckMessageRepair';

export interface SystemHealthReport {
  processing: {
    state_counts: {
      initialized: number;
      pending: number;
      processing: number;
      completed: number;
      error: number;
      total_messages: number;
    };
    media_group_stats: {
      unprocessed_with_caption: number;
      stuck_in_processing: number;
      stalled_no_media_group: number;
      orphaned_media_group_messages: number;
    };
    timing_stats: {
      avg_processing_time_seconds: number | null;
      oldest_unprocessed_caption_age_hours: number | null;
      oldest_stuck_processing_hours: number | null;
    };
  };
  repairs: {
    stuckMessages: number;
    mediaGroups: number;
    processingSystem: number;
  };
  timestamp: string;
}

export function useSystemHealthMonitor() {
  const [isLoading, setIsLoading] = useState(false);
  const [healthReport, setHealthReport] = useState<SystemHealthReport | null>(null);
  const { toast } = useToast();
  
  // Import all repair hooks
  const { diagnoseProcessingHealth, processingStats } = useProcessingHealth();
  const { repairStuckMessages } = useStuckMessageRepair();
  const { repairMediaGroups } = useMediaGroupRepair();
  const { repairProcessingSystem } = useProcessingSystemRepair();

  const runSystemDiagnostics = async () => {
    try {
      setIsLoading(true);
      
      // Get processing health report
      const processingReport = await diagnoseProcessingHealth();
      
      // Generate a comprehensive health report
      const systemReport: SystemHealthReport = {
        processing: {
          state_counts: processingReport.state_counts,
          media_group_stats: processingReport.media_group_stats,
          timing_stats: processingReport.timing_stats,
        },
        repairs: {
          stuckMessages: 0,
          mediaGroups: 0,
          processingSystem: 0,
        },
        timestamp: new Date().toISOString()
      };
      
      setHealthReport(systemReport);
      
      toast({
        title: "System Diagnostics Complete",
        description: "Health report has been generated",
        variant: "default"
      });
      
      return systemReport;
    } catch (error: any) {
      console.error('Error running system diagnostics:', error);
      
      toast({
        title: "Diagnostics Failed",
        description: error.message || "Failed to run system diagnostics",
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const repairSystem = async () => {
    try {
      setIsLoading(true);
      
      // Run the different repair operations
      const stuckResults = await repairStuckMessages();
      const mediaGroupResults = await repairMediaGroups();
      const processingResults = await repairProcessingSystem();
      
      // Update the health report with repair counts
      const updatedReport = healthReport ? {
        ...healthReport,
        repairs: {
          stuckMessages: stuckResults.repaired_count || 0,
          mediaGroups: mediaGroupResults.repaired_count || 0,
          processingSystem: processingResults.repaired_count || 0,
        },
        timestamp: new Date().toISOString()
      } : null;
      
      setHealthReport(updatedReport);
      
      toast({
        title: "System Repair Complete",
        description: `Fixed ${stuckResults.repaired_count} stuck messages, ${mediaGroupResults.repaired_count} media groups, and ${processingResults.repaired_count} processing issues`,
        variant: "default"
      });
      
      return updatedReport;
    } catch (error: any) {
      console.error('Error repairing system:', error);
      
      toast({
        title: "Repair Failed",
        description: error.message || "Failed to repair system",
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    runSystemDiagnostics,
    repairSystem,
    healthReport,
    isLoading
  };
}
