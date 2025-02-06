import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CalendarRange, ArrowUpDown } from "lucide-react";

interface DateRangeFilterProps {
  dateField: 'purchase_date' | 'created_at';
  sortOrder: "asc" | "desc";
  onDateFieldChange: (field: 'purchase_date' | 'created_at') => void;
  onSortOrderChange: (order: "asc" | "desc") => void;
}

export const DateRangeFilter = ({ 
  dateField,
  sortOrder,
  onDateFieldChange,
  onSortOrderChange
}: DateRangeFilterProps) => {
  return (
    <div className="flex items-end gap-4">
      <div className="space-y-2 min-w-[160px]">
        <Label className="text-xs font-medium flex items-center justify-center gap-1">
          <CalendarRange className="w-3 h-3" />
          Sort by Date
        </Label>
        <Select value={dateField} onValueChange={onDateFieldChange}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="purchase_date">Purchase Date</SelectItem>
            <SelectItem value="created_at">Created Date</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="text-xs font-medium flex items-center justify-center gap-1">
          <ArrowUpDown className="w-3 h-3" />
          Order
        </Label>
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