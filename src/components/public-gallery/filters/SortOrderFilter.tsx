import { Button } from "@/components/ui/button";
import { ArrowUpDown } from "lucide-react";

interface SortOrderFilterProps {
  value: "asc" | "desc";
  onChange: (value: "asc" | "desc") => void;
}

export const SortOrderFilter = ({ value, onChange }: SortOrderFilterProps) => {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => onChange(value === "asc" ? "desc" : "asc")}
      className="h-8 gap-1"
    >
      <ArrowUpDown className="h-3.5 w-3.5" />
      <span>{value === "asc" ? "Ascending" : "Descending"}</span>
    </Button>
  );
};
