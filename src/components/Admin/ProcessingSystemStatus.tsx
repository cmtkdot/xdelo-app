
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { useProcessingSystem } from "@/hooks/useProcessingSystem";
import { useEffect } from "react";

export function ProcessingSystemStatus() {
  const { 
    systemStatus, 
    isLoading, 
    isRepairing, 
    getProcessingStats, 
    repairProcessingSystem, 
    repairStuckMessages 
  } = useProcessingSystem();

  useEffect(() => {
    getProcessingStats();
    const interval = setInterval(() => {
      getProcessingStats();
    }, 30000); // refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, [getProcessingStats]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Processing System Status</span>
          {isLoading && <Spinner size="sm" />}
        </CardTitle>
        <CardDescription>
          Overview of message processing system health
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {!systemStatus && !isLoading ? (
          <div className="text-center p-4 text-muted-foreground">
            No status information available
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatusMetric 
                label="Pending" 
                value={systemStatus?.pending_messages || 0} 
                variant={systemStatus?.pending_messages > 50 ? "warning" : "default"}
              />
              <StatusMetric 
                label="Processing" 
                value={systemStatus?.processing_messages || 0} 
                variant={systemStatus?.processing_messages > 10 ? "warning" : "default"}
              />
              <StatusMetric 
                label="Error" 
                value={systemStatus?.error_messages || 0} 
                variant={systemStatus?.error_messages > 0 ? "destructive" : "default"}
              />
              <StatusMetric 
                label="Stalled" 
                value={systemStatus?.stalled_messages || 0} 
                variant={systemStatus?.stalled_messages > 0 ? "destructive" : "default"}
              />
            </div>
            
            <Separator />
            
            {systemStatus?.recent_errors && systemStatus.recent_errors.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2">Recent Errors</h3>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {systemStatus.recent_errors.map((error, i) => (
                    <div key={i} className="text-sm p-2 bg-muted rounded-md">
                      <div className="font-medium">{error.component}</div>
                      <div className="text-destructive">{error.message}</div>
                      <div className="text-xs text-muted-foreground">{new Date(error.timestamp).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={getProcessingStats}
          disabled={isLoading}
        >
          Refresh
        </Button>
        
        <div className="space-x-2">
          <Button 
            variant="outline" 
            onClick={repairStuckMessages}
            disabled={isLoading || isRepairing}
          >
            Process Pending
          </Button>
          
          <Button 
            variant="secondary" 
            onClick={repairProcessingSystem}
            disabled={isLoading || isRepairing}
          >
            {isRepairing ? <Spinner size="sm" className="mr-2" /> : null}
            Repair System
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

interface StatusMetricProps {
  label: string;
  value: number;
  variant?: "default" | "warning" | "destructive";
}

function StatusMetric({ label, value, variant = "default" }: StatusMetricProps) {
  const getVariantClass = () => {
    switch (variant) {
      case "warning":
        return "text-amber-600";
      case "destructive":
        return "text-destructive";
      default:
        return "";
    }
  };

  return (
    <div className="p-3 bg-muted/50 rounded-md">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${getVariantClass()}`}>{value}</div>
    </div>
  );
}
