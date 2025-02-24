
"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DatePickerProps {
  selected?: Date;
  onChange?: (date: Date | undefined) => void;
  minDate?: Date;
  maxDate?: Date;
  placeholderText?: string;
  className?: string;
}

export function DatePicker({ 
  selected,
  onChange,
  minDate,
  maxDate,
  placeholderText = "Pick a date",
  className 
}: DatePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !selected && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selected ? format(selected, "PPP") : <span>{placeholderText}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={onChange}
          initialFocus
          fromDate={minDate}
          toDate={maxDate}
        />
      </PopoverContent>
    </Popover>
  );
}
