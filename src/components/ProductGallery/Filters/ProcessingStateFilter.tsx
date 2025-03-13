
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle } from "lucide-react";
import { ProcessingState } from "@/types";

interface ProcessingStateFilterProps {
  value: ProcessingState | "all";
  onChange: (value: ProcessingState | "all") => void;
}

export const ProcessingStateFilter = ({ value, onChange }: ProcessingStateFilterProps) => {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        Status
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Select Status" />
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
