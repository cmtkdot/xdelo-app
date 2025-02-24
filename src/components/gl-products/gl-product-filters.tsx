import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

interface GlProductFiltersProps {
  onSearch: (term: string) => void;
  onSort: (order: "asc" | "desc") => void;
}

export function GlProductFilters({ onSearch, onSort }: GlProductFiltersProps) {
  return (
    <div className="flex gap-4">
      <div className="relative flex-1">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search products..."
          className="pl-8"
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
      <Button
        variant="outline"
        onClick={() => onSort("asc")}
      >
        Sort Ascending
      </Button>
      <Button
        variant="outline"
        onClick={() => onSort("desc")}
      >
        Sort Descending
      </Button>
    </div>
  );
}
