
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, Filter, FileText, FolderSync, FileX } from 'lucide-react';

interface MessageControlPanelProps {
  searchTerm: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onToggleFilters: () => void;
  showFilters: boolean;
  onFixMimeTypes: () => void;
  onRepairStoragePaths: () => void;
  onFixInvalidFileIds?: () => void; // New optional handler
}

export const MessageControlPanel: React.FC<MessageControlPanelProps> = ({
  searchTerm,
  onSearchChange,
  onRefresh,
  isRefreshing,
  onToggleFilters,
  showFilters,
  onFixMimeTypes,
  onRepairStoragePaths,
  onFixInvalidFileIds
}) => {
  return (
    <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
      <div className="flex-1 w-full md:w-auto">
        <Input
          placeholder="Search messages..."
          value={searchTerm}
          onChange={onSearchChange}
          className="w-full"
        />
      </div>
      
      <div className="flex flex-wrap gap-2 justify-end">
        <Button 
          variant="outline" 
          size="sm"
          onClick={onToggleFilters}
        >
          <Filter className="h-4 w-4 mr-1" />
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </Button>
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={onFixMimeTypes}
        >
          <FileText className="h-4 w-4 mr-1" />
          Fix MIME Types
        </Button>
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={onRepairStoragePaths}
        >
          <FolderSync className="h-4 w-4 mr-1" />
          Repair Paths
        </Button>
        
        {onFixInvalidFileIds && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={onFixInvalidFileIds}
          >
            <FileX className="h-4 w-4 mr-1" />
            Fix Invalid Files
          </Button>
        )}
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>
    </div>
  );
};
