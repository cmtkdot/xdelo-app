import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Store } from "lucide-react";
import { Label } from "@/components/ui/label";

interface VendorFilterProps {
  value: string;
  vendors: string[];
  onChange: (value: string) => void;
}

export const VendorFilter = ({ value, vendors, onChange }: VendorFilterProps) => {
  return (
    <div className="space-y-2 min-w-[120px]">
      <Label className="text-xs font-medium flex items-center justify-center gap-1">
        <Store className="w-3 h-3" />
        Vendor
      </Label>
      <Select value={value} onValueChange={onChange}>
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