
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AnalyzedContent } from "@/types";

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
        .select('analyzed_content')
        .not('analyzed_content->vendor_uid', 'is', null);

      if (messages) {
        const uniqueVendors = Array.from(new Set(
          messages
            .map(m => (m.analyzed_content as AnalyzedContent | null)?.vendor_uid)
            .filter((v): v is string => !!v)
        )).map(vendorId => ({
          id: vendorId,
          name: vendorId
        }));
        
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
