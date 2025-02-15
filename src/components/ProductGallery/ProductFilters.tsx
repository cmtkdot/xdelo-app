import { useState, useEffect } from "react";
import { FilterValues } from "@/types";
import { Filter, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchFilter } from "./Filters/SearchFilter";
import { VendorFilter } from "./Filters/VendorFilter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

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
  const [sortBy, setSortBy] = useState(filters.sortBy);
  const [hasGlideMatch, setHasGlideMatch] = useState(filters.hasGlideMatch);
  const [chatId, setChatId] = useState(filters.chatId || '');
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  useEffect(() => {
    let count = 0;
    if (search) count++;
    if (vendor !== 'all') count++;
    if (hasGlideMatch !== undefined) count++;
    if (chatId) count++;
    setActiveFiltersCount(count);
  }, [search, vendor, hasGlideMatch, chatId]);

  useEffect(() => {
    onFilterChange({
      search,
      vendor,
      dateField,
      sortOrder,
      sortBy,
      processingState: 'completed',
      hasGlideMatch,
      chatId: chatId || undefined
    });
  }, [search, vendor, dateField, sortOrder, sortBy, hasGlideMatch, chatId]);

  const resetFilters = () => {
    setSearch("");
    setVendor("all");
    setDateField('purchase_date');
    setSortOrder("desc");
    setSortBy('date');
    setHasGlideMatch(undefined);
    setChatId('');
  };

  const FilterContent = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <SearchFilter value={search} onChange={setSearch} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Vendor</Label>
          <VendorFilter value={vendor} vendors={vendors} onChange={setVendor} />
        </div>

        <div className="space-y-2">
          <Label>Sort By</Label>
          <div className="flex gap-2">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="product_name">Product Name</SelectItem>
                <SelectItem value="vendor">Vendor</SelectItem>
                <SelectItem value="chat_id">Chat ID</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Ascending</SelectItem>
                <SelectItem value="desc">Descending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Date Field</Label>
          <Select value={dateField} onValueChange={setDateField}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="purchase_date">Purchase Date</SelectItem>
              <SelectItem value="created_at">Created At</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Chat ID</Label>
          <Input 
            value={chatId} 
            onChange={(e) => setChatId(e.target.value)}
            placeholder="Enter chat ID..."
          />
        </div>

        <div className="space-y-2">
          <Label>Glide Match Status</Label>
          <div className="flex items-center space-x-2">
            <Switch
              checked={hasGlideMatch === true}
              onCheckedChange={(checked) => {
                if (checked === hasGlideMatch) {
                  setHasGlideMatch(undefined);
                } else {
                  setHasGlideMatch(checked);
                }
              }}
            />
            <span className="text-sm text-muted-foreground">
              {hasGlideMatch === undefined 
                ? "Show All" 
                : hasGlideMatch 
                  ? "Has Glide Match" 
                  : "No Glide Match"}
            </span>
          </div>
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