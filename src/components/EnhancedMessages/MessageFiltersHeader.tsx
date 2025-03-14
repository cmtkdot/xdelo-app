
import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ChevronDown, ChevronUp, Filter, LayoutGrid, LayoutList } from 'lucide-react';
import { useMessagesStore } from '@/hooks/useMessagesStore';
import { EnhancedFiltersPanel } from './EnhancedFiltersPanel';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useMobile';

interface MessageFiltersHeaderProps {
  onRefresh: () => void;
  isFiltersPanelOpen?: boolean;
  onToggleFiltersPanel?: () => void;
}

export function MessageFiltersHeader({
  onRefresh,
  isFiltersPanelOpen = false,
  onToggleFiltersPanel
}: MessageFiltersHeaderProps) {
  const {
    filters,
    filtersCount,
    analyticsOpen,
    toggleAnalytics
  } = useMessagesStore();
  
  const isMobile = useIsMobile();
  
  return (
    <div className="space-y-2">
      {/* Conditionally render the filters panel */}
      {isFiltersPanelOpen && (
        <div className="w-full border rounded-lg p-3 bg-card shadow-sm">
          <EnhancedFiltersPanel />
        </div>
      )}
      
      {/* Show/hide filters button when panel is closed */}
      {!isFiltersPanelOpen && onToggleFiltersPanel && (
        <div className="flex justify-start">
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleFiltersPanel}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            <span>Show Filters</span>
            {filtersCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {filtersCount}
              </Badge>
            )}
          </Button>
        </div>
      )}
      
      {/* Hide filters button when panel is open */}
      {isFiltersPanelOpen && onToggleFiltersPanel && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleFiltersPanel}
            className="gap-2"
          >
            <ChevronUp className="h-4 w-4" />
            <span>Hide Filters</span>
          </Button>
        </div>
      )}
    </div>
  );
}
