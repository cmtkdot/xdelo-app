
import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useMessagesStore } from '@/hooks/useMessagesStore';
import { useFilteredMessages } from '@/hooks/useFilteredMessages';
import { cn } from '@/lib/utils';

interface MessageFiltersHeaderProps {
  onRefresh: () => Promise<void>;
}

export function MessageFiltersHeader({ onRefresh }: MessageFiltersHeaderProps) {
  const messagesStore = useMessagesStore() || {};
  
  // Create default filters object with all required properties
  const defaultFilters = {
    search: '',
    processingStates: [],
    mediaTypes: [],
    vendors: [],
    dateRange: null,
    view: 'grid' as 'grid' | 'list'
  };
  
  const { 
    filters = defaultFilters, 
    setFilters,
    detailsOpen, 
    setDetailsOpen,
    analyticsOpen, 
    setAnalyticsOpen 
  } = messagesStore;
  
  const { total = 0, isLoading = false } = useFilteredMessages() || {};
  const [filtersVisible, setFiltersVisible] = React.useState(false);

  // Now TypeScript knows these properties exist on our filters object
  const processingStatesLength = filters.processingStates?.length || 0;
  const vendorsLength = filters.vendors?.length || 0;
  const mediaTypesLength = filters.mediaTypes?.length || 0;
  
  const hasActiveFilters = !!(
    filters.search || 
    processingStatesLength > 0 || 
    vendorsLength > 0 || 
    mediaTypesLength > 0 || 
    filters.dateRange
  );

  const activeFilterCount = (
    (filters.search ? 1 : 0) + 
    processingStatesLength + 
    vendorsLength + 
    mediaTypesLength + 
    (filters.dateRange ? 1 : 0)
  );

  // Define safe handler for setting filters
  const handleSetFilters = (newFilters: any) => {
    if (setFilters) {
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
      />
      
      <div className="flex items-center justify-between">
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
            onClick={() => setAnalyticsOpen && setAnalyticsOpen(!analyticsOpen)}
          >
            <BarChart3 className="h-4 w-4" />
            Analytics
          </Button>
          
          <Tabs 
            defaultValue={filters.view || 'grid'} 
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
            onClick={() => setDetailsOpen && setDetailsOpen(!detailsOpen)}
          >
            <PanelRight className="h-4 w-4" />
            Details
          </Button>
        </div>
      </div>
    </>
  );
}
