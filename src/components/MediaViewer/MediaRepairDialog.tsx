import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMediaRepair, RepairOption, RepairFilter } from "@/hooks/useMediaRepair";
import { Message, ProcessingState } from "@/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, AlertTriangle, CheckCircle2, XCircle, Filter } from "lucide-react";

interface MediaRepairDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMessages?: Message[];
  initialMessageIds?: string[];
}

export function MediaRepairDialog({ open, onOpenChange, initialMessages = [], initialMessageIds = [] }: MediaRepairDialogProps) {
  const {
    isProcessing,
    selectedMessages,
    results,
    progress,
    filterMessages,
    selectMessages,
    clearSelection,
    repairMessages,
    validateMessages,
    cancelRepair
  } = useMediaRepair();

  const [activeTab, setActiveTab] = useState<string>("select");
  const [availableMessages, setAvailableMessages] = useState<Message[]>(initialMessages);
  const [filters, setFilters] = useState<RepairFilter>({
    processingState: [],
    mimeType: [],
    hasMissingStoragePath: false,
    limit: 100
  });
  const [selectedAll, setSelectedAll] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    if (open) {
      loadFilteredMessages();
    }
  }, [open, filters]);

  useEffect(() => {
    setSelectedAll(selectedMessages.length > 0 && selectedMessages.length === availableMessages.length);
  }, [selectedMessages, availableMessages]);

  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      setAvailableMessages(initialMessages);
      selectMessages(initialMessages);
    } else if (initialMessageIds && initialMessageIds.length > 0) {
      const loadMessagesByIds = async () => {
        setLoadingMessages(true);
        try {
          const { data } = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/repair-media`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({ 
              action: 'get_messages_by_ids',
              messageIds: initialMessageIds
            })
          }).then(res => res.json());
          
          if (data && Array.isArray(data)) {
            setAvailableMessages(data);
            selectMessages(data);
          }
        } catch (error) {
          console.error('Error loading messages by IDs:', error);
        } finally {
          setLoadingMessages(false);
        }
      };
      
      loadMessagesByIds();
    }
  }, [initialMessages, initialMessageIds]);

  const loadFilteredMessages = async () => {
    setLoadingMessages(true);
    try {
      const messages = await filterMessages(filters);
      setAvailableMessages(messages);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      selectMessages(availableMessages);
    } else {
      clearSelection();
    }
    setSelectedAll(checked);
  };

  const toggleSelection = (message: Message) => {
    if (selectedMessages.find(m => m.id === message.id)) {
      selectMessages(selectedMessages.filter(m => m.id !== message.id));
    } else {
      selectMessages([...selectedMessages, message]);
    }
  };

  const handleRepair = async (option: RepairOption) => {
    setActiveTab("progress");
    await repairMessages(option);
    setActiveTab("results");
  };

  const handleCloseDialog = () => {
    if (isProcessing) {
      if (confirm("A repair operation is in progress. Cancel it?")) {
        cancelRepair();
      } else {
        return;
      }
    }
    
    clearSelection();
    setActiveTab("select");
    onOpenChange(false);
  };

  const handleAddFilter = (type: keyof RepairFilter, value: any) => {
    setFilters(prev => {
      if (type === 'processingState' || type === 'mimeType') {
        const prevArray = prev[type] || [];
        if (!prevArray.includes(value)) {
          return { ...prev, [type]: [...prevArray, value] };
        }
      } else {
        return { ...prev, [type]: value };
      }
      return prev;
    });
  };

  const handleRemoveFilter = (type: keyof RepairFilter, value?: any) => {
    setFilters(prev => {
      if (type === 'processingState' || type === 'mimeType') {
        const prevArray = prev[type] || [];
        return { ...prev, [type]: prevArray.filter(v => v !== value) };
      } else {
        return { ...prev, [type]: type === 'limit' ? 100 : false };
      }
    });
  };

  const handleChangeFilter = (type: keyof RepairFilter, value: any) => {
    setFilters(prev => ({ ...prev, [type]: value }));
  };

  const getProcessingStateLabel = (state: ProcessingState): string => {
    switch (state) {
      case 'initialized': return 'Initialized';
      case 'pending': return 'Pending';
      case 'processing': return 'Processing';
      case 'completed': return 'Completed';
      case 'error': return 'Error';
      default: return state;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleCloseDialog}>
      <DialogContent className="sm:max-w-[725px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Media Repair Tool</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="select" disabled={isProcessing}>Select Messages</TabsTrigger>
            <TabsTrigger value="progress" disabled={!isProcessing && activeTab !== "progress"}>
              Progress
            </TabsTrigger>
            <TabsTrigger value="results" disabled={!results && activeTab !== "results"}>
              Results
            </TabsTrigger>
          </TabsList>

          <TabsContent value="select" className="flex-1 flex flex-col">
            <div className="flex gap-2 items-center mb-4">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadFilteredMessages}
                disabled={loadingMessages}
              >
                {loadingMessages ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Filter className="h-4 w-4 mr-2" />}
                Refresh
              </Button>
              
              <Select
                value={filters.limit?.toString()}
                onValueChange={(value) => handleChangeFilter('limit', parseInt(value))}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Limit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25 messages</SelectItem>
                  <SelectItem value="50">50 messages</SelectItem>
                  <SelectItem value="100">100 messages</SelectItem>
                  <SelectItem value="200">200 messages</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="flex items-center space-x-2 ml-2">
                <Checkbox 
                  id="check-missing-storage"
                  checked={filters.hasMissingStoragePath}
                  onCheckedChange={(checked) => 
                    handleChangeFilter('hasMissingStoragePath', !!checked)
                  }
                />
                <label htmlFor="check-missing-storage" className="text-sm font-medium">
                  Missing Storage Path
                </label>
              </div>
              
              <div className="ml-auto">
                <span className="text-sm text-muted-foreground">
                  {availableMessages.length} messages • {selectedMessages.length} selected
                </span>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-1 mb-4">
              {filters.processingState?.map(state => (
                <Badge key={state} variant="secondary" className="gap-1">
                  {getProcessingStateLabel(state as ProcessingState)}
                  <button 
                    className="ml-1 hover:text-destructive" 
                    onClick={() => handleRemoveFilter('processingState', state)}
                  >
                    ×
                  </button>
                </Badge>
              ))}
              
              {filters.mimeType?.map(mime => (
                <Badge key={mime} variant="secondary" className="gap-1">
                  {mime}
                  <button 
                    className="ml-1 hover:text-destructive" 
                    onClick={() => handleRemoveFilter('mimeType', mime)}
                  >
                    ×
                  </button>
                </Badge>
              ))}
              
              {filters.hasMissingStoragePath && (
                <Badge variant="secondary" className="gap-1">
                  Missing Storage Path
                  <button 
                    className="ml-1 hover:text-destructive" 
                    onClick={() => handleRemoveFilter('hasMissingStoragePath')}
                  >
                    ×
                  </button>
                </Badge>
              )}
              
              {(filters.processingState?.length || 0) + 
               (filters.mimeType?.length || 0) + 
               (filters.hasMissingStoragePath ? 1 : 0) > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 text-xs" 
                  onClick={() => setFilters({
                    processingState: [],
                    mimeType: [],
                    hasMissingStoragePath: false,
                    limit: 100
                  })}
                >
                  Clear All
                </Button>
              )}
            </div>

            {loadingMessages ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="flex items-center space-x-2 mb-2">
                  <Checkbox 
                    id="select-all"
                    checked={selectedAll} 
                    onCheckedChange={handleSelectAll}
                  />
                  <label htmlFor="select-all" className="text-sm font-medium">
                    Select All ({availableMessages.length})
                  </label>
                </div>

                <ScrollArea className="flex-1 border rounded-md">
                  <div className="p-2 space-y-2">
                    {availableMessages.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No messages found matching the filters
                      </div>
                    ) : (
                      availableMessages.map(message => (
                        <div 
                          key={message.id} 
                          className="flex items-center space-x-2 p-2 hover:bg-accent rounded-md"
                        >
                          <Checkbox 
                            checked={!!selectedMessages.find(m => m.id === message.id)}
                            onCheckedChange={() => toggleSelection(message)}
                          />
                          <div className="flex-1 truncate">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium truncate">
                                {message.analyzed_content?.product_name || 
                                 message.caption?.substring(0, 30) || 
                                 message.file_unique_id}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {message.processing_state}
                              </Badge>
                              {message.mime_type && (
                                <Badge variant="secondary" className="text-xs">
                                  {message.mime_type}
                                </Badge>
                              )}
                              {!message.storage_path && (
                                <Badge variant="destructive" className="text-xs">
                                  No Storage Path
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              ID: {message.id} • {new Date(message.created_at || '').toLocaleString()}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </>
            )}
          </TabsContent>

          <TabsContent value="progress" className="flex-1 flex flex-col">
            <div className="space-y-4 py-4">
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold">Repairing Media</h3>
                <p className="text-muted-foreground">
                  Processing {selectedMessages.length} messages
                </p>
              </div>
              
              <Progress value={progress} />
              
              <div className="flex justify-center mt-8">
                <Button variant="destructive" onClick={cancelRepair}>
                  Cancel
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="results" className="flex-1 flex flex-col">
            {results && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="border rounded-md p-4">
                    <h3 className="font-medium mb-2">Summary</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Total Processed:</span>
                        <span>{results.messageCount || selectedMessages.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Successful:</span>
                        <span className="text-green-600">{results.successful}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Failed:</span>
                        <span className="text-red-600">{results.failed}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border rounded-md p-4">
                    <h3 className="font-medium mb-2">Repairs Made</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Content Disposition:</span>
                        <span>{results.contentDispositionFixed || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>MIME Types:</span>
                        <span>{results.mimeTypesFixed || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Storage Paths:</span>
                        <span>{results.storagePathsRepaired || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Metadata Recovered:</span>
                        <span>{results.metadataRecovered || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4">
                  <h3 className="font-medium mb-2">Details</h3>
                  <ScrollArea className="h-[200px] border rounded-md">
                    <div className="p-2 space-y-2">
                      {results.details?.map((detail: any, index: number) => (
                        <div key={index} className="text-sm border rounded-md p-2">
                          <div className="flex items-center gap-2">
                            {detail.success ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600" />
                            )}
                            <span className="font-medium truncate">
                              {detail.messageId}
                            </span>
                          </div>
                          
                          {detail.repairs && Object.keys(detail.repairs).length > 0 && (
                            <div className="mt-1 pl-6 text-xs text-muted-foreground">
                              {Object.entries(detail.repairs).map(([key, value]: [string, any]) => (
                                <div key={key}>
                                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}: {String(value)}
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {detail.error && (
                            <div className="mt-1 pl-6 text-xs text-red-600">
                              Error: {detail.error}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          {activeTab === "select" && (
            <>
              <Button 
                variant="outline" 
                onClick={handleCloseDialog}
                className="mr-auto"
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={() => validateMessages()}
                disabled={selectedMessages.length === 0 || isProcessing}
              >
                Validate Selected
              </Button>
              <div className="flex space-x-2">
                <Button
                  onClick={() => handleRepair('fix_content_disposition')}
                  disabled={selectedMessages.length === 0 || isProcessing}
                >
                  Fix Display
                </Button>
                <Button
                  onClick={() => handleRepair('repair_all')}
                  disabled={selectedMessages.length === 0 || isProcessing}
                >
                  Repair All Issues
                </Button>
              </div>
            </>
          )}
          
          {activeTab === "results" && (
            <>
              <Button 
                variant="outline" 
                onClick={() => setActiveTab("select")}
                className="mr-auto"
              >
                Back to Selection
              </Button>
              <Button onClick={handleCloseDialog}>
                Close
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
