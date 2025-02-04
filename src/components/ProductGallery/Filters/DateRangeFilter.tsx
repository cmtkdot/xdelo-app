import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CalendarIcon } from "lucide-react";

interface DateRangeFilterProps {
  dateField: 'purchase_date' | 'created_at' | 'updated_at';
  sortOrder: "asc" | "desc";
  onDateFieldChange: (field: 'purchase_date' | 'created_at' | 'updated_at') => void;
  onSortOrderChange: (order: "asc" | "desc") => void;
}

export const DateRangeFilter = ({ 
  dateField,
  sortOrder,
  onDateFieldChange,
  onSortOrderChange
}: DateRangeFilterProps) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium flex items-center gap-1">
          <CalendarIcon className="w-3 h-3" />
          Sort by
        </label>
        <Select value={dateField} onValueChange={onDateFieldChange}>
          <SelectTrigger className="h-7 text-xs w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="purchase_date">Purchase Date</SelectItem>
            <SelectItem value="created_at">Created Date</SelectItem>
            <SelectItem value="updated_at">Updated Date</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center space-x-2">
          <Switch
            id="sort-order"
            checked={sortOrder === "asc"}
            onCheckedChange={(checked) => onSortOrderChange(checked ? "asc" : "desc")}
          />
          <Label htmlFor="sort-order" className="text-xs">Ascending</Label>
        </div>
      </div>
    </div>
  );
};