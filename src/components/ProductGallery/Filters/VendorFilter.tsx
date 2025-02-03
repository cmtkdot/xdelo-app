import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users } from "lucide-react";

interface VendorFilterProps {
  value: string;
  vendors: string[];
  onChange: (value: string) => void;
}

export const VendorFilter = ({ value, vendors, onChange }: VendorFilterProps) => {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium flex items-center gap-2">
        <Users className="w-4 h-4" />
        Vendor
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select Vendor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Vendors</SelectItem>
          {vendors.map((vendor) => (
            <SelectItem key={vendor} value={vendor}>{vendor}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};