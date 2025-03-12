
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useSystemRepair } from "@/hooks/useSystemRepair";
import { useFileRepair } from "@/hooks/useFileRepair";
import { useProcessingRepair } from "@/hooks/useProcessingRepair";

export default function SystemRepairPanel() {
  const { isRepairing, repairProcessingSystem, resetStalledProcessing } = useSystemRepair();
  const { isRepairing: isRepairingFiles, repairFileReferences } = useFileRepair();
  const { runRepairOperation } = useProcessingRepair(); 

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>System Repair</CardTitle>
        <CardDescription>
          Repair processing issues and file storage problems
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Processing Flow Repair</h3>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="secondary" 
              size="sm"
              onClick={() => repairProcessingSystem()}
              disabled={isRepairing}
            >
              {isRepairing ? "Repairing..." : "Repair Processing System"}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => resetStalledProcessing()}
              disabled={isRepairing}
            >
              Reset Stalled Processing
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium">Storage Issues Repair</h3>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="secondary" 
              size="sm"
              onClick={() => repairFileReferences()}
              disabled={isRepairingFiles}
            >
              {isRepairingFiles ? "Repairing..." : "Repair File References"}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => runRepairOperation(
                'fix-content-disposition',
                async () => {
                  const { data } = await fetch('/api/media-management', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'fix_content_disposition' })
                  }).then(r => r.json());
                  return data;
                },
                'Content disposition fixed'
              )}
            >
              Fix Content Disposition
            </Button>
          </div>
        </div>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        Use these tools with caution. They may take some time to complete.
      </CardFooter>
    </Card>
  );
}
