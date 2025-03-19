
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, Search, FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from '@/hooks/useToast';

interface MatchLogMetadata {
  matchCount: number;
  hasBestMatch: boolean;
  bestMatchConfidence: number;
  bestMatchProductId: string | null;
  timestamp: string;
}

interface MatchLog {
  id: string;
  created_at: string;
  event_type: string;
  message_id: string;
  user_id: string | null;
  metadata: MatchLogMetadata;
}

export const MatchingHistory = () => {
  const [logs, setLogs] = useState<MatchLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const loadMatchLogs = async () => {
    setIsLoading(true);
    try {
      // Using the unified_audit_logs table instead of event_logs
      const { data, error } = await supabase
        .from('unified_audit_logs')
        .select('*')
        .eq('event_type', 'PRODUCT_MATCHING')
        .order('event_timestamp', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      
      // Transform the data to match our expected MatchLog type
      const transformedLogs: MatchLog[] = (data || []).map(log => ({
        id: log.id,
        created_at: log.event_timestamp,
        event_type: log.event_type,
        message_id: log.entity_id || '',
        user_id: log.user_id,
        metadata: log.metadata as MatchLogMetadata || {
          matchCount: 0,
          hasBestMatch: false,
          bestMatchConfidence: 0,
          bestMatchProductId: null,
          timestamp: log.event_timestamp
        }
      }));
      
      setLogs(transformedLogs);
    } catch (error) {
      console.error("Error loading match logs:", error);
      toast({
        title: "Failed to load history",
        description: "Could not retrieve product matching history logs.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    loadMatchLogs();
  }, []);
  
  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    
    const searchTermLower = searchTerm.toLowerCase();
    return (
      log.message_id.toLowerCase().includes(searchTermLower) ||
      (log.metadata?.bestMatchProductId || "").toLowerCase().includes(searchTermLower)
    );
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Matching History</CardTitle>
              <CardDescription>
                Recent product matching operations and their results
              </CardDescription>
            </div>
            <Button variant="outline" size="icon" onClick={loadMatchLogs} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-2 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by message ID or product ID"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileSearch className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No matching logs found</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                {filteredLogs.map((log) => (
                  <div key={log.id} className="border rounded-md p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">
                        {new Date(log.created_at).toLocaleString()}
                      </div>
                      <div>
                        {log.metadata?.hasBestMatch ? (
                          <span className="px-2 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full">
                            Match Found
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded-full">
                            No Match
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <div className="text-muted-foreground">Message ID:</div>
                      <div className="font-mono text-xs truncate">{log.message_id}</div>
                      
                      {log.metadata?.hasBestMatch && (
                        <>
                          <div className="text-muted-foreground">Product ID:</div>
                          <div className="font-mono text-xs truncate">{log.metadata?.bestMatchProductId || "N/A"}</div>
                          
                          <div className="text-muted-foreground">Confidence:</div>
                          <div className="font-medium">{(log.metadata?.bestMatchConfidence * 100).toFixed(1)}%</div>
                        </>
                      )}
                      
                      <div className="text-muted-foreground">Matches Found:</div>
                      <div>{log.metadata?.matchCount || 0}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
