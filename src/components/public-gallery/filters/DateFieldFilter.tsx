import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarDays } from "lucide-react";

interface DateFieldFilterProps {
  value: "created_at" | "updated_at";
  onChange: (value: "created_at" | "updated_at") => void;
}

export const DateFieldFilter = ({ value, onChange }: DateFieldFilterProps) => {
  return (
    <Select
      value={value}
      onValueChange={(val) => onChange(val as "created_at" | "updated_at")}
    >
      <SelectTrigger className="h-8 w-auto gap-1">
        <CalendarDays className="h-3.5 w-3.5" />
        <SelectValue placeholder="Date Field" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="created_at">Created Date</SelectItem>
        <SelectItem value="updated_at">Updated Date</SelectItem>
      </SelectContent>
    </Select>
  );
};
