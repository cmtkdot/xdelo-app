import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface DateFieldFilterProps {
  value: 'purchase_date' | 'created_at';
  onChange: (value: 'purchase_date' | 'created_at') => void;
}

export const DateFieldFilter = ({ value, onChange }: DateFieldFilterProps) => {
  // Get display text for selected value
  const getDisplayText = () => {
    switch (value) {
      case 'purchase_date':
        return 'Purchase Date';
      case 'created_at':
        return 'Upload Date';
      default:
        return 'Date Field';
    }
  };

  return (
    <div className="min-w-[130px]">
      <Select value={value} onValueChange={onChange as (value: string) => void}>
        <SelectTrigger className="h-8 border-dashed text-sm px-3 flex items-center justify-between">
          <div className="flex items-center gap-1 truncate">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="truncate">{getDisplayText()}</span>
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="purchase_date">Purchase Date</SelectItem>
          <SelectItem value="created_at">Upload Date</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
