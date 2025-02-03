import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface SearchFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export const SearchFilter = ({ value, onChange }: SearchFilterProps) => {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium flex items-center gap-2">
        <Search className="w-4 h-4" />
        Search Products
      </label>
      <Input
        placeholder="Search by product name..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full"
      />
    </div>
  );
};