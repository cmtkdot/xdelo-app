
import React from 'react';
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Database } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useMediaUtils } from '@/hooks/useMediaUtils';

export function FixMediaUrlsCard() {
  const { standardizeStoragePaths, isProcessing } = useMediaUtils();
  const [results, setResults] = React.useState<{
    success: boolean;
    repaired?: number;
    error?: string;
  } | null>(null);

  const handleRunRepair = async () => {
    try {
      const result = await standardizeStoragePaths();
      setResults({
        success: result.success,
        repaired: result.successful,
        error: result.error
      });
    } catch (error) {
      setResults({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">Fix Media URLs</CardTitle>
        <CardDescription>
          Repair media files with incorrect or missing public URLs
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          This will repair the public URLs for media files in the database, fixing files that have missing or incorrect URLs.
        </p>
        
        {results && (
          <div className="mt-2 p-3 text-sm border rounded bg-gray-100 dark:bg-gray-800">
            <div className="font-medium mb-1">
              {results.success ? (
                <span className="text-green-600 dark:text-green-400">Repair Successful</span>
              ) : (
                <span className="text-red-600 dark:text-red-400">Repair Failed</span>
              )}
            </div>
            <div className="text-xs">
              {results.success 
                ? `Repaired ${results.repaired || 0} media URLs` 
                : `Error: ${results.error}`
              }
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter>
        <Button
          onClick={handleRunRepair}
          disabled={isProcessing}
          className="w-full flex items-center justify-center gap-2"
          variant="default"
        >
          {isProcessing ? (
            <>
              <Spinner className="h-4 w-4" />
              Repairing URLs...
            </>
          ) : (
            <>
              <Database className="h-4 w-4" />
              Repair Media URLs
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
