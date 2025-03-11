
import { useState, useEffect, useCallback } from "react";
import { FilterValues } from "@/types";
import { Filter, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchFilter } from "./Filters/SearchFilter";
import { VendorFilter } from "./Filters/VendorFilter";
import { DateRangeFilter } from "./Filters/DateRangeFilter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface ProductFiltersProps {
  vendors: string[];
  filters: FilterValues;
  onFilterChange: (filters: FilterValues) => void;
}

export default function ProductFilters({ vendors, filters, onFilterChange }: ProductFiltersProps) {
  const [search, setSearch] = useState(filters.search);
  const [selectedVendors, setSelectedVendors] = useState<string[]>(filters.vendors || []);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(filters.sortOrder || "desc");
  const [sortField, setSortField] = useState<"purchase_date" | "updated_at">(filters.sortField as any || "purchase_date");
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | null>(filters.dateRange || null);
  const [showUntitled, setShowUntitled] = useState<boolean>(filters.showUntitled || false);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  useEffect(() => {
    let count = 0;
    if (search) count++;
    if (selectedVendors.length > 0) count++;
    if (dateRange) count++;
    if (sortField !== "purchase_date") count++;
    if (showUntitled) count++;
    setActiveFiltersCount(count);
  }, [search, selectedVendors, dateRange, sortField, showUntitled]);

  const handleFilterChange = useCallback(() => {
    onFilterChange({
      search,
      vendors: selectedVendors,
      sortOrder,
      sortField,
      dateRange,
      showUntitled,
      processingState: ['completed']
    });
  }, [search, selectedVendors, sortOrder, sortField, dateRange, showUntitled, onFilterChange]);

  useEffect(() => {
    handleFilterChange();
  }, [handleFilterChange]);

  const resetFilters = () => {
    setSearch("");
    setSelectedVendors([]);
    setSortOrder("desc");
    setSortField("purchase_date");
    setDateRange(null);
    setShowUntitled(false);
  };

  const handleSortOrderChange = (value: string) => {
    setSortOrder(value as "asc" | "desc");
  };

  const handleSortFieldChange = (value: string) => {
    setSortField(value as "purchase_date" | "updated_at");
  };

  const FilterContent = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <SearchFilter value={search} onChange={setSearch} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Vendor</Label>
          <VendorFilter 
            value={selectedVendors}
            vendors={vendors} 
            onChange={setSelectedVendors}
          />
        </div>

        <DateRangeFilter value={dateRange} onChange={setDateRange} />

        <div className="space-y-2">
          <Label className="text-sm font-medium">Sort By</Label>
          <Select value={sortField} onValueChange={handleSortFieldChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="purchase_date">Purchase Date</SelectItem>
              <SelectItem value="updated_at">Updated At</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Sort Order</Label>
          <Select value={sortOrder} onValueChange={handleSortOrderChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Newest First</SelectItem>
              <SelectItem value="asc">Oldest First</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center space-x-2 pt-2">
        <Checkbox 
          id="show-untitled-products" 
          checked={showUntitled}
          onCheckedChange={(checked) => setShowUntitled(checked as boolean)}
        />
        <Label htmlFor="show-untitled-products" className="cursor-pointer">
          Show untitled products
        </Label>
      </div>

      {activeFiltersCount > 0 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-muted-foreground">
            {activeFiltersCount} active filter{activeFiltersCount !== 1 ? 's' : ''}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="h-8 px-2 text-xs"
          >
            <X className="w-3 h-3 mr-1" />
            Clear all
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop view */}
      <div className="hidden md:block">
        <FilterContent />
      </div>

      {/* Mobile view */}
      <div className="md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="w-full">
              <Filter className="w-4 h-4 mr-2" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[85vh] px-4">
            <SheetHeader>
              <div className="flex items-center justify-between">
                <SheetTitle>Filters</SheetTitle>
                {activeFiltersCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    className="h-8"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Clear all
                  </Button>
                )}
              </div>
            </SheetHeader>
            <div className="mt-4">
              <FilterContent />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
