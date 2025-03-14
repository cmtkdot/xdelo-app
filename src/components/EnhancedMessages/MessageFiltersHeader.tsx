
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Filter, 
  BarChart3, 
  LayoutGrid, 
  LayoutList, 
  PanelRight,
  RefreshCw
} from 'lucide-react';
import { EnhancedFiltersPanel } from './EnhancedFiltersPanel';
import { EnhancedMessagesHeader } from './EnhancedMessagesHeader';
import { useMessagesStore, FilterState } from '@/hooks/useMessagesStore';
import { useFilteredMessages } from '@/hooks/useFilteredMessages';
import { useIsMobile } from '@/hooks/useMobile';
import { cn } from '@/lib/utils';

interface MessageFiltersHeaderProps {
  onRefresh: () => Promise<void>;
}

export function MessageFiltersHeader({ onRefresh }: MessageFiltersHeaderProps) {
  const [filtersVisible, setFiltersVisible] = useState(false);
  const isMobile = useIsMobile();
  
  // Get the messages store with defensive default values
  const { 
    filters = {
      search: '',
      processingStates: [],
      mediaTypes: [],
      vendors: [],
      dateRange: null,
      showGroups: true,
      chatSources: [],
      page: 1,
      itemsPerPage: 20,
      view: 'grid' as const,
      sortField: 'created_at' as const,
      sortOrder: 'desc' as const,
    },
    setFilters = () => {},
    detailsOpen = false, 
    setDetailsOpen = () => {},
    analyticsOpen = false, 
    setAnalyticsOpen = () => {}
  } = useMessagesStore() || {};
  
  const { total = 0, isLoading = false } = useFilteredMessages() || {};

  // Calculate active filters with safety checks
  const processingStatesLength = filters?.processingStates?.length || 0;
  const vendorsLength = filters?.vendors?.length || 0;
  const mediaTypesLength = filters?.mediaTypes?.length || 0;
  
  const hasActiveFilters = !!(
    filters?.search || 
    processingStatesLength > 0 || 
    vendorsLength > 0 || 
    mediaTypesLength > 0 || 
    filters?.dateRange
  );

  const activeFilterCount = (
    (filters?.search ? 1 : 0) + 
    processingStatesLength + 
    vendorsLength + 
    mediaTypesLength + 
    (filters?.dateRange ? 1 : 0)
  );

  // Define safe handler for setting filters
  const handleSetFilters = (newFilters: Partial<FilterState>) => {
    if (setFilters && filters) {
      setFilters({...filters, ...newFilters});
    }
  };

  return (
    <>
      <EnhancedMessagesHeader 
        title="Enhanced Messages"
        totalMessages={total}
        onRefresh={onRefresh}
        isLoading={isLoading}
        onToggleFilters={() => setFiltersVisible(!filtersVisible)}
        onToggleView={() => handleSetFilters({ view: filters.view === 'grid' ? 'list' : 'grid' })}
        filtersCount={activeFilterCount}
        currentView={filters.view}
      />
      
      {!isMobile && (
        <div className="flex items-center justify-between my-4 max-w-full overflow-x-auto">
          <div className="flex items-center space-x-2">
            <Sheet open={filtersVisible} onOpenChange={setFiltersVisible}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Filters
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="ml-1">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[350px] sm:w-[450px]">
                <EnhancedFiltersPanel />
              </SheetContent>
            </Sheet>
            
            <Button 
              variant="outline" 
              size="sm" 
              className={cn("gap-2", analyticsOpen ? "bg-secondary" : "")}
              onClick={() => setAnalyticsOpen(!analyticsOpen)}
            >
              <BarChart3 className="h-4 w-4" />
              Analytics
            </Button>
            
            <Tabs 
              value={filters?.view || 'grid'} 
              className="w-auto" 
              onValueChange={(value) => handleSetFilters({ view: value as 'grid' | 'list' })}
            >
              <TabsList className="h-9">
                <TabsTrigger value="grid" className="px-3">
                  <LayoutGrid className="h-4 w-4 mr-2" />
                  Grid
                </TabsTrigger>
                <TabsTrigger value="list" className="px-3">
                  <LayoutList className="h-4 w-4 mr-2" />
                  List
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="gap-2"
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              Refresh
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              className={cn("gap-2", detailsOpen ? "bg-secondary" : "")}
              onClick={() => setDetailsOpen(!detailsOpen)}
            >
              <PanelRight className="h-4 w-4" />
              Details
            </Button>
          </div>
        </div>
      )}
      
      {isMobile && (
        <div className="flex justify-between items-center my-3 max-w-full">
          <Sheet open={filtersVisible} onOpenChange={setFiltersVisible}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9">
                <Filter className="h-4 w-4" />
                {hasActiveFilters && (
                  <Badge variant="secondary" className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[90vw] max-w-[350px]">
              <EnhancedFiltersPanel />
            </SheetContent>
          </Sheet>
          
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant={analyticsOpen ? "default" : "outline"} 
                    size="icon" 
                    className="h-9 w-9"
                    onClick={() => setAnalyticsOpen(!analyticsOpen)}
                  >
                    <BarChart3 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {analyticsOpen ? "Hide analytics" : "Show analytics"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant={detailsOpen ? "default" : "outline"} 
                    size="icon" 
                    className="h-9 w-9"
                    onClick={() => setDetailsOpen(!detailsOpen)}
                  >
                    <PanelRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {detailsOpen ? "Hide details" : "Show details"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      )}
    </>
  );
}
