import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface SearchFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export const SearchFilter = ({ value, onChange }: SearchFilterProps) => {
  const [localValue, setLocalValue] = useState(value);

  // Update local value when prop changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleSubmit = () => {
    onChange(localValue);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search products..."
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          className="h-8 pl-7 text-sm w-[200px]"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSubmit();
            }
          }}
        />
      </div>
      <Button 
        variant="secondary" 
        size="sm" 
        onClick={handleSubmit}
        className="h-8"
      >
        Search
      </Button>
    </div>
  );
};