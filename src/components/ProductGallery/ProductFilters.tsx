import { useState, useEffect } from "react";
import { FilterValues, ProcessingState } from "@/types";
import { Filter, X } from "lucide-react";
import debounce from 'lodash/debounce';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchFilter } from "./Filters/SearchFilter";
import { ProductCodeFilter } from "./Filters/ProductCodeFilter";
import { QuantityFilter } from "./Filters/QuantityFilter";
import { VendorFilter } from "./Filters/VendorFilter";
import { ProcessingStateFilter } from "./Filters/ProcessingStateFilter";
import { DateRangeFilter } from "./Filters/DateRangeFilter";
import { Separator } from "@/components/ui/separator";

interface ProductFiltersProps {
  vendors: string[];
  filters: FilterValues;
  onFilterChange: (filters: FilterValues) => void;
}

export default function ProductFilters({ vendors, filters, onFilterChange }: ProductFiltersProps) {
  const [search, setSearch] = useState(filters.search);
  const [vendor, setVendor] = useState(filters.vendor);
  const [dateField, setDateField] = useState<'purchase_date' | 'created_at' | 'updated_at'>(filters.dateField);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(filters.sortOrder);
  const [quantityRange, setQuantityRange] = useState(filters.quantityRange || 'all');
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  // Count active filters
  useEffect(() => {
    let count = 0;
    if (search) count++;
    if (vendor !== 'all') count++;
    if (quantityRange !== 'all') count++;
    setActiveFiltersCount(count);
  }, [search, vendor, quantityRange]);

  // Debounce filter changes
  const debouncedFilterChange = debounce((newFilters: FilterValues) => {
    onFilterChange(newFilters);
  }, 300);

  // Update filters when any value changes
  useEffect(() => {
    debouncedFilterChange({
      search,
      vendor,
      dateField,
      sortOrder,
      quantityRange,
      processingState: 'completed'
    });
  }, [search, vendor, dateField, sortOrder, quantityRange]);

  const resetFilters = () => {
    setSearch("");
    setVendor("all");
    setDateField('purchase_date');
    setSortOrder("desc");
    setQuantityRange('all');
  };

  const FilterContent = () => (
    <div className="flex flex-col space-y-6">
      <div className="w-full">
        <SearchFilter value={search} onChange={setSearch} />
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <VendorFilter value={vendor} vendors={vendors} onChange={setVendor} />
          <QuantityFilter value={quantityRange} onChange={setQuantityRange} />
          <DateRangeFilter
            dateField={dateField}
            sortOrder={sortOrder}
            onDateFieldChange={setDateField}
            onSortOrderChange={setSortOrder}
          />
        </div>
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
            <div className="mt-6 overflow-y-auto pb-20">
              <FilterContent />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}