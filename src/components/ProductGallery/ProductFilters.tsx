import { useState, useEffect } from "react";
import { FilterValues, ProcessingState } from "@/types";
import { Filter } from "lucide-react";
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

interface ProductFiltersProps {
  vendors: string[];
  filters: FilterValues;
  onFilterChange: (filters: FilterValues) => void;
}

export default function ProductFilters({ vendors, filters, onFilterChange }: ProductFiltersProps) {
  const [search, setSearch] = useState(filters.search);
  const [vendor, setVendor] = useState(filters.vendor);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(filters.dateFrom);
  const [dateTo, setDateTo] = useState<Date | undefined>(filters.dateTo);
  const [dateField, setDateField] = useState<'purchase_date' | 'created_at' | 'updated_at'>(filters.dateField || 'purchase_date');
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(filters.sortOrder);
  const [productCode, setProductCode] = useState(filters.productCode || 'all');
  const [quantityRange, setQuantityRange] = useState(filters.quantityRange || 'all');
  const [processingState, setProcessingState] = useState<ProcessingState | "all">(filters.processingState || 'all');
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  // Count active filters
  useEffect(() => {
    let count = 0;
    if (search) count++;
    if (vendor !== 'all') count++;
    if (dateFrom || dateTo) count++;
    if (productCode !== 'all') count++;
    if (quantityRange !== 'all') count++;
    if (processingState !== 'all') count++;
    setActiveFiltersCount(count);
  }, [search, vendor, dateFrom, dateTo, productCode, quantityRange, processingState]);

  // Debounce filter changes
  const debouncedFilterChange = debounce((newFilters: FilterValues) => {
    onFilterChange(newFilters);
  }, 300);

  // Update filters when any value changes
  useEffect(() => {
    debouncedFilterChange({
      search,
      vendor,
      dateFrom,
      dateTo,
      dateField,
      sortOrder,
      productCode,
      quantityRange,
      processingState
    });
  }, [search, vendor, dateFrom, dateTo, dateField, sortOrder, productCode, quantityRange, processingState]);

  const FilterContent = () => (
    <div className="flex flex-col space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <SearchFilter value={search} onChange={setSearch} />
        <ProductCodeFilter value={productCode} onChange={setProductCode} />
        <QuantityFilter value={quantityRange} onChange={setQuantityRange} />
        <VendorFilter value={vendor} vendors={vendors} onChange={setVendor} />
        <ProcessingStateFilter value={processingState} onChange={setProcessingState} />
      </div>
      <div className="flex justify-start">
        <DateRangeFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          dateField={dateField}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onDateFieldChange={setDateField}
        />
      </div>
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
          <SheetContent side="bottom" className="h-[80vh]">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="mt-4 overflow-y-auto">
              <FilterContent />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}