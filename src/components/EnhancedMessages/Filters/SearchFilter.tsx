
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search } from 'lucide-react';

interface SearchFilterProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  applyFilters: () => void;
}

export function SearchFilter({ searchTerm, setSearchTerm, applyFilters }: SearchFilterProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      applyFilters();
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="search" className="text-sm font-medium">Search</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            id="search"
            placeholder="Search messages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-8"
          />
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
        <Button 
          variant="secondary" 
          onClick={applyFilters}
          className="shrink-0"
          size="sm"
        >
          Search
        </Button>
      </div>
    </div>
  );
}
