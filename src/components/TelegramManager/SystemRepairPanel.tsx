
import { useFileRepair } from '@/hooks/useFileRepair';
import { useProcessingRepair } from '@/hooks/useProcessingRepair';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useSystemRepair } from '@/hooks/useSystemRepair';
import { useState } from 'react';
import { useToast } from '@/hooks/useToast';

export function SystemRepairPanel() {
  const { repairFiles, isRepairing, results } = useFileRepair();
  const { isRepairing: isProcessingRepair, repairProcessingFlow } = useProcessingRepair();
  const { fixAllStorageIssues, fixStoragePaths, fixFileReferences, isFixing } = useSystemRepair();
  const [isFixingAll, setIsFixingAll] = useState(false);
  const { toast } = useToast();

  const handleFixAll = async () => {
    setIsFixingAll(true);
    try {
      toast({
        title: "System repair started",
        description: "All repair operations are now running...",
      });
      await repairFiles('all');
      await repairProcessingFlow();
      toast({
        title: "System repair completed",
        description: "All repair operations have finished."
      });
    } catch (error) {
      toast({
        title: "System repair failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsFixingAll(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          System Repair
        </CardTitle>
        <CardDescription>Fix system issues and repair corrupted data</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border rounded-md">
            <h3 className="font-medium mb-2">Storage Path Standardization</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Fix non-standard storage paths and update database records.
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => repairFiles('all')}
              disabled={isRepairing || isFixingAll}
            >
              {isRepairing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
              {isRepairing ? 'Fixing...' : 'Repair Storage Paths'}
            </Button>
          </div>
          
          <div className="p-4 border rounded-md">
            <h3 className="font-medium mb-2">Processing Flow Repair</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Fix stuck processing states and reset failed processing jobs.
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={repairProcessingFlow}
              disabled={isProcessingRepair || isFixingAll}
            >
              {isProcessingRepair ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
              {isProcessingRepair ? 'Repairing...' : 'Repair Processing Flow'}
            </Button>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          className="w-full" 
          variant="default"
          onClick={handleFixAll}
          disabled={isFixingAll || isRepairing || isProcessingRepair || isFixing}
        >
          {isFixingAll ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
          {isFixingAll ? 'Running System Repair...' : 'Run All Repair Operations'}
        </Button>
      </CardFooter>
    </Card>
  );
}
