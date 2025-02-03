import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Filter, Search, Tag, Users, Package2, AlertCircle } from "lucide-react";
import { FilterValues, ProcessingState } from "@/types";
import debounce from 'lodash/debounce';
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

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
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(filters.sortOrder);
  const [productCode, setProductCode] = useState(filters.productCode || '');
  const [quantityRange, setQuantityRange] = useState(filters.quantityRange || 'all');
  const [processingState, setProcessingState] = useState<ProcessingState | "all">(filters.processingState || 'all');
  const [productCodes, setProductCodes] = useState<string[]>([]);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  useEffect(() => {
    const fetchProductCodes = async () => {
      // Query only original caption messages to avoid duplicates
      const { data, error } = await supabase
        .from('messages')
        .select('analyzed_content')
        .eq('is_original_caption', true)
        .not('analyzed_content', 'is', null);

      if (!error && data) {
        const uniqueCodes = [...new Set(data
          .map(item => {
            const content = item.analyzed_content as { product_code?: string };
            return content?.product_code;
          })
          .filter(Boolean)
        )];
        setProductCodes(uniqueCodes);
      }
    };

    fetchProductCodes();
  }, []);

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

  const debouncedFilterChange = debounce((newFilters: FilterValues) => {
    onFilterChange(newFilters);
  }, 300);

  useEffect(() => {
    debouncedFilterChange({
      search,
      vendor,
      dateFrom,
      dateTo,
      sortOrder,
      productCode,
      quantityRange,
      processingState
    });
  }, [search, vendor, dateFrom, dateTo, sortOrder, productCode, quantityRange, processingState]);

  const FilterContent = () => (
    <div className="flex flex-col space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Search className="w-4 h-4" />
            Search
          </label>
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full"
          />
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Tag className="w-4 h-4" />
            Product Code
          </label>
          <Select value={productCode} onValueChange={setProductCode}>
            <SelectTrigger>
              <SelectValue placeholder="Select Product Code" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Product Codes</SelectItem>
              {productCodes.map((code) => (
                <SelectItem key={code} value={code}>{code}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Package2 className="w-4 h-4" />
            Quantity
          </label>
          <Select value={quantityRange} onValueChange={setQuantityRange}>
            <SelectTrigger>
              <SelectValue placeholder="Quantity Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Quantities</SelectItem>
              <SelectItem value="undefined">Undefined</SelectItem>
              <SelectItem value="1-5">1-5</SelectItem>
              <SelectItem value="6-10">6-10</SelectItem>
              <SelectItem value="11-15">11-15</SelectItem>
              <SelectItem value="16-20">16-20</SelectItem>
              <SelectItem value="21+">21+</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Users className="w-4 h-4" />
            Vendor
          </label>
          <Select value={vendor} onValueChange={setVendor}>
            <SelectTrigger>
              <SelectValue placeholder="Select Vendor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vendors</SelectItem>
              {vendors.map((v) => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Processing State
          </label>
          <Select 
            value={processingState} 
            onValueChange={(value: ProcessingState | "all") => setProcessingState(value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Processing State" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="initialized">Initialized</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            Sort Order
          </label>
          <Select value={sortOrder} onValueChange={(value: "asc" | "desc") => setSortOrder(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Sort Order" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">Oldest First</SelectItem>
              <SelectItem value="desc">Newest First</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <CalendarIcon className="w-4 h-4" />
            Date Range
          </label>
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[150px]">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {dateFrom ? format(dateFrom, 'MM/dd/yyyy') : 'From'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={setDateFrom}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[150px]">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {dateTo ? format(dateTo, 'MM/dd/yyyy') : 'To'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateTo}
                  onSelect={setDateTo}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
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