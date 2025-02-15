import { useState, useEffect } from "react";
import { FilterValues } from "@/types";
import { Filter, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchFilter } from "./Filters/SearchFilter";
import { QuantityFilter } from "./Filters/QuantityFilter";
import { VendorFilter } from "./Filters/VendorFilter";
import { SortOrderFilter } from "./Filters/SortOrderFilter";
import { DateFieldFilter } from "./Filters/DateFieldFilter";

interface ProductFiltersProps {
  vendors: string[];
  filters: FilterValues;
  onFilterChange: (filters: FilterValues) => void;
}

export default function ProductFilters({ vendors, filters, onFilterChange }: ProductFiltersProps) {
  const [search, setSearch] = useState(filters.search);
  const [vendor, setVendor] = useState(filters.vendor);
  const [dateField, setDateField] = useState<'purchase_date' | 'created_at'>(filters.dateField);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(filters.sortOrder);
  const [quantityRange, setQuantityRange] = useState(filters.quantityRange || 'all');
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  useEffect(() => {
    let count = 0;
    if (search) count++;
    if (vendor !== 'all') count++;
    if (quantityRange !== 'all') count++;
    setActiveFiltersCount(count);
  }, [search, vendor, quantityRange]);

  useEffect(() => {
    onFilterChange({
      search,
      vendor,
      dateField,
      sortOrder,
      quantityRange,
      processingState: 'completed'
    });
  }, [search, vendor, dateField, sortOrder, quantityRange, onFilterChange]);

  const handleReset = () => {
    setSearch("");
    setVendor("all");
    setDateField('purchase_date');
    setSortOrder("desc");
    setQuantityRange('all');
    
    onFilterChange({
      search: "",
      vendor: "all",
      dateField: 'purchase_date',
      sortOrder: "desc",
      quantityRange: 'all',
      processingState: 'completed'
    });
  };

  const FilterContent = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6 flex-1">
          <div className="flex-1">
            <SearchFilter value={search} onChange={setSearch} />
          </div>
          <VendorFilter value={vendor} vendors={vendors} onChange={setVendor} />
          <QuantityFilter value={quantityRange} onChange={setQuantityRange} />
          <div className="ml-auto flex items-center gap-4">
            <DateFieldFilter value={dateField} onChange={setDateField} />
            <SortOrderFilter value={sortOrder} onChange={setSortOrder} />
          </div>
        </div>
        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-2"
            onClick={handleReset}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="lg:hidden">
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <FilterContent />
          </div>
        </SheetContent>
      </Sheet>
      <div className="hidden lg:block">
        <FilterContent />
      </div>
    </div>
  );
}