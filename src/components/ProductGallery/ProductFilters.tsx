import { useState, useEffect } from "react";
import { FilterValues } from "@/types";
import { Filter, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
<<<<<<< Updated upstream
<<<<<<< Updated upstream
import { SearchFilter } from "./Filters/SearchFilter";
import { QuantityFilter } from "./Filters/QuantityFilter";
import { VendorFilter } from "./Filters/VendorFilter";
import { DateRangeFilter } from "./Filters/DateRangeFilter";
=======
import { Input } from "@/components/ui/input";
import { VendorFilter } from "./Filters/VendorFilter";
import { SortOrderFilter } from "./Filters/SortOrderFilter";
import { DateFieldFilter } from "./Filters/DateFieldFilter";
>>>>>>> Stashed changes
=======
import { Input } from "@/components/ui/input";
import { VendorFilter } from "./Filters/VendorFilter";
import { SortOrderFilter } from "./Filters/SortOrderFilter";
import { DateFieldFilter } from "./Filters/DateFieldFilter";
>>>>>>> Stashed changes

interface ProductFiltersProps {
  vendors: string[];
  filters: FilterValues;
  onFilterChange: (filters: FilterValues) => void;
}

interface ProductFilters {
  search: string;
  vendor: string;
  sortOrder: "asc" | "desc";
  dateField: "created_at" | "purchase_date";
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
  }, [search, vendor, dateField, sortOrder, quantityRange]);

  const resetFilters = () => {
    setSearch("");
    setVendor("all");
    setDateField('purchase_date');
    setSortOrder("desc");
<<<<<<< Updated upstream
    setQuantityRange('all');
=======
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    onFilterChange({
      ...filters,
      search: value,
    });
  };

  const handleVendorChange = (value: string) => {
    setVendor(value);
    onFilterChange({
      ...filters,
      vendor: value,
    });
  };

  const handleSortOrderChange = (value: "asc" | "desc") => {
    setSortOrder(value);
    onFilterChange({
      ...filters,
      sortOrder: value,
    });
  };

  const handleDateFieldChange = (value: "created_at" | "purchase_date") => {
    setDateField(value);
    onFilterChange({
      ...filters,
      dateField: value,
    });
  };

  const handleReset = () => {
    setSearch("");
    setVendor("all");
    setSortOrder("desc");
    setDateField("created_at");
    onFilterChange({
      search: "",
      vendor: "all",
      sortOrder: "desc",
      dateField: "created_at",
    });
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
  };

  const FilterContent = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
<<<<<<< Updated upstream
<<<<<<< Updated upstream
        <div className="flex items-center gap-6 flex-1">
          <div className="flex-1">
            <SearchFilter value={search} onChange={setSearch} />
          </div>
          <VendorFilter value={vendor} vendors={vendors} onChange={setVendor} />
          <QuantityFilter value={quantityRange} onChange={setQuantityRange} />
          <div className="ml-auto">
            <DateRangeFilter
              dateField={dateField}
              sortOrder={sortOrder}
              onDateFieldChange={setDateField}
              onSortOrderChange={setSortOrder}
            />
          </div>
        </div>
=======
=======
>>>>>>> Stashed changes
        <div className="flex-1 min-w-[200px]">
          <Input
            type="search"
            placeholder="Search products..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="h-8"
          />
        </div>
<<<<<<< Updated upstream
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <VendorFilter
          value={vendor}
          vendors={vendors}
          onChange={handleVendorChange}
        />
        <SortOrderFilter
          value={sortOrder}
          onChange={handleSortOrderChange}
        />
        <DateFieldFilter
          value={dateField}
          onChange={handleDateFieldChange}
        />
>>>>>>> Stashed changes
      </div>
=======
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <VendorFilter
          value={vendor}
          vendors={vendors}
          onChange={handleVendorChange}
        />
        <SortOrderFilter
          value={sortOrder}
          onChange={handleSortOrderChange}
        />
        <DateFieldFilter
          value={dateField}
          onChange={handleDateFieldChange}
        />
      </div>
>>>>>>> Stashed changes
    </div>
  );

  return (
    <div>
      <div className="hidden md:block">
        <FilterContent />
      </div>

      <div className="md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="w-full">
              <Filter className="mr-2 h-4 w-4" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[96%]">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="mt-6 overflow-y-auto pb-20">
              <FilterContent />
            </div>
            <div className="mt-4 space-x-2">
              <Button onClick={resetFilters} variant="outline" size="sm">
                <X className="mr-2 h-4 w-4" />
                Reset Filters
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}