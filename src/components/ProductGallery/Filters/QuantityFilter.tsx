import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package2 } from "lucide-react";
import { Label } from "@/components/ui/label";

interface QuantityFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export const QuantityFilter = ({ value, onChange }: QuantityFilterProps) => {
  return (
    <div className="space-y-2 min-w-[120px]">
      <Label className="text-xs font-medium flex items-center gap-1 pl-1">
        <Package2 className="w-3 h-3" />
        Quantity
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Quantity" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
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