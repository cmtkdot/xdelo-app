import React, { useState, useEffect } from 'react';
import { useMakeEventLogs, MakeEventLog } from '@/hooks/useMakeEventLogs';
import { MakeEventType } from '@/types/make';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  AlertTriangle, 
  Download, 
  RefreshCw, 
  Search, 
  X, 
  Calendar as CalendarIcon, 
  Filter,
  Check,
  Loader2
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Pagination, PaginationContent, PaginationItem, PaginationLink } from '@/components/ui/pagination';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/useToast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import EventDetailMenu from './EventDetailMenu';

const ITEMS_PER_PAGE = 20;

const EventMonitor: React.FC = () => {
  const [selectedEventType, setSelectedEventType] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<'success' | 'failed' | 'pending' | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [searchValue, setSearchValue] = useState<string>('');
  const [currentEvent, setCurrentEvent] = useState<MakeEventLog | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const {
    useEventLogs,
    useEventLogsCount,
    useEventStatusSummary,
    retryFailedEvent,
    clearEventLogs
  } = useMakeEventLogs();

  const { toast } = useToast();

  // Calculate offset for pagination
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  const { data: events = [], isLoading: isEventsLoading, refetch } = useEventLogs({
    eventType: selectedEventType,
    status: selectedStatus,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
    startDate: startDate ? startDate.toISOString() : undefined,
    endDate: endDate ? endDate.toISOString() : undefined,
    limit: ITEMS_PER_PAGE,
    offset
  });
  
  const { data: totalEvents = 0 } = useEventLogsCount({
    eventType: selectedEventType,
    status: selectedStatus,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
    startDate: startDate ? startDate.toISOString() : undefined,
    endDate: endDate ? endDate.toISOString() : undefined,
  });
  
  const { data: statusSummary = [] } = useEventStatusSummary();

  // Total pages calculation
  const totalPages = Math.ceil(totalEvents / ITEMS_PER_PAGE);
  
  const handleViewEventDetails = (event: MakeEventLog) => {
    setCurrentEvent(event);
    setIsDialogOpen(true);
  };
  
  const handleClearLogs = () => {
    if (window.confirm('Are you sure you want to clear event logs older than 30 days?')) {
      setIsLoading(true);
      clearEventLogs.mutate({}, {
        onSuccess: () => {
          refetch();
          setIsLoading(false);
        },
        onError: () => {
          setIsLoading(false);
        }
      });
    }
  };
  
  const handleRetryEvent = (eventId: string) => {
    setIsLoading(true);
    retryFailedEvent.mutate(eventId, {
      onSuccess: () => {
        toast({
          title: 'Success',
          description: 'Event retry initiated',
        });
        refetch();
        setIsLoading(false);
      },
      onError: (error) => {
        toast({
          title: 'Error',
          description: `Failed to retry event: ${error.message}`,
          variant: 'destructive',
        });
        setIsLoading(false);
      }
    });
  };
  
  const downloadEventAsJson = (event: MakeEventLog) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(event, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `event-${event.id}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  // Format date for display
  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    return format(new Date(dateString), 'PPpp');
  };

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedEventType, selectedStatus, selectedTags, startDate, endDate]);

  // Reset search when filters are cleared
  const handleClearFilters = () => {
    setSelectedEventType(null);
    setSelectedStatus(null);
    setSelectedTags([]);
    setStartDate(null);
    setEndDate(null);
    setSearchValue('');
    setCurrentPage(1);
  };

  // Handler for pagination
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Get unique tags from events for the filter
  const uniqueTags = events.reduce((acc: string[], event) => {
    if (event.tags) {
      event.tags.forEach(tag => {
        if (!acc.includes(tag)) {
          acc.push(tag);
        }
      });
    }
    return acc;
  }, []);

  // Filter events by search
  const filteredEvents = searchValue.trim() 
    ? events.filter(event => 
        JSON.stringify(event.payload)?.toLowerCase().includes(searchValue.toLowerCase()) ||
        event.event_type.toLowerCase().includes(searchValue.toLowerCase()) ||
        (event.error_message && event.error_message.toLowerCase().includes(searchValue.toLowerCase()))
      )
    : events;

  // Add this wrapper function to handle the type mismatch
  const handleReplayEvent = (event: MakeEventLog) => {
    if (event && event.id) {
      handleRetryEvent(event.id);
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Input
              placeholder="Search in events..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pr-8"
            />
            {searchValue && (
              <button 
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => setSearchValue('')}
              >
                <X size={16} />
              </button>
            )}
          </div>
          
          <Button 
            variant="outline" 
            onClick={() => setShowFilters(!showFilters)}
            className="w-full sm:w-auto"
          >
            <Filter size={16} className="mr-2" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </Button>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => refetch()}
            disabled={isEventsLoading}
          >
            {isEventsLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleClearLogs}
            disabled={isLoading}
            className="whitespace-nowrap"
          >
            Clear Old Logs
          </Button>
        </div>
      </div>
      
      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Event Type</label>
                <Select
                  value={selectedEventType || ''}
                  onValueChange={(value) => setSelectedEventType(value || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Event Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Event Types</SelectItem>
                    {Object.values(MakeEventType).map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select
                  value={selectedStatus || ''}
                  onValueChange={(value) => setSelectedStatus(value as any || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Statuses</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, 'PPP') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">End Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, 'PPP') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            
            {uniqueTags.length > 0 && (
              <div className="mt-4">
                <label className="text-sm font-medium block mb-2">Tags</label>
                <div className="flex flex-wrap gap-2">
                  {uniqueTags.map(tag => (
                    <Badge 
                      key={tag}
                      variant={selectedTags.includes(tag) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        if (selectedTags.includes(tag)) {
                          setSelectedTags(selectedTags.filter(t => t !== tag));
                        } else {
                          setSelectedTags([...selectedTags, tag]);
                        }
                      }}
                    >
                      {tag}
                      {selectedTags.includes(tag) && (
                        <Check className="ml-1 h-3 w-3" />
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            <div className="mt-4 flex justify-end">
              <Button 
                variant="ghost" 
                onClick={handleClearFilters}
              >
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Status Summary */}
      {statusSummary && statusSummary.length > 0 && (
        <div className="flex flex-wrap gap-2 py-2">
          <Badge variant="outline" className="text-sm py-1 px-3">
            Total: {totalEvents}
          </Badge>
          {statusSummary.map(item => (
            <Badge 
              key={item.status}
              variant={
                item.status === 'success' ? 'default' : 
                item.status === 'failed' ? 'destructive' : 
                'secondary'
              }
              className="text-sm py-1 px-3"
            >
              {item.status}: {item.count}
            </Badge>
          ))}
        </div>
      )}

      {/* Event List */}
      {isEventsLoading ? (
        <div className="h-[400px] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground">
          <p className="mb-2">No events found</p>
          {(selectedEventType || selectedStatus || startDate || endDate || selectedTags.length > 0 || searchValue) && (
            <Button variant="ghost" onClick={handleClearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Status</TableHead>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.map((event) => (
                  <TableRow 
                    key={event.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleViewEventDetails(event)}
                  >
                    <TableCell>
                      <Badge
                        variant={
                          event.status === 'success' ? 'default' : 
                          event.status === 'failed' ? 'destructive' : 
                          'secondary'
                        }
                      >
                        {event.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{event.event_type}</TableCell>
                    <TableCell>{formatDate(event.created_at)}</TableCell>
                    <TableCell>{formatDate(event.completed_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center space-x-2">
                        {event.status === 'failed' && (
                          <Button 
                            variant="ghost" 
                            size="icon"
                            title="Retry"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReplayEvent(event);
                            }}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon"
                          title="Download JSON"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadEventAsJson(event);
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-4">
              <nav className="flex justify-center">
                <Pagination>
                  <PaginationContent>
                    {Array.from({ length: totalPages }).map((_, index) => (
                      <PaginationItem key={index}>
                        <PaginationLink
                          isActive={currentPage === index + 1}
                          onClick={() => handlePageChange(index + 1)}
                        >
                          {index + 1}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                  </PaginationContent>
                </Pagination>
              </nav>
            </div>
          )}
        </>
      )}
      
      {/* Event Details Dialog */}
      {currentEvent && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>Event Details</DialogTitle>
            </DialogHeader>
            
            <div className="flex justify-between items-center py-2">
              <div className="flex items-center gap-2">
                <Badge variant={
                  currentEvent.status === 'success' ? 'default' : 
                  currentEvent.status === 'failed' ? 'destructive' : 
                  'secondary'
                }>
                  {currentEvent.status}
                </Badge>
                <Badge variant="outline">{currentEvent.event_type}</Badge>
                
                {currentEvent.tags && currentEvent.tags.length > 0 && (
                  <div className="flex gap-1 ml-2">
                    {currentEvent.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <EventDetailMenu 
                  event={currentEvent} 
                  onReplayEvent={currentEvent.status === 'failed' ? handleReplayEvent : undefined} 
                />
              </div>
            </div>
            
            <div className="text-sm text-muted-foreground space-y-1">
              <p>ID: {currentEvent.id}</p>
              <p>Created: {formatDate(currentEvent.created_at)}</p>
              {currentEvent.completed_at && (
                <p>Completed: {formatDate(currentEvent.completed_at)}</p>
              )}
              {currentEvent.duration_ms && (
                <p>Duration: {currentEvent.duration_ms}ms</p>
              )}
            </div>
            
            {currentEvent.error_message && (
              <div className="text-destructive border border-destructive/50 rounded-md p-3 mt-3">
                <h4 className="font-medium mb-1">Error</h4>
                <p className="text-sm">{currentEvent.error_message}</p>
              </div>
            )}
            
            <Tabs defaultValue="payload" className="mt-4">
              <TabsList>
                <TabsTrigger value="payload">Payload</TabsTrigger>
                <TabsTrigger value="request">Request</TabsTrigger>
                <TabsTrigger value="response">Response</TabsTrigger>
                <TabsTrigger value="context">Context</TabsTrigger>
              </TabsList>
              
              <TabsContent value="payload">
                <div className="bg-muted rounded-md p-3 overflow-auto max-h-[300px]">
                  <pre className="text-xs">
                    {JSON.stringify(currentEvent.payload, null, 2)}
                  </pre>
                </div>
              </TabsContent>
              
              <TabsContent value="request">
                <div className="bg-muted rounded-md p-3 overflow-auto max-h-[300px]">
                  <pre className="text-xs">
                    {JSON.stringify(currentEvent.request_headers, null, 2) || 'No request data available'}
                  </pre>
                </div>
              </TabsContent>
              
              <TabsContent value="response">
                <div className="space-y-3">
                  {currentEvent.response_code && (
                    <div className="flex items-center">
                      <span className="text-sm font-medium mr-2">Status Code:</span>
                      <Badge variant={
                        currentEvent.response_code >= 200 && currentEvent.response_code < 300 ? 'default' :
                        currentEvent.response_code >= 400 ? 'destructive' : 'secondary'
                      }>
                        {currentEvent.response_code}
                      </Badge>
                    </div>
                  )}
                  
                  <div className="bg-muted rounded-md p-3 overflow-auto max-h-[300px]">
                    {currentEvent.response_headers && (
                      <div className="mb-3">
                        <h4 className="text-sm font-medium mb-1">Headers:</h4>
                        <pre className="text-xs">
                          {JSON.stringify(currentEvent.response_headers, null, 2)}
                        </pre>
                      </div>
                    )}
                    
                    {currentEvent.response_body && (
                      <div>
                        <h4 className="text-sm font-medium mb-1">Body:</h4>
                        <pre className="text-xs">
                          {currentEvent.response_body}
                        </pre>
                      </div>
                    )}
                    
                    {!currentEvent.response_headers && !currentEvent.response_body && (
                      <p className="text-sm text-muted-foreground">No response data available</p>
                    )}
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="context">
                <div className="bg-muted rounded-md p-3 overflow-auto max-h-[300px]">
                  <pre className="text-xs">
                    {JSON.stringify(currentEvent.context, null, 2) || 'No context data available'}
                  </pre>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default EventMonitor; 