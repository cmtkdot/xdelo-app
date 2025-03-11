
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { GLProductGrid } from "@/components/GlProducts/GLProductGrid";
import { GLProductFilters } from "@/components/GlProducts/GLProductFilters";
import { supabase } from "@/integrations/supabase/client";
import { GlProduct, convertToGlProduct } from '@/types/GlProducts';

const GlProducts = () => {
  const [search, setSearch] = useState("");
  const [showUntitled, setShowUntitled] = useState(false);

  const { data: products, isLoading, error } = useQuery({
    queryKey: ["glapp_products", search, showUntitled],
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
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Transform and type-cast the data using our converter
      let productsWithImages: GlProduct[] = data.map(product => convertToGlProduct(product));

      // Filter by search term if provided
      if (search) {
        const searchLower = search.toLowerCase();
        productsWithImages = productsWithImages.filter(product => 
          product.main_new_product_name?.toLowerCase().includes(searchLower) || 
          product.main_vendor_product_name?.toLowerCase().includes(searchLower)
        );
      }

      // Filter out untitled products if showUntitled is false
      if (!showUntitled) {
        productsWithImages = productsWithImages.filter(product => 
          product.main_new_product_name && 
          product.main_new_product_name.toLowerCase() !== "untitled"
        );
      }

      return productsWithImages;
    },
  });

  const handleSearchChange = (value: string) => {
    setSearch(value);
  };

  const handleShowUntitledChange = (value: boolean) => {
    setShowUntitled(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Products</h2>
      </div>
      
      <GLProductFilters 
        search={search}
        showUntitled={showUntitled}
        onSearchChange={handleSearchChange}
        onShowUntitledChange={handleShowUntitledChange}
      />
      
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
          <GLProductGrid products={products} />
        )}
      </Card>
    </div>
  );
};

export default GlProducts;
