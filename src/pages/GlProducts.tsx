import { Suspense, useState } from "react";
import { Card } from "@/components/ui/card";
import { GlappProductGrid } from "@/components/gl-products/glapp-product-grid";
import { GlappProductFilters } from "@/components/gl-products/glapp-product-filters";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function GlProducts() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const { data: products = [] } = useQuery({
    queryKey: ["glapp_products", searchTerm, sortOrder],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gl_products")
        .select(`
          *,
          messages:messages!gl_products_messages_fkey(
            public_url,
            media_group_id
          )
        `)
        .eq('messages.is_deleted', false)
        .order("created_at", { ascending: sortOrder === "asc" });
      if (error) throw error;
      return data;
    }
  });

  const handleViewProduct = (product: any) => {
    // Implement product view logic
    console.log("Viewing product:", product);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-bold">GL Products</h1>
      <Card className="p-4">
        <GlappProductFilters 
          onSearch={setSearchTerm}
          onSort={setSortOrder}
        />
      </Card>
      <Suspense fallback={<div>Loading...</div>}>
        <GlappProductGrid 
          products={products} 
          onViewProduct={handleViewProduct}
        />
      </Suspense>
    </div>
  );
}
