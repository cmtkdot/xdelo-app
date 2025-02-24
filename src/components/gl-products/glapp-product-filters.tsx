import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface GlappProductFiltersProps {
  onSearch: (value: string) => void;
  onSort: (value: string) => void;
}

export const GlappProductFilters = ({
  onSearch,
  onSort,
}: GlappProductFiltersProps) => {
  return (
    <div className="flex gap-4 mb-6">
      <Input
        placeholder="Search products..."
        onChange={(e) => onSearch(e.target.value)}
        className="max-w-sm"
      />
      <Select onValueChange={onSort}>
        <option value="price-asc">Price: Low to High</option>
        <option value="price-desc">Price: High to Low</option>
        <option value="name-asc">Name: A to Z</option>
        <option value="name-desc">Name: Z to A</option>
      </Select>
    </div>
  );
};
