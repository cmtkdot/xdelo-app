
import React from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, X } from 'lucide-react';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface DateRangeFilterProps {
  date: DateRange | undefined;
  setDate: (date: DateRange | undefined) => void;
  applyFilters: () => void;
}

export function DateRangeFilter({ date, setDate, applyFilters }: DateRangeFilterProps) {
  // Handle null values as undefined for consistency
  const safeDate = date || undefined;
  
  return (
    <div className="space-y-2">
      <Label>Date Range</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !safeDate?.from && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {safeDate?.from ? (
              safeDate.to ? (
                <>
                  {format(safeDate.from, "LLL dd, y")} -{" "}
                  {format(safeDate.to, "LLL dd, y")}
                </>
              ) : (
                format(safeDate.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="range"
            selected={safeDate}
            onSelect={setDate}
            initialFocus
          />
          <div className="p-2 border-t border-border">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full" 
              onClick={applyFilters}
            >
              Apply Date Range
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      
      {safeDate && (
        <Button 
          variant="ghost" 
          size="sm" 
          className="mt-1 h-7 px-2 text-xs" 
          onClick={() => {
            setDate(undefined);
            applyFilters();
          }}
        >
          <X className="mr-1 h-3 w-3" />
          Clear dates
        </Button>
      )}
    </div>
  );
}
