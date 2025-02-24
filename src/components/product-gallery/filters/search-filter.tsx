import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface SearchFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export const SearchFilter = ({ value, onChange }: SearchFilterProps) => {
  return (
    <div className="space-y-2">
      <Label>Search</Label>
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search products..."
          className="pl-8"
        />
      </div>
    </div>
  );
};
