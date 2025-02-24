import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface ProductCodeFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export const ProductCodeFilter = ({
  value,
  onChange,
}: ProductCodeFilterProps) => {
  return (
    <div className="space-y-2">
      <Label>Product Code</Label>
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter product code"
      />
    </div>
  );
};
