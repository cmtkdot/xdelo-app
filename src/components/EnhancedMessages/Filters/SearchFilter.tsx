
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SearchFilterProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  applyFilters: () => void;
}

export function SearchFilter({ searchTerm, setSearchTerm, applyFilters }: SearchFilterProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="search">Search</Label>
      <div className="flex gap-2">
        <Input
          id="search"
          placeholder="Search messages..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1"
        />
        <Button 
          variant="outline" 
          onClick={applyFilters}
          className="shrink-0"
        >
          Search
        </Button>
      </div>
    </div>
  );
}
