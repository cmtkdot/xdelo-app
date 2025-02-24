import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface VendorFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export const VendorFilter = ({ value, onChange }: VendorFilterProps) => {
  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, name")
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-2">
      <Label>Vendor</Label>
      <Select value={value} onValueChange={onChange}>
        <option value="">All Vendors</option>
        {vendors.map((vendor) => (
          <option key={vendor.id} value={vendor.id}>
            {vendor.name}
          </option>
        ))}
      </Select>
    </div>
  );
};
