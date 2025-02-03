import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle } from "lucide-react";
import { ProcessingState } from "@/types";

interface ProcessingStateFilterProps {
  value: ProcessingState | "all";
  onChange: (value: ProcessingState | "all") => void;
}

export const ProcessingStateFilter = ({ value, onChange }: ProcessingStateFilterProps) => {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium flex items-center gap-2">
        <AlertCircle className="w-4 h-4" />
        Processing State
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Processing State" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All States</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="processing">Processing</SelectItem>
          <SelectItem value="error">Error</SelectItem>
          <SelectItem value="initialized">Initialized</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};