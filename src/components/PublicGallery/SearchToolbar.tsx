
import React from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

interface SearchToolbarProps {
  searchTerm: string;
  onSearch: (term: string) => void;
  onClear: () => void;
  placeholder?: string;
  className?: string;
  isSearching?: boolean;
}

export const SearchToolbar = ({
  searchTerm,
  onSearch,
  onClear,
  placeholder = "Search products...",
  className = "",
  isSearching = false
}: SearchToolbarProps) => {
  return (
    <div className={`relative w-full max-w-md ${className}`}>
      <div className="relative flex items-center">
        <Search className="absolute left-2.5 h-4 w-4 text-muted-foreground" />
        
        <Input
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => onSearch(e.target.value)}
          className="pl-9 pr-10 py-2 w-full bg-background"
        />
        
        {searchTerm && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="absolute right-1 h-7 w-7 p-0 hover:bg-transparent"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
