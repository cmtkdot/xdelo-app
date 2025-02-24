import { useState } from "react";
import { type Product } from "@/types/Product";
import { ProductGrid } from "@/components/product-gallery/product-grid";
import { ProductFilters, type ProductFilters as Filters } from "@/components/product-gallery/product-filters";
import { ProductPagination } from "@/components/product-gallery/product-pagination";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

const ProductsPage = () => {
  const [filters, setFilters] = useState<Filters>({
    search: '',
    category: 'all',
    minPrice: 0,
    maxPrice: 1000,
  });

  const { data: products, isLoading, error } = useQuery({
    queryKey: ["glapp_products", filters],
    queryFn: async () => {
      const query = supabase
        .from("glapp_products")
        .select("*, messages(*)");

      if (filters.search) {
        query.or(`main_new_product_name.ilike.%${filters.search}%,main_vendor_product_name.ilike.%${filters.search}%`);
      }

      if (filters.minPrice > 0) {
        query.gte("main_cost", filters.minPrice);
      }

      if (filters.maxPrice < 1000) {
        query.lte("main_cost", filters.maxPrice);
      }

      const { data: products, error } = await query;

      if (error) {
        throw error;
      }

      return products as Product[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 p-4">
        Error: {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Products</h2>
      </div>
      
      <Card className="p-6 mb-6">
        <ProductFilters
          filters={filters}
          onFilterChange={setFilters}
        />
      </Card>
      
      <Card className="p-6">
        <ProductGrid products={products || []} />
      </Card>
    </div>
  );
};

export default ProductsPage;
