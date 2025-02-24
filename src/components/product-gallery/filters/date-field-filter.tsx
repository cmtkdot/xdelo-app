import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

interface DateFieldFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export const DateFieldFilter = ({ value, onChange }: DateFieldFilterProps) => {
  return (
    <div className="space-y-2">
      <Label>Date Field</Label>
      <Select value={value} onValueChange={onChange}>
        <option value="created_at">Created Date</option>
        <option value="updated_at">Updated Date</option>
        <option value="purchase_date">Purchase Date</option>
        <option value="delivery_date">Delivery Date</option>
      </Select>
    </div>
  );
};
