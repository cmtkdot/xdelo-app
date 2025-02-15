import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CalendarDays } from "lucide-react";

interface DateFieldFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export const DateFieldFilter = ({ value, onChange }: DateFieldFilterProps) => {
  return (
    <div className="space-y-2 min-w-[140px]">
      <Label className="text-xs font-medium flex items-center gap-1 pl-1">
        <CalendarDays className="w-3 h-3" />
        Date Field
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Date Field" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="created_at">Created At</SelectItem>
          <SelectItem value="purchase_date">Purchase Date</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
