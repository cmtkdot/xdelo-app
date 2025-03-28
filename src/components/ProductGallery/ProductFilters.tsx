
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';

export interface FilterState {
  category: string;
  searchTerm: string;
  dateRange: { from: Date | null; to: Date | null };
}

export interface ProductFiltersProps {
  vendors: string[];
  filters: FilterState;
  onFilterChange: (newFilterState: Partial<FilterState>) => void;
}

const ProductFilters: React.FC<ProductFiltersProps> = ({ vendors, filters, onFilterChange }) => {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ searchTerm: e.target.value });
  };

  const handleCategoryChange = (value: string) => {
    onFilterChange({ category: value });
  };

  const handleDateFromChange = (date: Date | null) => {
    onFilterChange({ 
      dateRange: { ...filters.dateRange, from: date } 
    });
  };

  const handleDateToChange = (date: Date | null) => {
    onFilterChange({ 
      dateRange: { ...filters.dateRange, to: date } 
    });
  };

  const clearFilters = () => {
    onFilterChange({
      category: "all",
      searchTerm: "",
      dateRange: { from: null, to: null },
    });
  };

  const isFiltersApplied = 
    filters.category !== "all" || 
    filters.searchTerm !== "" || 
    filters.dateRange.from !== null || 
    filters.dateRange.to !== null;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search products..."
              value={filters.searchTerm}
              onChange={handleSearchChange}
              className="w-full"
            />
          </div>
          
          <div className="w-full md:w-48">
            <Select 
              value={filters.category} 
              onValueChange={handleCategoryChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {vendors.map(vendor => (
                  <SelectItem key={vendor} value={vendor}>
                    {vendor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex space-x-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "justify-start text-left font-normal w-[120px]",
                    !filters.dateRange.from && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateRange.from ? (
                    format(filters.dateRange.from, "PPP")
                  ) : (
                    <span>From date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={filters.dateRange.from || undefined}
                  onSelect={handleDateFromChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "justify-start text-left font-normal w-[120px]",
                    !filters.dateRange.to && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filters.dateRange.to ? (
                    format(filters.dateRange.to, "PPP")
                  ) : (
                    <span>To date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={filters.dateRange.to || undefined}
                  onSelect={handleDateToChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            
            {isFiltersApplied && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={clearFilters}
                className="flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProductFilters;
