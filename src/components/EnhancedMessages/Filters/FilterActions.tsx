
import React from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface FilterActionsProps {
  clearFilters: () => void;
  applyFilters: () => void;
}

export function FilterActions({ clearFilters, applyFilters }: FilterActionsProps) {
  return (
    <>
      <div className="flex items-center justify-end">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={clearFilters}
          className="h-8 px-2 text-xs gap-1"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      </div>
      
      <div className="pt-4 border-t mt-4">
        <Button className="w-full" onClick={applyFilters}>
          Apply Filters
        </Button>
      </div>
    </>
  );
}
