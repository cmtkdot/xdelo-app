import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tag } from "lucide-react";

interface ProductCodeFilterProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}

export const ProductCodeFilter = ({ value, options, onChange }: ProductCodeFilterProps) => {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium flex items-center gap-2">
        <Tag className="w-4 h-4" />
        Product Code
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select Product Code" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Product Codes</SelectItem>
          {options.map((code) => (
            <SelectItem key={code} value={code}>{code}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};