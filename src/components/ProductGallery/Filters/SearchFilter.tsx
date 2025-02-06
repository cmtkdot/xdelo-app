import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import debounce from 'lodash/debounce';

interface SearchFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export const SearchFilter = ({ value, onChange }: SearchFilterProps) => {
  const [localValue, setLocalValue] = useState(value);

  // Create a debounced version of onChange
  const debouncedOnChange = debounce((newValue: string) => {
    onChange(newValue);
  }, 300);

  // Update local value when prop changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    debouncedOnChange(newValue);
  };

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium flex items-center gap-1">
        <Search className="w-3 h-3" />
        Search
      </label>
      <Input
        placeholder="Search products..."
        value={localValue}
        onChange={handleChange}
        className="h-8 text-sm"
      />
    </div>
  );
};