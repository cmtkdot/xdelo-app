
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { useSystemRepair } from "@/hooks/useSystemRepair";

export function SystemRepairPanel() {
  const [activeTab, setActiveTab] = useState("quick");
  const [repairResults, setRepairResults] = useState<any>(null);
  const {
    repairFullSystem,
    performQuickMaintenance,
    repairMediaGroups,
    repairStuckMessages,
    validateStorageFiles,
    isRepairing
  } = useSystemRepair();

  const handleQuickMaintenance = async () => {
    try {
      const results = await performQuickMaintenance();
      setRepairResults(results);
    } catch (error) {
      console.error("Quick maintenance failed:", error);
    }
  };

  const handleFullSystemRepair = async () => {
    try {
      const results = await repairFullSystem();
      setRepairResults(results);
    } catch (error) {
      console.error("Full system repair failed:", error);
    }
  };

  const handleRepairMediaGroups = async () => {
    try {
      const results = await repairMediaGroups();
      setRepairResults(results);
    } catch (error) {
      console.error("Media group repair failed:", error);
    }
  };

  const handleRepairStuckMessages = async () => {
    try {
      const results = await repairStuckMessages();
      setRepairResults(results);
    } catch (error) {
      console.error("Message repair failed:", error);
    }
  };

  const handleValidateStorage = async () => {
    try {
      const results = await validateStorageFiles(50, true);
      setRepairResults(results);
    } catch (error) {
      console.error("Storage validation failed:", error);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>System Maintenance</CardTitle>
        <CardDescription>
          Repair and maintain the Telegram message processing system
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="quick" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="quick">Quick Fixes</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
          </TabsList>
          
          <TabsContent value="quick" className="space-y-4 pt-4">
            <Alert>
              <AlertDescription>
                Quick fixes address common issues without disrupting the system.
              </AlertDescription>
            </Alert>
            
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Button 
                onClick={handleQuickMaintenance} 
                disabled={isRepairing}
                className="w-full"
              >
                {isRepairing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Quick Maintenance
              </Button>
              
              <Button 
                onClick={handleRepairStuckMessages} 
                disabled={isRepairing}
                variant="outline"
                className="w-full"
              >
                {isRepairing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Fix Stuck Messages
              </Button>
              
              <Button 
                onClick={handleRepairMediaGroups} 
                disabled={isRepairing}
                variant="outline"
                className="w-full"
              >
                {isRepairing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Fix Media Groups
              </Button>
              
              <Button 
                onClick={handleValidateStorage} 
                disabled={isRepairing}
                variant="outline"
                className="w-full"
              >
                {isRepairing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Validate Storage
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="advanced" className="space-y-4 pt-4">
            <Alert>
              <AlertDescription>
                Advanced repairs perform deep system maintenance. Use these options if quick fixes don't resolve issues.
              </AlertDescription>
            </Alert>
            
            <div className="grid grid-cols-1 gap-4 mt-4">
              <Button 
                onClick={handleFullSystemRepair} 
                disabled={isRepairing}
                className="w-full"
                variant="destructive"
              >
                {isRepairing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Full System Repair
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="results" className="pt-4">
            {repairResults ? (
              <pre className="bg-muted p-4 rounded-md overflow-auto max-h-64 text-xs">
                {JSON.stringify(repairResults, null, 2)}
              </pre>
            ) : (
              <div className="text-center text-muted-foreground p-4">
                No repair results to display
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex justify-between">
        <div className="text-sm text-muted-foreground">
          {isRepairing ? 'System repair in progress...' : 'Ready'}
        </div>
      </CardFooter>
    </Card>
  );
}
