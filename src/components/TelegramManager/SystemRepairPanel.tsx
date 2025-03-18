
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RotateCw, Database, AlertTriangle, Wrench, Trash, FileText } from 'lucide-react';
import { useSystemRepair } from '@/hooks/useSystemRepair';
import { useMediaUtils } from '@/hooks/useMediaUtils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function SystemRepairPanel() {
  const { 
    repairSystem, 
    isRepairing, 
    results, 
    repairProcessingSystem, 
    resetStalledProcessing,
    cleanupLegacyFunctions,
    analyzeDatabaseFunctions
  } = useSystemRepair();
  
  const { repairMediaBatch, isProcessing: isMediaRepairing } = useMediaUtils();
  const [activeTab, setActiveTab] = useState("general");

  const handleRepairSystem = async () => {
    await repairSystem();
  };

  const handleRepairFiles = async () => {
    await repairMediaBatch([]);
  };

  const handleCleanupLegacyFunctions = async () => {
    await cleanupLegacyFunctions();
  };

  const handleAnalyzeDatabaseFunctions = async () => {
    await analyzeDatabaseFunctions();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          System Repair Tools
        </CardTitle>
        <CardDescription>
          Tools to repair and maintain system functionality
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="general">General Repair</TabsTrigger>
            <TabsTrigger value="advanced">Advanced Tools</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="space-y-4 pt-2">
            <div>
              <h3 className="text-sm font-medium mb-2">Database Maintenance</h3>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleRepairSystem}
                  disabled={isRepairing}
                >
                  <Database className="mr-2 h-4 w-4" />
                  Repair Processing Flow
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={isMediaRepairing}
                  onClick={handleRepairFiles}
                >
                  <RotateCw className="mr-2 h-4 w-4" />
                  Repair File References
                </Button>
              </div>
            </div>
            
            <Separator />
            
            <div>
              <h3 className="text-sm font-medium mb-2">Processing Maintenance</h3>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={resetStalledProcessing}
                  disabled={isRepairing}
                >
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Reset Stalled Processing
                </Button>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="advanced" className="space-y-4 pt-2">
            <div>
              <h3 className="text-sm font-medium mb-2">System Cleanup</h3>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleCleanupLegacyFunctions}
                  disabled={isRepairing}
                >
                  <Trash className="mr-2 h-4 w-4" />
                  Remove Legacy Functions
                </Button>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleAnalyzeDatabaseFunctions}
                  disabled={isRepairing}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Analyze DB Functions
                </Button>
              </div>
            </div>
            
            <Separator />
            
            <div>
              <h3 className="text-sm font-medium mb-2 text-amber-500">Danger Zone</h3>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => {
                    if (confirm("This is a potentially destructive operation. Are you sure?")) {
                      repairProcessingSystem();
                    }
                  }}
                  disabled={isRepairing}
                >
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Force Reset All Processing
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      {results && (
        <CardFooter className="border-t p-4 bg-muted/20">
          <div className="text-sm">
            <p className="font-medium">Repair Results:</p>
            <pre className="mt-2 text-xs overflow-auto max-h-40 p-2 bg-muted rounded">
              {JSON.stringify(results, null, 2)}
            </pre>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
