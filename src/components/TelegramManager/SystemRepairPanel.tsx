
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useProcessingStats } from '@/hooks/useProcessingStats';
import { useMediaGroupRepair } from '@/hooks/useMediaGroupRepair';
import { useProcessingSystemRepair } from '@/hooks/useProcessingSystemRepair';
import { useMediaRepair } from '@/hooks/useMediaRepair';
import { useToast } from '@/hooks/useToast';

export function SystemRepairPanel() {
  const [activeTab, setActiveTab] = useState('processing');
  const { stats, isLoading, refreshStats } = useProcessingStats(true, 30000);
  const { repairProcessingSystem, isRepairing: isSystemRepairing } = useProcessingSystemRepair();
  const { repairAllMediaGroups, isRepairing: isMediaGroupRepairing } = useMediaGroupRepair();
  const { repairMessages } = useMediaRepair();
  const { toast } = useToast();
  
  const handleRepairSystem = async () => {
    try {
      await repairProcessingSystem();
      setTimeout(refreshStats, 1000);
    } catch (error) {
      console.error('Error in system repair:', error);
    }
  };
  
  const handleRepairMediaGroups = async () => {
    try {
      await repairAllMediaGroups();
      setTimeout(refreshStats, 1000);
    } catch (error) {
      console.error('Error in media group repair:', error);
    }
  };
  
  const handleFixContentDisposition = async () => {
    try {
      if (stats?.state_counts?.error) {
        toast({
          title: "Starting Repair",
          description: "Fixing content disposition for error messages. This may take a moment.",
          variant: "default"
        });
        
        await repairMessages('fix_content_disposition');
        setTimeout(refreshStats, 1000);
      }
    } catch (error) {
      console.error('Error fixing content disposition:', error);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>System Status & Repair</CardTitle>
            <CardDescription>
              View processing system status and perform repair operations
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refreshStats()}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="processing">Processing Status</TabsTrigger>
            <TabsTrigger value="actions">Repair Actions</TabsTrigger>
          </TabsList>
          
          <TabsContent value="processing">
            {isLoading ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : stats ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium mb-2">Message States</h3>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="bg-gray-100">
                        Total: {stats.state_counts.total_messages}
                      </Badge>
                      <Badge variant="outline" className="bg-blue-100">
                        Initialized: {stats.state_counts.initialized}
                      </Badge>
                      <Badge variant="outline" className="bg-yellow-100">
                        Pending: {stats.state_counts.pending}
                      </Badge>
                      <Badge variant="outline" className="bg-purple-100">
                        Processing: {stats.state_counts.processing}
                      </Badge>
                      <Badge variant="outline" className="bg-green-100">
                        Completed: {stats.state_counts.completed}
                      </Badge>
                      <Badge variant="outline" className="bg-red-100">
                        Error: {stats.state_counts.error}
                      </Badge>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium mb-2">Problem Indicators</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Stuck in Processing:</span>
                        <Badge variant={stats.media_group_stats.stuck_in_processing > 0 ? "destructive" : "outline"}>
                          {stats.media_group_stats.stuck_in_processing}
                        </Badge>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Orphaned Media Group Messages:</span>
                        <Badge variant={stats.media_group_stats.orphaned_media_group_messages > 0 ? "destructive" : "outline"}>
                          {stats.media_group_stats.orphaned_media_group_messages}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium mb-2">Processing Metrics</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Avg Processing Time:</span>
                        <span>{stats.timing_stats.avg_processing_time_seconds?.toFixed(2) || 'N/A'} seconds</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Oldest Unprocessed Caption:</span>
                        <span>{stats.timing_stats.oldest_unprocessed_caption_age_hours?.toFixed(1) || 'N/A'} hours</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Oldest Stuck Message:</span>
                        <span>{stats.timing_stats.oldest_stuck_processing_hours?.toFixed(1) || 'N/A'} hours</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  Could not load processing statistics.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
          
          <TabsContent value="actions">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2">System Repair</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Fix stuck messages and processing issues
                </p>
                <Button 
                  onClick={() => handleRepairSystem()}
                  disabled={isSystemRepairing}
                  className="mr-2"
                >
                  {isSystemRepairing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Repair Processing System
                </Button>
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-2">Media Group Repair</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Fix inconsistencies in media groups
                </p>
                <Button 
                  onClick={() => handleRepairMediaGroups()}
                  disabled={isMediaGroupRepairing}
                  variant="secondary"
                  className="mr-2"
                >
                  {isMediaGroupRepairing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Repair Media Groups
                </Button>
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-2">Media Content Repair</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Fix content display issues
                </p>
                <Button 
                  onClick={() => handleFixContentDisposition()}
                  variant="outline"
                >
                  Fix Content Display
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="flex justify-between border-t pt-4">
        <div className="text-xs text-muted-foreground">
          Last updated: {stats?.timestamp ? new Date(stats.timestamp).toLocaleString() : 'Never'}
        </div>
      </CardFooter>
    </Card>
  );
}
