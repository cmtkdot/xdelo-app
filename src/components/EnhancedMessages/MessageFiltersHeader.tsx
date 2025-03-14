
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
  const { 
    filters, 
    setFilters,
    detailsOpen, 
    setDetailsOpen,
    analyticsOpen, 
    setAnalyticsOpen 
  } = useMessagesStore();
  
  const { total, isLoading } = useFilteredMessages();
  const [filtersVisible, setFiltersVisible] = React.useState(false);

  const hasActiveFilters = !!(
    filters.search || 
    filters.processingStates.length > 0 || 
    filters.vendors.length > 0 || 
    filters.mediaTypes.length > 0 || 
    filters.dateRange
  );

  const activeFilterCount = (
    (filters.search ? 1 : 0) + 
    filters.processingStates.length + 
    filters.vendors.length + 
    filters.mediaTypes.length + 
    (filters.dateRange ? 1 : 0)
  );

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
            onClick={() => setAnalyticsOpen(!analyticsOpen)}
          >
            <BarChart3 className="h-4 w-4" />
            Analytics
          </Button>
          
          <Tabs 
            defaultValue={filters.view} 
            className="w-auto" 
            onValueChange={(value) => setFilters({ ...filters, view: value as 'grid' | 'list' })}
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
    </>
  );
}
