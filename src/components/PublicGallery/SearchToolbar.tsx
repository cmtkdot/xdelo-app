
import React from 'react';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { Button } from '../ui/button';

interface SearchToolbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  isSearching?: boolean;
  className?: string;
  placeholder?: string;
}

export function SearchToolbar({
  searchTerm,
  onSearchChange,
  onClearSearch,
  isSearching = false,
  className = '',
  placeholder = 'Search products...'
}: SearchToolbarProps) {
  return (
    <div className={`relative flex-1 max-w-md ${className}`}>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          placeholder={placeholder}
          className="pl-8 pr-8 h-9"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {searchTerm && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 p-1 h-9 w-9"
            onClick={onClearSearch}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Clear search</span>
          </Button>
        )}
      </div>
    </div>
  );
}
