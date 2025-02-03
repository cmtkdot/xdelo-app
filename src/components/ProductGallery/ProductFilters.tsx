import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { FilterValues } from "@/types";
import debounce from 'lodash/debounce';

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
  const [quantity, setQuantity] = useState<number | undefined>(filters.quantity);
  const [processingState, setProcessingState] = useState(filters.processingState || 'all');

  // Debounced filter change for real-time search
  const debouncedFilterChange = debounce((newFilters: FilterValues) => {
    onFilterChange(newFilters);
  }, 300);

  // Effect for real-time search
  useEffect(() => {
    debouncedFilterChange({
      search,
      vendor,
      dateFrom,
      dateTo,
      sortOrder,
      productCode,
      quantity,
      processingState
    });
  }, [search, vendor, dateFrom, dateTo, sortOrder, productCode, quantity, processingState]);

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search product name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:w-64"
        />
        
        <Input
          placeholder="Product Code (PO#)"
          value={productCode}
          onChange={(e) => setProductCode(e.target.value)}
          className="w-full md:w-48"
        />

        <Input
          type="number"
          placeholder="Quantity"
          value={quantity || ''}
          onChange={(e) => setQuantity(e.target.value ? Number(e.target.value) : undefined)}
          className="w-full md:w-32"
        />

        <Select value={vendor} onValueChange={setVendor}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Select Vendor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Vendors</SelectItem>
            {vendors.map((v) => (
              <SelectItem key={v} value={v}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={processingState} onValueChange={setProcessingState}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Processing State" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <CalendarIcon className="w-4 h-4 mr-2" />
              {dateFrom ? format(dateFrom, 'MM/dd/yyyy') : 'From'}
            </Button>
          </PopoverTrigger>
          <PopoverContent>
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
            <Button variant="outline">
              <CalendarIcon className="w-4 h-4 mr-2" />
              {dateTo ? format(dateTo, 'MM/dd/yyyy') : 'To'}
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <Calendar
              mode="single"
              selected={dateTo}
              onSelect={setDateTo}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <Select value={sortOrder} onValueChange={(value: "asc" | "desc") => setSortOrder(value)}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="Sort Order" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="asc">Oldest First</SelectItem>
            <SelectItem value="desc">Newest First</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}