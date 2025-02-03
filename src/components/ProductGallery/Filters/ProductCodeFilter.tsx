import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tag } from "lucide-react";

interface ProductCodeFilterProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}

export const ProductCodeFilter = ({ value, options, onChange }: ProductCodeFilterProps) => {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium flex items-center gap-1">
        <Tag className="w-3 h-3" />
        Product Code
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Select Code" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Codes</SelectItem>
          {options.map((code) => (
            <SelectItem key={code} value={code}>
              {code.startsWith('PO#') ? code : `PO#${code}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};