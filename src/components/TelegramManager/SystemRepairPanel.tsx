
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RotateCw, Database, AlertTriangle, Wrench } from 'lucide-react';
import { useSystemRepair } from '@/hooks/useSystemRepair';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function SystemRepairPanel() {
  const { repairSystem, isRepairing: isSystemRepairing } = useSystemRepair();
  const [isMediaRepairing, setIsMediaRepairing] = useState(false);
  const [repairResults, setRepairResults] = useState<any>(null);

  const handleRepairSystem = async () => {
    const results = await repairSystem();
    setRepairResults(results);
  };

  const handleRepairFiles = async () => {
    try {
      setIsMediaRepairing(true);
      const { data, error } = await supabase.functions.invoke("repair-media-batch", {
        body: { messageIds: [] }
      });
      
      if (error) throw error;
      
      setRepairResults(data);
      toast.success("File repair operation completed");
    } catch (error: any) {
      toast.error(`Error repairing files: ${error.message}`);
      setRepairResults({ success: false, error: error.message });
    } finally {
      setIsMediaRepairing(false);
    }
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
        <div>
          <h3 className="text-sm font-medium mb-2">Database Maintenance</h3>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleRepairSystem}
              disabled={isSystemRepairing}
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
          <h3 className="text-sm font-medium mb-2">Advanced Repairs</h3>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => alert("This feature is not implemented yet")}
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              Clean Orphaned Records
            </Button>
          </div>
        </div>
      </CardContent>
      {repairResults && (
        <CardFooter className="border-t p-4 bg-muted/20">
          <div className="text-sm">
            <p className="font-medium">Repair Results:</p>
            <pre className="mt-2 text-xs overflow-auto max-h-40 p-2 bg-muted rounded">
              {JSON.stringify(repairResults, null, 2)}
            </pre>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
