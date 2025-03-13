
import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export function FixMediaUrlsCard() {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [limit, setLimit] = useState<number>(100);
  const [dryRun, setDryRun] = useState<boolean>(false);
  const [results, setResults] = useState<any>(null);

  const handleFixMediaUrls = async () => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('xdelo_fix_media_urls', {
        body: { 
          limit, 
          dryRun 
        }
      });
      
      if (error) {
        throw error;
      }
      
      setResults(data);
      
      if (dryRun) {
        toast.info(`Dry run completed: ${data.results.processed} files would be processed`);
      } else {
        toast.success(`Successfully fixed ${data.results.fixed} media URLs`);
      }
      
      console.log('Fix media URLs result:', data);
    } catch (error) {
      console.error('Error fixing media URLs:', error);
      toast.error('Failed to fix media URLs: ' + (error?.message || 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="border-blue-300">
      <CardHeader className="pb-3">
        <CardTitle className="text-blue-500">Fix Media URLs</CardTitle>
        <CardDescription>
          Fix public URLs and metadata for media files to ensure they are publicly viewable
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="limit">Limit (files to process)</Label>
              <Input
                id="limit"
                type="number"
                min={1}
                max={10000}
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value) || 100)}
              />
            </div>
            <div className="flex items-end space-x-2 h-full pb-0.5">
              <Checkbox 
                id="dryRun" 
                checked={dryRun}
                onCheckedChange={(checked) => setDryRun(!!checked)}
              />
              <Label htmlFor="dryRun" className="text-sm cursor-pointer">Dry run (don't make changes)</Label>
            </div>
          </div>
        </div>
        
        {results && (
          <div className="rounded-md bg-muted p-4 mt-4">
            <h4 className="font-medium mb-2">Results:</h4>
            <ul className="space-y-1 text-sm">
              <li>Processed: {results.results.processed}</li>
              <li>Fixed: {results.results.fixed}</li>
              <li>Skipped: {results.results.skipped}</li>
              <li>Errors: {results.results.errors}</li>
            </ul>
            
            {results.details && results.details.length > 0 && (
              <div className="mt-4">
                <h5 className="font-medium mb-1">Details (first {results.details.length}):</h5>
                <div className="max-h-40 overflow-y-auto text-xs">
                  {results.details.map((item: any, i: number) => (
                    <div key={i} className="border-t pt-1 mt-1 first:border-t-0 first:pt-0 first:mt-0">
                      <div>ID: {item.id.substring(0, 8)}...</div>
                      <div className="truncate">New URL: {item.new_url}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleFixMediaUrls} 
          disabled={isProcessing} 
          variant="secondary"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            "Fix Media URLs"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
