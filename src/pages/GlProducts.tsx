
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { GLProductGrid } from "@/components/GlProducts/GLProductGrid";
import { GLProductFilters } from "@/components/GlProducts/GLProductFilters";
import { supabase } from "@/integrations/supabase/client";
import { GlProduct, convertToGlProduct } from '@/types/GlProducts';
import { GlProduct as EntityGlProduct } from '@/types/entities/Product';
import { Database } from "@/integrations/supabase/database.types";

type GlProductRow = Database['public']['Tables']['gl_products']['Row'];

const GlProducts = () => {
  const [search, setSearch] = useState("");
  const [showUntitled, setShowUntitled] = useState(false);
  const [sortField, setSortField] = useState<"purchase_date" | "created_at">("purchase_date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const { data: products, isLoading, error } = useQuery({
    queryKey: ["glapp_products", search, showUntitled, sortField, sortOrder],
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
      let productsWithImages: GlProduct[] = (data as GlProductRow[]).map(product => convertToGlProduct(product));

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

      // Sort the products based on the selected sort field and order
      productsWithImages.sort((a, b) => {
        let valueA, valueB;

        if (sortField === "purchase_date") {
          valueA = a.main_product_purchase_date ? new Date(a.main_product_purchase_date).getTime() : 0;
          valueB = b.main_product_purchase_date ? new Date(b.main_product_purchase_date).getTime() : 0;
        } else {
          valueA = a.created_at ? new Date(a.created_at).getTime() : 0;
          valueB = b.created_at ? new Date(b.created_at).getTime() : 0;
        }

        return sortOrder === "asc" 
          ? valueA - valueB 
          : valueB - valueA;
      });

      return productsWithImages as unknown as EntityGlProduct[];
    },
  });

  const handleSearchChange = (value: string) => {
    setSearch(value);
  };

  const handleShowUntitledChange = (value: boolean) => {
    setShowUntitled(value);
  };

  const handleSortFieldChange = (value: "purchase_date" | "created_at") => {
    setSortField(value);
  };

  const handleSortOrderChange = (value: "asc" | "desc") => {
    setSortOrder(value);
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
        sortField={sortField}
        sortOrder={sortOrder}
        onSortFieldChange={handleSortFieldChange}
        onSortOrderChange={handleSortOrderChange}
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
