
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Info, Filter, LayoutGrid, LayoutList, Menu } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/useMobile';
import { cn } from '@/lib/utils';

interface EnhancedMessagesHeaderProps {
  title: string;
  totalMessages: number;
  onRefresh: () => void;
  isLoading: boolean;
  onToggleFilters?: () => void;
  onToggleView?: () => void;
  onToggleSidebar?: () => void;
  filtersCount?: number;
  currentView?: 'grid' | 'list';
}

export const EnhancedMessagesHeader: React.FC<EnhancedMessagesHeaderProps> = ({
  title,
  totalMessages,
  onRefresh,
  isLoading,
  onToggleFilters,
  onToggleView,
  onToggleSidebar,
  filtersCount = 0,
  currentView = 'grid'
}) => {
  const isMobile = useIsMobile();

  return (
    <div className="flex flex-col space-y-4 max-w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isMobile && onToggleSidebar && (
            <Button variant="ghost" size="icon" onClick={onToggleSidebar} className="md:hidden">
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <div className="truncate">
            <h1 className={cn(
              "font-bold truncate",
              isMobile ? "text-xl" : "text-2xl"
            )}>{title}</h1>
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground text-sm truncate">
                {totalMessages} message{totalMessages !== 1 ? 's' : ''}
              </p>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>View and manage all messages with enhanced filtering and analytics.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {onToggleView && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={onToggleView}
                    className="hidden sm:flex"
                  >
                    {currentView === 'grid' ? (
                      <LayoutList className="h-4 w-4" />
                    ) : (
                      <LayoutGrid className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {currentView === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          {onToggleFilters && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size={isMobile ? "icon" : "default"}
                    onClick={onToggleFilters}
                    className={isMobile ? "" : "gap-2"}
                  >
                    <Filter className="h-4 w-4" />
                    {!isMobile && <span>Filters</span>}
                    {filtersCount > 0 && (
                      <Badge variant="secondary" className={cn(isMobile ? "absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]" : "ml-1")}>
                        {filtersCount}
                      </Badge>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Filter messages
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  onClick={onRefresh} 
                  disabled={isLoading} 
                  size={isMobile ? "icon" : "default"}
                  className={isMobile ? "" : "gap-2"}
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  {!isMobile && (isLoading ? 'Refreshing...' : 'Refresh')}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Refresh data
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      
      {isMobile && onToggleView && (
        <div className="flex justify-center sm:hidden">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onToggleView}
            className="w-full gap-2"
          >
            {currentView === 'grid' ? (
              <>
                <LayoutList className="h-4 w-4" />
                <span>Switch to List View</span>
              </>
            ) : (
              <>
                <LayoutGrid className="h-4 w-4" />
                <span>Switch to Grid View</span>
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};
