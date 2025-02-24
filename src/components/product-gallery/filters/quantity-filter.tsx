import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface QuantityFilterProps {
  minValue: string;
  maxValue: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
}

export const QuantityFilter = ({
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
}: QuantityFilterProps) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Min Quantity</Label>
        <Input
          type="number"
          min="0"
          value={minValue}
          onChange={(e) => onMinChange(e.target.value)}
          placeholder="Enter min quantity"
        />
      </div>
      <div className="space-y-2">
        <Label>Max Quantity</Label>
        <Input
          type="number"
          min="0"
          value={maxValue}
          onChange={(e) => onMaxChange(e.target.value)}
          placeholder="Enter max quantity"
        />
      </div>
    </div>
  );
};
