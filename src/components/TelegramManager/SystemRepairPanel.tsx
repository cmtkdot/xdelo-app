
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useProcessingSystemRepair } from "@/hooks/useProcessingSystemRepair";
import { useMediaGroupRepair } from "@/hooks/useMediaGroupRepair";
import { useSystemRepair } from "@/hooks/useSystemRepair";
import { useMediaRepair } from "@/hooks/useMediaRepair";

export const SystemRepairPanel = () => {
  const [activeTab, setActiveTab] = useState<string>('quick');
  const [repairing, setRepairing] = useState(false);
  const [repairResult, setRepairResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const { repairProcessingFlow, isRepairing: isSystemRepairing } = useProcessingSystemRepair();
  const { repairAllMediaGroups, isRepairing: isMediaGroupRepairing } = useMediaGroupRepair();
  const { resetStuckMessages } = useSystemRepair();
  const { repairAllMedia } = useMediaRepair();
  
  const isAnyRepairing = repairing || isSystemRepairing || isMediaGroupRepairing;

  const handleQuickRepair = async () => {
    setRepairing(true);
    setError(null);
    setRepairResult(null);
    
    try {
      // Run the processing flow repair with default settings
      const result = await repairProcessingFlow();
      setRepairResult(result);
    } catch (err: any) {
      setError(err.message || 'An error occurred during repair');
      console.error('Repair error:', err);
    } finally {
      setRepairing(false);
    }
  };

  const handleResetStuckMessages = async () => {
    setRepairing(true);
    setError(null);
    setRepairResult(null);
    
    try {
      const result = await resetStuckMessages();
      setRepairResult(result);
    } catch (err: any) {
      setError(err.message || 'An error occurred while resetting stuck messages');
      console.error('Reset error:', err);
    } finally {
      setRepairing(false);
    }
  };

  const handleRepairMediaGroups = async () => {
    setRepairing(true);
    setError(null);
    setRepairResult(null);
    
    try {
      const result = await repairAllMediaGroups();
      setRepairResult(result);
    } catch (err: any) {
      setError(err.message || 'An error occurred while repairing media groups');
      console.error('Media group repair error:', err);
    } finally {
      setRepairing(false);
    }
  };

  const handleRepairAllMedia = async () => {
    setRepairing(true);
    setError(null);
    setRepairResult(null);
    
    try {
      const result = await repairAllMedia();
      setRepairResult(result);
    } catch (err: any) {
      setError(err.message || 'An error occurred while repairing media');
      console.error('Media repair error:', err);
    } finally {
      setRepairing(false);
    }
  };

  const handleForceRepair = async () => {
    setRepairing(true);
    setError(null);
    setRepairResult(null);
    
    try {
      // Force repair with all options enabled
      const result = await repairProcessingFlow({ limit: 50, repair_enums: true, reset_all: true, force_reset_stalled: true });
      setRepairResult(result);
    } catch (err: any) {
      setError(err.message || 'An error occurred during forced repair');
      console.error('Force repair error:', err);
    } finally {
      setRepairing(false);
    }
  };

  const renderResult = () => {
    if (!repairResult) return null;
    
    return (
      <div className="mt-4 p-4 border rounded-md bg-secondary/5">
        <h3 className="font-medium mb-2">Repair Results</h3>
        
        {repairResult.message && (
          <Alert variant="default" className="mb-2">
            <AlertDescription>{repairResult.message}</AlertDescription>
          </Alert>
        )}
        
        {repairResult.operations && (
          <div className="mb-2 text-sm">
            <p className="text-muted-foreground">Operations performed:</p>
            <ul className="list-disc pl-5">
              {repairResult.operations.map((op: string, i: number) => (
                <li key={i}>{op}</li>
              ))}
            </ul>
          </div>
        )}
        
        {repairResult.results && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-sm">
            {Object.entries(repairResult.results).map(([key, value]: [string, any]) => {
              if (key === 'diagnostics' && value) {
                return (
                  <div key={key} className="col-span-full">
                    <p className="text-muted-foreground mb-1">Diagnostics:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {value.before && (
                        <div className="p-2 border rounded-md">
                          <p className="text-xs font-medium mb-1">Before:</p>
                          <pre className="text-xs overflow-auto">{JSON.stringify(value.before, null, 2)}</pre>
                        </div>
                      )}
                      {value.after && (
                        <div className="p-2 border rounded-md">
                          <p className="text-xs font-medium mb-1">After:</p>
                          <pre className="text-xs overflow-auto">{JSON.stringify(value.after, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              
              if (typeof value === 'object' && value !== null) {
                return (
                  <div key={key} className="p-2 border rounded-md">
                    <p className="text-xs font-medium">{key.replace(/_/g, ' ')}:</p>
                    <pre className="text-xs overflow-auto">{JSON.stringify(value, null, 2)}</pre>
                  </div>
                );
              }
              
              return (
                <div key={key} className="p-2 border rounded-md">
                  <p className="text-xs font-medium">{key.replace(/_/g, ' ')}:</p>
                  <p>{String(value)}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>System Repair</span>
          {isAnyRepairing && (
            <Badge variant="outline" className="animate-pulse">
              Repairing...
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Tools to diagnose and repair processing issues
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="quick">Quick Repair</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
            <TabsTrigger value="danger">Reset</TabsTrigger>
          </TabsList>
          
          <TabsContent value="quick" className="py-4">
            <div className="space-y-4">
              <p className="text-sm">
                Run a quick system repair to fix common issues with message processing and media groups.
              </p>
              
              <div className="flex flex-col gap-2">
                <Button 
                  onClick={handleQuickRepair} 
                  disabled={isAnyRepairing}
                  className="w-full"
                >
                  Quick Repair System
                </Button>
                
                <Button 
                  onClick={handleRepairMediaGroups} 
                  disabled={isAnyRepairing}
                  variant="outline"
                  className="w-full"
                >
                  Repair Media Groups
                </Button>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="advanced" className="py-4">
            <div className="space-y-4">
              <p className="text-sm">
                Advanced repair options for specific issues.
              </p>
              
              <div className="flex flex-col gap-2">
                <Button 
                  onClick={() => repairProcessingFlow()}
                  disabled={isAnyRepairing}
                  className="w-full"
                >
                  Repair Processing Flow
                </Button>
                
                <Button 
                  onClick={handleRepairAllMedia}
                  disabled={isAnyRepairing}
                  variant="outline"
                  className="w-full"
                >
                  Repair All Media Files
                </Button>
                
                <Separator className="my-2" />
                
                <Button 
                  onClick={handleResetStuckMessages}
                  disabled={isAnyRepairing}
                  variant="outline" 
                  className="w-full"
                >
                  Reset Stuck Messages
                </Button>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="danger" className="py-4">
            <div className="space-y-4">
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>
                  These operations can reset all messages and force reprocessing. Use with caution.
                </AlertDescription>
              </Alert>
              
              <div className="flex flex-col gap-2">
                <Button 
                  onClick={handleForceRepair}
                  disabled={isAnyRepairing}
                  variant="destructive"
                  className="w-full"
                >
                  Force System Reset & Repair
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {renderResult()}
      </CardContent>
      
      <CardFooter className="text-xs text-muted-foreground">
        Use system repair tools only when experiencing issues with processing
      </CardFooter>
    </Card>
  );
};
