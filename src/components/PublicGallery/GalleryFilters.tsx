
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LayoutGrid, List, SlidersHorizontal, Search } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface GalleryFiltersProps {
  filter: string;
  setFilter: (filter: string) => void;
  viewMode: 'grid' | 'table';
  setViewMode: (mode: 'grid' | 'table') => void;
  vendorFilter: string[];
  vendors: string[];
  onVendorFilterChange: (vendors: string[]) => void;
  dateField: 'purchase_date' | 'created_at';
  onDateFieldChange: (field: 'purchase_date' | 'created_at') => void;
  sortOrder: 'asc' | 'desc';
  onSortOrderChange: (order: 'asc' | 'desc') => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

export function GalleryFilters({
  filter,
  setFilter,
  viewMode,
  setViewMode,
  vendorFilter,
  vendors,
  onVendorFilterChange,
  dateField,
  onDateFieldChange,
  sortOrder,
  onSortOrderChange,
  searchTerm,
  onSearchChange,
}: GalleryFiltersProps) {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.target.value);
  };

  const toggleVendorFilter = (vendor: string) => {
    if (vendorFilter.includes(vendor)) {
      onVendorFilterChange(vendorFilter.filter(v => v !== vendor));
    } else {
      onVendorFilterChange([...vendorFilter, vendor]);
    }
  };

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="w-4 h-4 text-gray-500" />
            </div>
            <Input
              type="search"
              placeholder="Search gallery..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="pl-10"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            {/* Media Type Filter */}
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Media Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Media</SelectItem>
                <SelectItem value="images">Images Only</SelectItem>
                <SelectItem value="videos">Videos Only</SelectItem>
              </SelectContent>
            </Select>

            {/* Advanced Filters */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Filter Options</DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                <div className="p-2">
                  <Label className="text-xs font-medium">Date Field</Label>
                  <Select
                    value={dateField}
                    onValueChange={(value) => onDateFieldChange(value as 'purchase_date' | 'created_at')}
                  >
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue placeholder="Date Field" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="created_at">Upload Date</SelectItem>
                      <SelectItem value="purchase_date">Purchase Date</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-2">
                  <Label className="text-xs font-medium">Sort Order</Label>
                  <Select
                    value={sortOrder}
                    onValueChange={(value) => onSortOrderChange(value as 'asc' | 'desc')}
                  >
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue placeholder="Sort Order" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desc">Newest First</SelectItem>
                      <SelectItem value="asc">Oldest First</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {vendors.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Vendor</DropdownMenuLabel>
                    <div className="max-h-40 overflow-y-auto">
                      {vendors.map((vendor) => (
                        <DropdownMenuCheckboxItem
                          key={vendor}
                          checked={vendorFilter.includes(vendor)}
                          onCheckedChange={() => toggleVendorFilter(vendor)}
                        >
                          {vendor}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </div>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* View Mode Toggle */}
            <div className="flex border rounded-md overflow-hidden">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('grid')}
                className="rounded-none border-0"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('table')}
                className="rounded-none border-0"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
