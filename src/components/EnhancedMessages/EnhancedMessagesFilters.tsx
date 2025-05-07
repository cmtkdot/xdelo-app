import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Grid, LayoutList, Search } from "lucide-react";
import { useState } from "react";

interface EnhancedMessagesFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  showMode: "grid" | "list";
  onToggleShowMode: () => void;
  dateField?: "created_at" | "updated_at";
  onDateFieldChange?: (value: "created_at" | "updated_at") => void;
  sortOrder?: "asc" | "desc";
  onSortOrderChange?: (value: "asc" | "desc") => void;
}

export const EnhancedMessagesFilters = ({
  searchTerm = "",
  onSearchChange,
  showMode,
  onToggleShowMode,
  dateField = "created_at",
  onDateFieldChange,
  sortOrder = "desc",
  onSortOrderChange,
}: EnhancedMessagesFiltersProps) => {
  const [inputValue, setInputValue] = useState(searchTerm);

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && onSearchChange) {
      onSearchChange(inputValue);
    }
  };

  const handleSearchClick = () => {
    if (onSearchChange) {
      onSearchChange(inputValue);
    }
  };

  const handleClearSearch = () => {
    setInputValue("");
    if (onSearchChange) {
      onSearchChange("");
    }
  };

  return (
    <div className="space-y-4 mb-4">
      {/* Search input */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Input
            placeholder="Search by message content, caption or tags..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleSearch}
            className="pr-8"
          />
          {inputValue && (
            <button
              onClick={handleClearSearch}
              className="absolute right-8 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-full"
            onClick={handleSearchClick}
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>

        {/* View Mode Toggle - Icon Only */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onToggleShowMode}
                className="transition-all duration-200 ease-in-out"
              >
                {showMode === "list" ? (
                  <Grid className="h-4 w-4" />
                ) : (
                  <LayoutList className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {showMode === "list"
                ? "Switch to grid view"
                : "Switch to list view"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Additional filter options can be added here, similar to GalleryFilters */}
    </div>
  );
};
