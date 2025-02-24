
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface VendorFilterProps {
  onVendorChange: (vendor: string | null) => void;
  selectedVendor: string | null;
}

export function VendorFilter({ onVendorChange, selectedVendor }: VendorFilterProps) {
  const [vendors, setVendors] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    const fetchVendors = async () => {
      const { data: vendorsData } = await supabase
        .from('xdelo_vendors')
        .select('id,name')
        .order('name');

      if (vendorsData) {
        setVendors(vendorsData);
      }
    };

    fetchVendors();
  }, []);

  return (
    <Select value={selectedVendor || undefined} onValueChange={onVendorChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select Vendor" />
      </SelectTrigger>
      <SelectContent>
        {vendors.map((vendor) => (
          <SelectItem key={vendor.id} value={vendor.id}>
            {vendor.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
