
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { GlappProductGrid } from "@/components/GlProducts/GlappProductGrid";
import { GlappProductFilters } from "@/components/GlProducts/GlappProductFilters";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function GlProducts() {
  const { data: products = [] } = useQuery({
    queryKey: ['glapp_products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('glapp_products')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-bold">GL Products</h1>
      <Card className="p-4">
        <GlappProductFilters />
      </Card>
      <Suspense fallback={<div>Loading...</div>}>
        <GlappProductGrid products={products} />
      </Suspense>
    </div>
  );
}
