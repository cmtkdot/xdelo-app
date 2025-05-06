import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SortOrderFilterProps {
  value: 'asc' | 'desc';
  onChange: (value: 'asc' | 'desc') => void;
}

export const SortOrderFilter = ({ value, onChange }: SortOrderFilterProps) => {
  // Get display text for selected value
  const getDisplayText = () => {
    switch (value) {
      case 'desc':
        return 'Newest First';
      case 'asc':
        return 'Oldest First';
      default:
        return 'Sort Order';
    }
  };

  return (
    <div className="min-w-[120px]">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 border-dashed text-sm px-3 flex items-center justify-between">
          <div className="flex items-center gap-1 truncate">
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="truncate">{getDisplayText()}</span>
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="desc">Newest First</SelectItem>
          <SelectItem value="asc">Oldest First</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
