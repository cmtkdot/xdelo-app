
import { useState, useEffect } from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";

interface DateRangeFilterProps {
  value: { from: Date; to: Date } | null;
  onChange: (value: { from: Date; to: Date } | null) => void;
}

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const [date, setDate] = useState<{ from: Date; to: Date } | null>(value);

  useEffect(() => {
    setDate(value);
  }, [value]);

  // When a date is selected, update both the local state and call the onChange handler
  const handleSelect = (newDate: { from: Date; to: Date } | null) => {
    setDate(newDate);
    onChange(newDate);
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Purchase Date Range</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "MMM d, yyyy")} - {format(date.to, "MMM d, yyyy")}
                </>
              ) : (
                format(date.from, "MMM d, yyyy")
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={date || undefined}
            onSelect={handleSelect}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
