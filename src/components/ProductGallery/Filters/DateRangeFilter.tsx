import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

interface DateRangeFilterProps {
  dateFrom?: Date;
  dateTo?: Date;
  dateField: 'purchase_date' | 'created_at' | 'updated_at';
  onDateFromChange: (date?: Date) => void;
  onDateToChange: (date?: Date) => void;
  onDateFieldChange: (field: 'purchase_date' | 'created_at' | 'updated_at') => void;
}

export const DateRangeFilter = ({ 
  dateFrom, 
  dateTo, 
  dateField,
  onDateFromChange, 
  onDateToChange,
  onDateFieldChange
}: DateRangeFilterProps) => {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium flex items-center gap-1">
          <CalendarIcon className="w-3 h-3" />
          Date Range
        </label>
        <Select value={dateField} onValueChange={onDateFieldChange}>
          <SelectTrigger className="h-7 text-xs w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="purchase_date">Purchase Date</SelectItem>
            <SelectItem value="created_at">Created Date</SelectItem>
            <SelectItem value="updated_at">Updated Date</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-7 text-xs px-2">
              <CalendarIcon className="w-3 h-3 mr-1" />
              {dateFrom ? format(dateFrom, 'MM/dd/yyyy') : 'From'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateFrom}
              onSelect={onDateFromChange}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-7 text-xs px-2">
              <CalendarIcon className="w-3 h-3 mr-1" />
              {dateTo ? format(dateTo, 'MM/dd/yyyy') : 'To'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateTo}
              onSelect={onDateToChange}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};