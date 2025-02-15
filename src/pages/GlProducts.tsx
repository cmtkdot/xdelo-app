
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { GlappProductGrid } from "@/components/GlProducts/GlappProductGrid";
import { GlappProductFilters } from "@/components/GlProducts/GlappProductFilters";
import { supabase } from "@/integrations/supabase/client";
import { GlProduct } from "@/types";

const GlProducts = () => {
  const { data: products, isLoading, error } = useQuery({
    queryKey: ["glapp_products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gl_products")
        .select(`
          *,
          messages:messages(
            public_url,
            media_group_id
          )
        `)
        .eq('messages.is_deleted', false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Transform the data to include the first message's public_url
      const productsWithImages = data.map(product => ({
        ...product,
        message_public_url: product.messages?.[0]?.public_url || null
      }));

      return productsWithImages as GlProduct[];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Products</h2>
      </div>
      
      <GlappProductFilters />
      
      <Card className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="text-destructive">Error loading products</div>
        ) : !products?.length ? (
          <p className="text-muted-foreground">No products found</p>
        ) : (
          <GlappProductGrid products={products} />
        )}
      </Card>
    </div>
  );
};

export default GlProducts;
