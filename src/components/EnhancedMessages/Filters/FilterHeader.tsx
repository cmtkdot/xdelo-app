
import React from 'react';
import { Filter } from 'lucide-react';
import { FilterActions } from './FilterActions';

interface FilterHeaderProps {
  clearFilters: () => void;
  applyFilters: () => void;
}

export function FilterHeader({ clearFilters, applyFilters }: FilterHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="font-medium flex items-center">
        <Filter className="h-4 w-4 mr-2" />
        Filters
      </h3>
      
      <FilterActions 
        clearFilters={clearFilters}
        applyFilters={applyFilters}
      />
    </div>
  );
}
