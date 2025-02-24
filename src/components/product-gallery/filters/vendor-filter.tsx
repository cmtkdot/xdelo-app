
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
      const { data: messages } = await supabase
        .from('messages')
        .select('analyzed_content->vendor_uid')
        .not('analyzed_content->vendor_uid', 'is', null)
        .distinct();

      if (messages) {
        const uniqueVendors = messages
          .map(m => ({
            id: m.analyzed_content?.vendor_uid || '',
            name: m.analyzed_content?.vendor_uid || ''
          }))
          .filter(v => v.id);
        
        setVendors(uniqueVendors);
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
