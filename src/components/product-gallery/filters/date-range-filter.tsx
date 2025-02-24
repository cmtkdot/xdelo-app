import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";

interface DateRangeFilterProps {
  startDate: Date | null;
  endDate: Date | null;
  onStartDateChange: (date: Date | null) => void;
  onEndDateChange: (date: Date | null) => void;
}

export const DateRangeFilter = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: DateRangeFilterProps) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Start Date</Label>
        <DatePicker
          selected={startDate}
          onChange={onStartDateChange}
          maxDate={endDate || undefined}
          placeholderText="Select start date"
        />
      </div>
      <div className="space-y-2">
        <Label>End Date</Label>
        <DatePicker
          selected={endDate}
          onChange={onEndDateChange}
          minDate={startDate || undefined}
          placeholderText="Select end date"
        />
      </div>
    </div>
  );
};
