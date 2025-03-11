
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface GLProductFiltersProps {
  search: string;
  showUntitled: boolean;
  sortField: "purchase_date" | "created_at";
  sortOrder: "asc" | "desc";
  onSearchChange: (value: string) => void;
  onShowUntitledChange: (value: boolean) => void;
  onSortFieldChange: (value: "purchase_date" | "created_at") => void;
  onSortOrderChange: (value: "asc" | "desc") => void;
}

export function GLProductFilters({
  search,
  showUntitled,
  sortField,
  sortOrder,
  onSearchChange,
  onShowUntitledChange,
  onSortFieldChange,
  onSortOrderChange
}: GLProductFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Search products..."
          className="pl-10"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      
      <div className="flex flex-wrap gap-4 items-center">
        <div className="w-40">
          <Select value={sortField} onValueChange={(value) => onSortFieldChange(value as "purchase_date" | "created_at")}>
            <SelectTrigger>
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="purchase_date">Purchase Date</SelectItem>
              <SelectItem value="created_at">Created Date</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="w-40">
          <Select value={sortOrder} onValueChange={(value) => onSortOrderChange(value as "asc" | "desc")}>
            <SelectTrigger>
              <SelectValue placeholder="Order" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Newest First</SelectItem>
              <SelectItem value="asc">Oldest First</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="show-untitled" 
            checked={showUntitled} 
            onCheckedChange={(checked) => onShowUntitledChange(checked as boolean)}
          />
          <Label htmlFor="show-untitled" className="cursor-pointer">
            Show untitled products
          </Label>
        </div>
      </div>
    </div>
  );
}
