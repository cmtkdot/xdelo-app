
import React from 'react';
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Database, Files, Waypoints } from "lucide-react";
import { useMediaUrlStandardization } from '@/hooks/useMediaUrlStandardization';
import { useToast } from '@/hooks/useToast';

export function MigrationButton() {
  const { standardizeUrls, isStandardizing, results } = useMediaUrlStandardization();
  const { toast } = useToast();

  const handleRunMigration = async () => {
    await standardizeUrls(500);
  };

  const handleRunExtensiveRepair = async () => {
    try {
      toast({
        title: 'Starting extensive repair...',
        description: 'Fixing file extensions and storage paths...'
      });

      const response = await fetch('/api/admin/standardize-storage-paths', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 200, dryRun: false })
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }

      const data = await response.json();
      
      toast({
        title: 'Storage path standardization complete',
        description: `Processed ${data.stats.processed}, fixed ${data.stats.fixed} files`
      });
    } catch (error) {
      toast({
        title: 'Storage repair failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="p-4 space-y-4 border rounded-md bg-gray-50 dark:bg-gray-900">
      <div className="flex flex-col space-y-2">
        <h3 className="text-lg font-semibold">Database Migrations</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          These operations standardize storage paths and URLs for media files,
          ensuring consistent file extension handling across the application.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Button
          onClick={handleRunMigration}
          disabled={isStandardizing}
          className="flex items-center justify-center gap-2"
          variant="default"
        >
          {isStandardizing ? (
            <>
              <Spinner className="h-4 w-4" />
              Fixing URLs...
            </>
          ) : (
            <>
              <Database className="h-4 w-4" />
              Fix Public URLs
            </>
          )}
        </Button>
        
        <Button
          onClick={handleRunExtensiveRepair}
          disabled={isStandardizing}
          className="flex items-center justify-center gap-2"
          variant="outline"
        >
          <Files className="h-4 w-4" />
          Fix Storage Paths
        </Button>
      </div>
      
      {results && (
        <div className="mt-2 p-3 text-sm border rounded bg-gray-100 dark:bg-gray-800">
          <div className="font-medium mb-1">
            {results.success ? (
              <span className="text-green-600 dark:text-green-400">Migration Successful</span>
            ) : (
              <span className="text-red-600 dark:text-red-400">Migration Failed</span>
            )}
          </div>
          <div className="text-xs">
            {results.success 
              ? `Updated ${results.updatedCount || 0} message storage paths and URLs` 
              : `Error: ${results.error}`
            }
          </div>
        </div>
      )}
    </div>
  );
}
