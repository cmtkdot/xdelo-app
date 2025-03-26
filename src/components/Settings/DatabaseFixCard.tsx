
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/useToast";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, DatabaseZap, Clock } from "lucide-react";
import { QueryOptimizerCard } from "./QueryOptimizerCard"; // Import the new component

export const DatabaseFixCard = () => {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [isFixingUuids, setIsFixingUuids] = useState(false);
  const [isOptimizingStorage, setIsOptimizingStorage] = useState(false);

  const handleRunMigrations = async () => {
    try {
      setIsRunning(true);
      
      const { data, error } = await supabase.functions.invoke('xdelo_run_migrations');
      
      if (error) throw error;
      
      if (data.success) {
        toast({
          title: "Migrations completed",
          description: "Database migrations were successfully applied.",
        });
      } else {
        const failedMigrations = data.results.filter(r => !r.success);
        throw new Error(`${failedMigrations.length} migrations failed. Check the console for details.`);
      }
    } catch (error: any) {
      console.error('Error running migrations:', error);
      
      toast({
        title: "Error",
        description: error.message || "Failed to run database migrations",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleFixUuidLogging = async () => {
    try {
      setIsFixingUuids(true);
      
      const { data, error } = await supabase.rpc("xdelo_fix_audit_log_uuids");
      
      if (error) throw error;
      
      toast({
        title: "UUID Logging Fixed",
        description: `Successfully repaired ${data?.fixed_count || 0} audit log entries.`,
      });
    } catch (error: any) {
      console.error('Error fixing UUID logging:', error);
      
      toast({
        title: "Error",
        description: error.message || "Failed to fix UUID logging issues",
        variant: "destructive",
      });
    } finally {
      setIsFixingUuids(false);
    }
  };
  
  const handleOptimizeMessageStorage = async () => {
    try {
      setIsOptimizingStorage(true);
      
      // Call the storage optimization function
      const { data, error } = await supabase.rpc("migrate_telegram_data_to_metadata");
      
      if (error) throw error;
      
      toast({
        title: "Storage Optimization Complete",
        description: `Successfully optimized ${data?.migrated_count || 0} message records.`,
      });
    } catch (error: any) {
      console.error('Error optimizing message storage:', error);
      
      toast({
        title: "Error",
        description: error.message || "Failed to optimize message storage",
        variant: "destructive",
      });
    } finally {
      setIsOptimizingStorage(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Database Maintenance</h3>
            <p className="text-sm text-gray-500">
              Run database fixes and migrations to ensure schema compatibility
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleFixUuidLogging}
              disabled={isFixingUuids || isRunning || isOptimizingStorage}
            >
              {isFixingUuids ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Fixing UUIDs...
                </>
              ) : (
                <>
                  <DatabaseZap className="mr-2 h-4 w-4" />
                  Fix UUID Logging
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={handleRunMigrations}
              disabled={isRunning || isFixingUuids || isOptimizingStorage}
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                "Run Migrations"
              )}
            </Button>
          </div>
        </div>
        
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Storage Optimization</h4>
              <p className="text-sm text-gray-500">
                Optimize message storage to reduce database size and improve performance
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={handleOptimizeMessageStorage}
              disabled={isOptimizingStorage || isRunning || isFixingUuids}
            >
              {isOptimizingStorage ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Optimizing...
                </>
              ) : (
                <>
                  <Clock className="mr-2 h-4 w-4" />
                  Optimize Message Storage
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
      
      {/* Add the query optimizer card */}
      <QueryOptimizerCard />
    </div>
  );
};
