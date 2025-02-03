import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package2 } from "lucide-react";

interface QuantityFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export const QuantityFilter = ({ value, onChange }: QuantityFilterProps) => {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium flex items-center gap-2">
        <Package2 className="w-4 h-4" />
        Quantity
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Quantity Range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Quantities</SelectItem>
          <SelectItem value="undefined">Undefined</SelectItem>
          <SelectItem value="1-5">1-5</SelectItem>
          <SelectItem value="6-10">6-10</SelectItem>
          <SelectItem value="11-15">11-15</SelectItem>
          <SelectItem value="16-20">16-20</SelectItem>
          <SelectItem value="21+">21+</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};