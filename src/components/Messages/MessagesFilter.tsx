
import React from 'react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { useForm } from 'react-hook-form';
import { ProcessingState } from '@/types';

export interface MessageFilterValues {
  processingState?: ProcessingState[];
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
  const form = useForm<MessageFilterValues>({
    defaultValues: {
      processingState: filters.processingState,
      sortBy: filters.sortBy || 'updated_at',
      sortOrder: filters.sortOrder || 'desc',
      showForwarded: filters.showForwarded || false,
      showEdited: filters.showEdited || false
    }
  });

  const handleStatusChange = (value: string) => {
    let newState: ProcessingState[] | undefined;
    
    if (value === 'all') {
      newState = undefined;
    } else if (value === 'pending_processing') {
      newState = ['pending', 'processing'];
    } else if (value === 'completed_error') {
      newState = ['completed', 'error', 'partial_success'];
    } else {
      newState = [value as ProcessingState];
    }
    
    form.setValue('processingState', newState);
    onFilterChange({ ...form.getValues(), processingState: newState });
  };

  const handleSortByChange = (value: string) => {
    form.setValue('sortBy', value);
    onFilterChange({ ...form.getValues(), sortBy: value });
  };
  
  const handleSortOrderChange = (value: 'asc' | 'desc') => {
    form.setValue('sortOrder', value);
    onFilterChange({ ...form.getValues(), sortOrder: value });
  };
  
  const handleSwitchChange = (field: 'showForwarded' | 'showEdited', checked: boolean) => {
    form.setValue(field, checked);
    onFilterChange({ ...form.getValues(), [field]: checked });
  };
  
  const getStatusValue = () => {
    const states = filters.processingState;
    
    if (!states || states.length === 0) {
      return 'all';
    }
    
    if (states.length === 2 && 
        states.includes('pending') && 
        states.includes('processing')) {
      return 'pending_processing';
    }
    
    if (states.length === 3 && 
        states.includes('completed') && 
        states.includes('error') &&
        states.includes('partial_success')) {
      return 'completed_error';
    }
    
    if (states.length === 1) {
      return states[0];
    }
    
    return 'custom';
  };

  return (
    <Form {...form}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField
          control={form.control}
          name="processingState"
          render={() => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <FormControl>
                <Select
                  value={getStatusValue()}
                  onValueChange={handleStatusChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="partial_success">Partial Success</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="pending_processing">Pending & Processing</SelectItem>
                    <SelectItem value="completed_error">Completed & Error</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="sortBy"
          render={() => (
            <FormItem>
              <FormLabel>Sort By</FormLabel>
              <FormControl>
                <Select
                  value={filters.sortBy || 'updated_at'}
                  onValueChange={handleSortByChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created_at">Created Date</SelectItem>
                    <SelectItem value="updated_at">Updated Date</SelectItem>
                    <SelectItem value="purchase_date">Purchase Date</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="sortOrder"
          render={() => (
            <FormItem>
              <FormLabel>Sort Order</FormLabel>
              <FormControl>
                <Select
                  value={filters.sortOrder || 'desc'}
                  onValueChange={(val) => handleSortOrderChange(val as 'asc' | 'desc')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sort Order" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Newest First</SelectItem>
                    <SelectItem value="asc">Oldest First</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
            </FormItem>
          )}
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <FormField
          control={form.control}
          name="showForwarded"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between space-x-2">
              <FormLabel>Show only forwarded messages</FormLabel>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={(checked) => handleSwitchChange('showForwarded', checked)}
                />
              </FormControl>
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="showEdited"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between space-x-2">
              <FormLabel>Show only edited messages</FormLabel>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={(checked) => handleSwitchChange('showEdited', checked)}
                />
              </FormControl>
            </FormItem>
          )}
        />
      </div>
    </Form>
  );
};
