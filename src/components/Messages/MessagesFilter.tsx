import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ProcessingState } from '@/types';

export interface MessageFilterValues {
  processingState?: string[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  showForwarded?: boolean;
  showEdited?: boolean;
}

interface MessagesFilterProps {
  filters: MessageFilterValues;
  onFilterChange: (filters: MessageFilterValues) => void;
}

export const MessagesFilter: React.FC<MessagesFilterProps> = ({
  filters,
  onFilterChange
}) => {
  // Processing state options
  const processingStates: { value: ProcessingState; label: string }[] = [
    { value: 'initialized', label: 'Initialized' },
    { value: 'pending', label: 'Pending' },
    { value: 'processing', label: 'Processing' },
    { value: 'completed', label: 'Completed' },
    { value: 'error', label: 'Error' }
  ];

  // Sort options
  const sortOptions = [
    { value: 'updated_at', label: 'Updated Date' },
    { value: 'created_at', label: 'Created Date' },
    { value: 'processing_started_at', label: 'Processing Started' },
    { value: 'purchase_date', label: 'Purchase Date' }
  ];

  const handleProcessingStateChange = (value: string) => {
    const selectedStates = value === 'all' 
      ? undefined 
      : [value];
    
    onFilterChange({
      ...filters,
      processingState: selectedStates
    });
  };

  const handleSortByChange = (value: string) => {
    onFilterChange({
      ...filters,
      sortBy: value
    });
  };

  const handleSortOrderChange = (value: string) => {
    onFilterChange({
      ...filters,
      sortOrder: value as 'asc' | 'desc'
    });
  };

  const handleShowForwardedChange = (checked: boolean) => {
    onFilterChange({
      ...filters,
      showForwarded: checked
    });
  };

  const handleShowEditedChange = (checked: boolean) => {
    onFilterChange({
      ...filters,
      showEdited: checked
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="processing-state">Processing State</Label>
          <Select 
            value={filters.processingState?.[0] || 'all'} 
            onValueChange={handleProcessingStateChange}
          >
            <SelectTrigger id="processing-state">
              <SelectValue placeholder="All States" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              {processingStates.map(state => (
                <SelectItem key={state.value} value={state.value}>
                  {state.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sort-by">Sort By</Label>
          <Select 
            value={filters.sortBy || 'updated_at'} 
            onValueChange={handleSortByChange}
          >
            <SelectTrigger id="sort-by">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sort-order">Sort Order</Label>
          <Select 
            value={filters.sortOrder || 'desc'} 
            onValueChange={handleSortOrderChange}
          >
            <SelectTrigger id="sort-order">
              <SelectValue placeholder="Sort order..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Newest First</SelectItem>
              <SelectItem value="asc">Oldest First</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-center mt-2">
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="show-forwarded" 
            checked={filters.showForwarded} 
            onCheckedChange={handleShowForwardedChange}
          />
          <Label htmlFor="show-forwarded" className="cursor-pointer">Show only forwarded messages</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox 
            id="show-edited" 
            checked={filters.showEdited} 
            onCheckedChange={handleShowEditedChange}
          />
          <Label htmlFor="show-edited" className="cursor-pointer">Show only edited messages</Label>
        </div>
      </div>
    </div>
  );
};
