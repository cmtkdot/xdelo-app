
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Store } from "lucide-react";
import { Label } from "@/components/ui/label";

interface VendorFilterProps {
  value: string[];
  vendors: string[];
  onChange: (value: string[]) => void;
}

export const VendorFilter = ({ value, vendors, onChange }: VendorFilterProps) => {
  const handleChange = (selectedValue: string) => {
    if (selectedValue === 'all') {
      onChange([]);
    } else if (value.includes(selectedValue)) {
      onChange(value.filter(v => v !== selectedValue));
    } else {
      onChange([...value, selectedValue]);
    }
  };

  return (
    <div className="space-y-2 min-w-[120px]">
      <Label className="text-xs font-medium flex items-center gap-1 pl-1">
        <Store className="w-3 h-3" />
        Vendor{value.length > 0 && ` (${value.length} selected)`}
      </Label>
      <Select value={value.length === 0 ? 'all' : value[0]} onValueChange={handleChange}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Vendor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          {vendors.map((vendor) => (
            <SelectItem key={vendor} value={vendor}>{vendor}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
