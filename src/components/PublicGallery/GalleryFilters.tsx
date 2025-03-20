
import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Grid, List, Image, Video, FileText } from 'lucide-react';
import { SearchToolbar } from './SearchToolbar';

interface GalleryFiltersProps {
  filter: string;
  setFilter: (filter: string) => void;
  viewMode: 'grid' | 'table';
  setViewMode: (mode: 'grid' | 'table') => void;
  searchTerm?: string;
  onSearchChange?: (value: string) => void;
  onClearSearch?: () => void;
  isSearching?: boolean;
}

export function GalleryFilters({ 
  filter, 
  setFilter, 
  viewMode, 
  setViewMode,
  searchTerm = '',
  onSearchChange = () => {},
  onClearSearch = () => {},
  isSearching = false
}: GalleryFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
      <div className="flex flex-wrap gap-3 items-center">
        <Tabs value={filter} onValueChange={setFilter} className="w-auto">
          <TabsList>
            <TabsTrigger value="all" className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              <span>All</span>
            </TabsTrigger>
            <TabsTrigger value="images" className="flex items-center gap-1">
              <Image className="h-4 w-4" />
              <span>Images</span>
            </TabsTrigger>
            <TabsTrigger value="videos" className="flex items-center gap-1">
              <Video className="h-4 w-4" />
              <span>Videos</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        
        {searchTerm !== undefined && onSearchChange && (
          <SearchToolbar
            searchTerm={searchTerm}
            onSearchChange={onSearchChange}
            onClearSearch={onClearSearch}
            isSearching={isSearching}
            className="my-1"
          />
        )}
      </div>
      
      <div className="flex-shrink-0 flex">
        <div className="border rounded-md overflow-hidden flex">
          <Button 
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className="rounded-none border-0"
          >
            <Grid className="h-4 w-4" />
            <span className="sr-only">Grid View</span>
          </Button>
          <Button 
            variant={viewMode === 'table' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('table')}
            className="rounded-none border-0"
          >
            <List className="h-4 w-4" />
            <span className="sr-only">Table View</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
