import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GlappProductGrid } from "@/components/gl-products/glapp-product-grid";
import { GlappProductFilters } from "@/components/gl-products/glapp-product-filters";
import { supabase } from "@/integrations/supabase/client";
import { type Product } from "@/types/Product";
import { Card } from "@/components/ui/card";

interface Filters {
  search: string;
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  vendor: string;
  processingState: string;
}

export default function GlProducts() {
  const [filters, setFilters] = useState<Filters>({
    search: "",
    dateRange: {
      start: null,
      end: null,
    },
    vendor: "",
    processingState: "",
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["gl-products", filters],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

      if (filters.dateRange.start) {
        query = query.gte("created_at", filters.dateRange.start.toISOString());
      }

      if (filters.dateRange.end) {
        query = query.lte("created_at", filters.dateRange.end.toISOString());
      }

      if (filters.vendor) {
        query = query.eq("vendor", filters.vendor);
      }

      if (filters.processingState) {
        query = query.eq("processing_state", filters.processingState);
      }

      if (filters.search) {
        query = query.ilike("name", `%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Product[];
    },
  });

  return (
    <div className="space-y-4 p-4">
      <Card className="p-4">
        <GlappProductFilters filters={filters} onFiltersChange={setFilters} />
      </Card>

      <GlappProductGrid products={products} isLoading={isLoading} />
    </div>
  );
}
