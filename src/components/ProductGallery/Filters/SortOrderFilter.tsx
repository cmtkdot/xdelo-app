import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowUpDown } from "lucide-react";

interface SortOrderFilterProps {
  value: 'asc' | 'desc';
  onChange: (value: 'asc' | 'desc') => void;
}

export const SortOrderFilter = ({ value, onChange }: SortOrderFilterProps) => {
  return (
    <div className="space-y-2 min-w-[120px]">
      <Label className="text-xs font-medium flex items-center gap-1 pl-1">
        <ArrowUpDown className="w-3 h-3" />
        Sort Order
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Sort Order" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="desc">Newest First</SelectItem>
          <SelectItem value="asc">Oldest First</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
