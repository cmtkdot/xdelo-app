import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

interface SortOrderFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export const SortOrderFilter = ({ value, onChange }: SortOrderFilterProps) => {
  return (
    <div className="space-y-2">
      <Label>Sort By</Label>
      <Select value={value} onValueChange={onChange}>
        <option value="created_at_desc">Newest First</option>
        <option value="created_at_asc">Oldest First</option>
        <option value="price_desc">Price: High to Low</option>
        <option value="price_asc">Price: Low to High</option>
      </Select>
    </div>
  );
};
