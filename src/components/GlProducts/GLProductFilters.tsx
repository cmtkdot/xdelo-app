
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface GLProductFiltersProps {
  search: string;
  showUntitled: boolean;
  onSearchChange: (value: string) => void;
  onShowUntitledChange: (value: boolean) => void;
}

export function GLProductFilters({
  search,
  showUntitled,
  onSearchChange,
  onShowUntitledChange
}: GLProductFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Search products..."
          className="pl-10"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox 
          id="show-untitled" 
          checked={showUntitled} 
          onCheckedChange={(checked) => onShowUntitledChange(checked as boolean)}
        />
        <Label htmlFor="show-untitled" className="cursor-pointer">
          Show untitled products
        </Label>
      </div>
    </div>
  );
}
