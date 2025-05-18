import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Film, Grid, Grid3X3, ImageIcon, Search, Table } from "lucide-react";
import { useState } from "react";
import { DateFieldFilter } from "./filters/DateFieldFilter";
import { SortOrderFilter } from "./filters/SortOrderFilter";
import { VendorFilter } from "./filters/VendorFilter";

interface GalleryFiltersProps {
  filter: string;
  setFilter: (filter: string) => void;
  viewMode: "grid" | "table";
  setViewMode: (mode: "grid" | "table") => void;
  vendorFilter?: string[];
  vendors?: string[];
  onVendorFilterChange?: (value: string[]) => void;
  dateField?: "created_at" | "updated_at";
  onDateFieldChange?: (value: "created_at" | "updated_at") => void;
  sortOrder?: "asc" | "desc";
  onSortOrderChange?: (value: "asc" | "desc") => void;
  searchTerm?: string;
  onSearchChange?: (value: string) => void;
  hideSearch?: boolean;
}

export function GalleryFilters({
  filter,
  setFilter,
  viewMode,
  setViewMode,
  searchTerm,
  onSearchChange,
  vendorFilter,
  vendors,
  onVendorFilterChange,
  dateField,
  onDateFieldChange,
  sortOrder = "desc",
  onSortOrderChange,
  searchTerm = "",
  onSearchChange,
  hideSearch = false,
}: GalleryFiltersProps) => {
  const [inputValue, setInputValue] = useState(searchTerm);

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && onSearchChange) {
      onSearchChange(inputValue);
    }
  };

  const handleSearchClick = () => {
    if (onSearchChange) {
      onSearchChange(inputValue);
    }
  };

  const handleClearSearch = () => {
    setInputValue("");
    if (onSearchChange) {
      onSearchChange("");
    }
  };

  return (
    <div className="space-y-4 mb-4">
      {/* Search input - conditionally rendered */}
      {onSearchChange && !hideSearch && (
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

      <div>
        <Label className="text-sm font-medium">Filter</Label>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Items</SelectItem>
            <SelectItem value="images">Images Only</SelectItem>
            <SelectItem value="videos">Videos Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-sm font-medium">View Mode</Label>
        <div className="flex gap-2 mt-1">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            Grid
          </Button>
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('table')}
          >
            Table
          </Button>
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium">Sort By</Label>
        <Select value={dateField} onValueChange={onDateFieldChange}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at">Created Date</SelectItem>
            <SelectItem value="purchase_date">Purchase Date</SelectItem>
            <SelectItem value="updated_at">Updated Date</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-sm font-medium">Sort Order</Label>
        <Select value={sortOrder} onValueChange={onSortOrderChange}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Newest First</SelectItem>
            <SelectItem value="asc">Oldest First</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {vendors && vendors.length > 0 && (
        <div>
          <Label className="text-sm font-medium">Vendors</Label>
          <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
            {vendors.map((vendor) => (
              <div key={vendor} className="flex items-center space-x-2">
                <Checkbox
                  id={vendor}
                  checked={vendorFilter.includes(vendor)}
                  onCheckedChange={() => handleVendorToggle(vendor)}
                />
                <Label htmlFor={vendor} className="text-sm">
                  {vendor}
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
