import { Button } from "@/components/ui/button";
import { Grid3X3, ImageIcon, Film, Grid, Table, CalendarDays, ArrowUpDown, Search } from "lucide-react";
import { VendorFilter } from "./Filters/VendorFilter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateFieldFilter } from "./Filters/DateFieldFilter";
import { SortOrderFilter } from "./Filters/SortOrderFilter";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface GalleryFiltersProps {
  filter: string;
  setFilter: (filter: string) => void;
  viewMode: 'grid' | 'table';
  setViewMode: (mode: 'grid' | 'table') => void;
  vendorFilter?: string[];
  vendors?: string[];
  onVendorFilterChange?: (value: string[]) => void;
  dateField?: 'purchase_date' | 'created_at';
  onDateFieldChange?: (value: 'purchase_date' | 'created_at') => void;
  sortOrder?: 'asc' | 'desc';
  onSortOrderChange?: (value: 'asc' | 'desc') => void;
  searchTerm?: string;
  onSearchChange?: (value: string) => void;
}

export const GalleryFilters = ({ 
  filter, 
  setFilter, 
  viewMode, 
  setViewMode,
  vendorFilter = [],
  vendors = [],
  onVendorFilterChange,
  dateField = 'purchase_date',
  onDateFieldChange,
  sortOrder = 'desc',
  onSortOrderChange,
  searchTerm = '',
  onSearchChange
}: GalleryFiltersProps) => {
  const [inputValue, setInputValue] = useState(searchTerm);
  
  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSearchChange) {
      onSearchChange(inputValue);
    }
  };
  
  const handleSearchClick = () => {
    if (onSearchChange) {
      onSearchChange(inputValue);
    }
  };
  
  const handleClearSearch = () => {
    setInputValue('');
    if (onSearchChange) {
      onSearchChange('');
    }
  };
  
  return (
    <div className="space-y-4 mb-4">
      {/* Search input */}
      {onSearchChange && (
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Input
              placeholder="Search by product name, code, vendor or caption..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleSearch}
              className="pr-8"
            />
            {inputValue && (
              <button 
                onClick={handleClearSearch}
                className="absolute right-8 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute right-0 top-0 h-full"
              onClick={handleSearchClick}
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      
      <div className="flex flex-wrap justify-between gap-2">
        <div className="flex flex-wrap gap-2 items-center">
          <Button 
            variant={filter === "all" ? "default" : "outline"} 
            onClick={() => setFilter("all")}
            className="transition-all duration-200 ease-in-out"
            size="sm"
          >
            <Grid3X3 className="mr-2 h-4 w-4" />
            All
          </Button>
          <Button 
            variant={filter === "images" ? "default" : "outline"} 
            onClick={() => setFilter("images")}
            className="transition-all duration-200 ease-in-out"
            size="sm"
          >
            <ImageIcon className="mr-2 h-4 w-4" />
            Images
          </Button>
          <Button 
            variant={filter === "videos" ? "default" : "outline"} 
            onClick={() => setFilter("videos")}
            className="transition-all duration-200 ease-in-out"
            size="sm"
          >
            <Film className="mr-2 h-4 w-4" />
            Videos
          </Button>
          
          {onVendorFilterChange && vendors.length > 0 && (
            <VendorFilter 
              value={vendorFilter} 
              vendors={vendors} 
              onChange={onVendorFilterChange} 
            />
          )}

          {onDateFieldChange && (
            <DateFieldFilter
              value={dateField}
              onChange={onDateFieldChange}
            />
          )}

          {onSortOrderChange && (
            <SortOrderFilter
              value={sortOrder}
              onChange={onSortOrderChange}
            />
          )}
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant={viewMode === "grid" ? "default" : "outline"} 
            onClick={() => setViewMode("grid")}
            className="transition-all duration-200 ease-in-out"
            size="sm"
          >
            <Grid className="mr-2 h-4 w-4" />
            Grid
          </Button>
          <Button 
            variant={viewMode === "table" ? "default" : "outline"} 
            onClick={() => setViewMode("table")}
            className="transition-all duration-200 ease-in-out"
            size="sm"
          >
            <Table className="mr-2 h-4 w-4" />
            Table
          </Button>
        </div>
      </div>
    </div>
  );
};
