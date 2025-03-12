
import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useProcessingStats } from '@/hooks/useProcessingStats';
import useProcessingSystemRepair from '@/hooks/useProcessingSystemRepair';
import { Loader2 } from 'lucide-react';
import useMediaGroupRepair from '@/hooks/useMediaGroupRepair';
import useMediaManagement from '@/hooks/useMediaManagement';
import useMediaRepair from '@/hooks/useMediaRepair';

const SystemRepairPanel = () => {
  const { stats, isLoading: isLoadingStats } = useProcessingStats();
  const { isRepairing, repairProcessingSystem, resetStalledProcessing } = useProcessingSystemRepair();
  const { repairAllMediaGroups, isRepairing: isRepairingMediaGroups } = useMediaGroupRepair();
  const { validateFilesAndRepair, isValidating } = useMediaManagement();
  const { repairStuckMessages, isRepairing: isRepairingStuck } = useMediaRepair();
 
  // Handle full system repair (combined operations)
  const handleFullSystemRepair = async () => {
    try {
      await repairProcessingSystem({ reset_all: true });
      await repairAllMediaGroups();
      await repairStuckMessages();
      await validateFilesAndRepair();
    } catch (error) {
      console.error("Full system repair failed:", error);
    }
  };

  // Handle quick maintenance (just stalled processing)
  const handleQuickMaintenance = async () => {
    try {
      await resetStalledProcessing();
    } catch (error) {
      console.error("Quick maintenance failed:", error);
    }
  };

  const isAnyOperationInProgress = isRepairing || isRepairingMediaGroups || isValidating || isRepairingStuck;

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Repair</CardTitle>
        <CardDescription>
          Repair and maintain the message processing system
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Section */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <div className="bg-muted p-2 rounded-md text-center">
            <div className="text-2xl font-bold">{isLoadingStats ? '...' : stats.pending}</div>
            <div className="text-xs">Pending</div>
          </div>
          <div className="bg-muted p-2 rounded-md text-center">
            <div className="text-2xl font-bold">{isLoadingStats ? '...' : stats.processing}</div>
            <div className="text-xs">Processing</div>
          </div>
          <div className="bg-muted p-2 rounded-md text-center">
            <div className="text-2xl font-bold">{isLoadingStats ? '...' : stats.completed}</div>
            <div className="text-xs">Completed</div>
          </div>
          <div className="bg-muted p-2 rounded-md text-center">
            <div className="text-2xl font-bold">{isLoadingStats ? '...' : stats.error}</div>
            <div className="text-xs">Errors</div>
          </div>
          <div className="bg-muted p-2 rounded-md text-center">
            <div className="text-2xl font-bold">{isLoadingStats ? '...' : stats.stalled_processing}</div>
            <div className="text-xs">Stalled</div>
          </div>
        </div>

        {/* Stalled Messages Alert */}
        {(stats.stalled_processing > 0 || stats.stalled_pending > 0) && (
          <Alert variant="warning" className="bg-orange-50 border-orange-300">
            <AlertTitle>Stalled Messages Detected</AlertTitle>
            <AlertDescription>
              {stats.stalled_processing > 0 && (
                <div>{stats.stalled_processing} messages stuck in "processing" state.</div>
              )}
              {stats.stalled_pending > 0 && (
                <div>{stats.stalled_pending} messages stuck in "pending" state.</div>
              )}
              <Button 
                onClick={handleQuickMaintenance} 
                size="sm" 
                className="mt-2"
                variant="outline"
                disabled={isAnyOperationInProgress}
              >
                {isRepairing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  "Quick Fix"
                )}
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter className="flex flex-col space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
          <Button 
            onClick={handleFullSystemRepair} 
            disabled={isAnyOperationInProgress}
          >
            {isAnyOperationInProgress ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              "Full System Repair"
            )}
          </Button>
          <Button
            onClick={() => repairProcessingSystem()}
            variant="outline"
            disabled={isAnyOperationInProgress}
          >
            {isRepairing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Repairing...
              </>
            ) : (
              "Repair Processing Only"
            )}
          </Button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
          <Button
            onClick={repairAllMediaGroups}
            variant="outline"
            disabled={isAnyOperationInProgress}
          >
            {isRepairingMediaGroups ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Fixing Media Groups...
              </>
            ) : (
              "Repair Media Groups"
            )}
          </Button>
          
          <Button
            onClick={validateFilesAndRepair}
            variant="outline"
            disabled={isAnyOperationInProgress}
          >
            {isValidating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Validating...
              </>
            ) : (
              "Validate Storage Files"
            )}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default SystemRepairPanel;
