
import React from 'react';
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Database } from "lucide-react";
import { useMediaUrlStandardization } from '@/hooks/useMediaUrlStandardization';

export function MigrationButton() {
  const { standardizeUrls, isStandardizing, results } = useMediaUrlStandardization();

  const handleRunMigration = async () => {
    await standardizeUrls(500);
  };

  return (
    <div className="p-4 space-y-4 border rounded-md bg-gray-50 dark:bg-gray-900">
      <div className="flex flex-col space-y-2">
        <h3 className="text-lg font-semibold">Run URL Migration</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          This will update storage paths and public URLs for media files using standardized formats.
          It ensures consistent path generation across the application.
        </p>
      </div>
      
      <Button
        onClick={handleRunMigration}
        disabled={isStandardizing}
        className="w-full flex items-center justify-center gap-2"
        variant="default"
      >
        {isStandardizing ? (
          <>
            <Spinner className="h-4 w-4" />
            Running Migration...
          </>
        ) : (
          <>
            <Database className="h-4 w-4" />
            Run Storage Path Standardization
          </>
        )}
      </Button>
      
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
