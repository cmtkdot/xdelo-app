import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/useToast";
import { Loader2, ImageIcon } from "lucide-react";
import { createLogger } from "@/lib/logger";

// Create a logger for the MediaGroupSyncCard
const logger = createLogger('media-group-sync');

interface SyncResult {
  groupsProcessed: number;
  totalMessagesUpdated: number;
  details: Array<{
    mediaGroupId: string;
    messagesUpdated: number;
    sourceMessageId: string;
  }>;
}

export function MediaGroupSyncCard() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDryRun, setIsDryRun] = useState(true);
  const [limit, setLimit] = useState(100);
  const [imagesOnly, setImagesOnly] = useState(false);
  const [results, setResults] = useState<SyncResult | null>(null);
  const { toast } = useToast();

  const handleSync = async () => {
    try {
      setIsProcessing(true);
      
      // Log the operation start
      await logger.logEvent("SYSTEM_MAINTENANCE", "media-group-sync", {
        operation: "media_group_sync",
        limit,
        dry_run: isDryRun,
        images_only: imagesOnly,
        initiated_at: new Date().toISOString()
      });
      
      // Call the function to sync media groups
      const { data, error } = await supabase.functions.invoke('media_group_sync_cron', {
        body: {
          limit,
          dryRun: isDryRun,
          imagesOnly
        }
      });
      
      if (error) throw error;
      
      setResults(data);
      
      // Log successful operation
      await logger.logEvent("SYSTEM_MAINTENANCE", "media-group-sync", {
        operation: "media_group_sync",
        groups_processed: data.groupsProcessed,
        messages_updated: data.totalMessagesUpdated,
        dry_run: isDryRun,
        status: "completed"
      });
      
      toast({
        title: isDryRun ? "Media Group Analysis Completed" : "Media Group Sync Completed",
        description: `Processed ${data.groupsProcessed} groups with ${data.totalMessagesUpdated} messages ${isDryRun ? "that would be updated" : "updated"}.`,
      });
    } catch (error) {
      console.error('Error syncing media groups:', error);
      
      // Log operation failure
      await logger.logEvent("SYSTEM_ERROR", "media-group-sync", {
        operation: "media_group_sync",
        error: error instanceof Error ? error.message : String(error),
        status: "failed"
      });
      
      toast({
        title: 'Error',
        description: 'Failed to sync media groups.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickFix = async () => {
    setIsDryRun(false);
    setLimit(250);
    setImagesOnly(true);
    
    // Wait for state to update before executing
    setTimeout(() => {
      handleSync();
    }, 0);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-blue-500" />
          Fix Media Group Sync
        </CardTitle>
        <CardDescription>
          Synchronize captions and analyzed content across media groups to ensure consistency
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          This utility will find media groups with inconsistent analyzed content and synchronize them.
          Fix media group messages where some messages have analyzed content while others don't.
        </p>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="limit">Limit (groups to process)</Label>
              <Input
                id="limit"
                type="number"
                min={1}
                max={500}
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value) || 100)}
              />
            </div>
            
            <div className="space-y-2 flex items-end gap-2">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="dry-run" 
                  checked={isDryRun}
                  onCheckedChange={(checked) => setIsDryRun(checked as boolean)}
                />
                <Label htmlFor="dry-run">Dry run (don't make changes)</Label>
              </div>
              
              <div className="flex items-center space-x-2 ml-4">
                <Checkbox 
                  id="images-only" 
                  checked={imagesOnly}
                  onCheckedChange={(checked) => setImagesOnly(checked as boolean)}
                />
                <Label htmlFor="images-only">Fix only images</Label>
              </div>
            </div>
          </div>
        </div>
        
        {results && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md mt-4">
            <h4 className="font-medium text-sm text-blue-700 dark:text-blue-300 mb-1">Results:</h4>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>Media groups processed: {results.groupsProcessed}</li>
              <li>Messages updated: {results.totalMessagesUpdated}</li>
              {results.groupsProcessed > 0 && (
                <li className="pt-1">
                  First group: {results.details[0].mediaGroupId.substring(0, 8)}... 
                  ({results.details[0].messagesUpdated} messages)
                </li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          onClick={handleSync}
          disabled={isProcessing}
          variant="secondary"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : isDryRun ? "Analyze Media Groups" : "Fix Media URLs"}
        </Button>
        
        <Button 
          onClick={handleQuickFix}
          disabled={isProcessing}
          variant="destructive"
        >
          Quick Fix Images (250)
        </Button>
      </CardFooter>
    </Card>
  );
}
