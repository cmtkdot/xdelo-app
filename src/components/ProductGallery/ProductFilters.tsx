import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { FilterValues } from "@/types";

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

  const handleApplyFilters = () => {
    onFilterChange({ search, vendor, dateFrom, dateTo, sortOrder });
  };

  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-4 md:space-y-0">
      <div className="flex items-center space-x-2">
        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={vendor} onValueChange={setVendor}>
          <SelectTrigger>
            <SelectValue placeholder="Select Vendor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Vendors</SelectItem>
            {vendors.map((vendor) => (
              <SelectItem key={vendor} value={vendor}>
                {vendor}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <CalendarIcon className="w-4 h-4" />
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
              <CalendarIcon className="w-4 h-4" />
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
        <Select 
          value={sortOrder} 
          onValueChange={(value: "asc" | "desc") => setSortOrder(value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Sort Order" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="asc">Ascending</SelectItem>
            <SelectItem value="desc">Descending</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleApplyFilters}>Apply Filters</Button>
      </div>
    </div>
  );
}