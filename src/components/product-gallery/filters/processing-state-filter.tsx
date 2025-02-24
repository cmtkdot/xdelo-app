import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

interface ProcessingStateFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export const ProcessingStateFilter = ({
  value,
  onChange,
}: ProcessingStateFilterProps) => {
  return (
    <div className="space-y-2">
      <Label>Processing State</Label>
      <Select value={value} onValueChange={onChange}>
        <option value="all">All States</option>
        <option value="pending">Pending</option>
        <option value="processing">Processing</option>
        <option value="completed">Completed</option>
        <option value="failed">Failed</option>
      </Select>
    </div>
  );
};
