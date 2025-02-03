import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Search, X } from "lucide-react";
import { format } from "date-fns";

export interface FilterValues {
  search: string;
  vendor: string;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  sortOrder: "desc" | "asc";
}

interface ProductFiltersProps {
  vendors: string[];
  filters: FilterValues;
  onFilterChange: (filters: FilterValues) => void;
}

export const ProductFilters = ({ vendors, filters, onFilterChange }: ProductFiltersProps) => {
  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: filters.dateFrom,
    to: filters.dateTo,
  });

  const handleSearchChange = (value: string) => {
    onFilterChange({ ...filters, search: value });
  };

  const handleVendorChange = (value: string) => {
    onFilterChange({ ...filters, vendor: value });
  };

  const handleDateChange = (range: { from: Date | undefined; to: Date | undefined }) => {
    setDateRange(range);
    onFilterChange({
      ...filters,
      dateFrom: range.from,
      dateTo: range.to,
    });
  };

  const handleSortChange = (value: "desc" | "asc") => {
    onFilterChange({ ...filters, sortOrder: value });
  };

  const clearFilters = () => {
    setDateRange({ from: undefined, to: undefined });
    onFilterChange({
      search: "",
      vendor: "",
      dateFrom: undefined,
      dateTo: undefined,
      sortOrder: "desc",
    });
  };

  const hasActiveFilters =
    filters.search ||
    filters.vendor ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.sortOrder !== "desc";

  return (
    <div className="space-y-4 mb-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={filters.search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={filters.vendor} onValueChange={handleVendorChange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Select vendor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All vendors</SelectItem>
            {vendors.map((vendor) => (
              <SelectItem key={vendor} value={vendor}>
                {vendor}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full sm:w-[240px] justify-start text-left font-normal"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "LLL dd, y")} -{" "}
                    {format(dateRange.to, "LLL dd, y")}
                  </>
                ) : (
                  format(dateRange.from, "LLL dd, y")
                )
              ) : (
                "Select date range"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange.from}
              selected={dateRange}
              onSelect={handleDateChange}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
        <Select value={filters.sortOrder} onValueChange={handleSortChange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Newest first</SelectItem>
            <SelectItem value="asc">Oldest first</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {hasActiveFilters && (
        <Button
          variant="outline"
          size="sm"
          onClick={clearFilters}
          className="flex items-center"
        >
          <X className="mr-2 h-4 w-4" />
          Clear filters
        </Button>
      )}
    </div>
  );
};