import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface SearchFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export const SearchFilter = ({ value, onChange }: SearchFilterProps) => {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleSubmit = () => {
    onChange(localValue);
  };

  return (
    <div className="space-y-2 min-w-[200px]">
      <Label className="text-xs font-medium flex items-center justify-center gap-1">
        <Search className="w-3 h-3" />
        Search Products
      </Label>
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search products..."
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          className="h-8 text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSubmit();
            }
          }}
        />
        <Button 
          variant="secondary" 
          size="sm" 
          onClick={handleSubmit}
          className="h-8"
        >
          Search
        </Button>
      </div>
    </div>
  );
};