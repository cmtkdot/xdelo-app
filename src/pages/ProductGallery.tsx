
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProductGrid } from "@/components/ProductGallery/ProductGrid";
import ProductFilters from "@/components/ProductGallery/ProductFilters";
import { ProductPagination } from "@/components/ProductGallery/ProductPagination"; 
import { PageContainer } from "@/components/Layout/PageContainer";
import { logEvent, LogEventType } from "@/lib/logUtils";
import { useToast } from "@/hooks/useToast";
import { GlProduct, convertToGlProduct } from "@/types/GlProducts";

interface FilterState {
  category: string;
  searchTerm: string;
  dateRange: { from: Date | null; to: Date | null };
}

export default function ProductGallery() {
  const [products, setProducts] = useState<GlProduct[]>([]);
  const [vendors, setVendors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterState, setFilterState] = useState<FilterState>({
    category: "all",
    searchTerm: "",
    dateRange: { from: null, to: null },
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [productsPerPage] = useState(20);
  const { toast } = useToast();

  // Load vendors for filter
  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const { data } = await supabase
          .from("gl_products")
          .select("vendor_product_name")
          .not("vendor_product_name", "is", null);
          
        if (data) {
          const uniqueVendors = Array.from(new Set(data.map(p => p.vendor_product_name))).filter(Boolean);
          setVendors(uniqueVendors as string[]);
        }
      } catch (error) {
        console.error("Error fetching vendors:", error);
      }
    };
    
    fetchVendors();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [filterState, currentPage]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("gl_products")
        .select("*")
        .order("created_at", { ascending: false });

      if (filterState.category !== "all") {
        query = query.eq("category", filterState.category);
      }

      if (filterState.searchTerm) {
        query = query.ilike("new_product_name", `%${filterState.searchTerm}%`);
      }

      if (filterState.dateRange.from) {
        query = query.gte("created_at", filterState.dateRange.from.toISOString());
      }

      if (filterState.dateRange.to) {
        query = query.lte("created_at", filterState.dateRange.to.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching products:", error);
        toast({
          title: "Error fetching products",
          description: "Failed to retrieve products from the database.",
          variant: "destructive",
        });
      } else if (data) {
        // Convert database products to GlProduct type using the converter
        const productList = data.map(item => convertToGlProduct(item));
        setProducts(productList);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilterState: Partial<FilterState>) => {
    setCurrentPage(1); // Reset to first page when filters change
    setFilterState((prev) => ({ ...prev, ...newFilterState }));
  };

  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  const indexOfLastProduct = currentPage * productsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
  const currentProducts = products.slice(indexOfFirstProduct, indexOfLastProduct);

  const handleEditProduct = (product: GlProduct) => {
    toast({
      title: "Edit Product",
      description: `Editing product ${product.id} is not yet implemented.`,
    });
  };

  const handleDeleteProduct = async (product: GlProduct) => {
    try {
      const { error } = await supabase
        .from("gl_products")
        .delete()
        .eq("id", product.id);

      if (error) {
        console.error("Error deleting product:", error);
        toast({
          title: "Error deleting product",
          description: "Failed to delete the product.",
          variant: "destructive",
        });
      } else {
        setProducts((prevProducts) =>
          prevProducts.filter((p) => p.id !== product.id)
        );
        toast({
          title: "Product deleted",
          description: "The product has been successfully deleted.",
        });
        await logGalleryAction("delete_product", product.id);
      }
    } catch (error) {
      console.error("Error deleting product:", error);
      toast({
        title: "Error deleting product",
        description: "Failed to delete the product.",
        variant: "destructive",
      });
    }
  };

  const logGalleryAction = async (action: string, productId: string) => {
    try {
      await logEvent(
        LogEventType.USER_ACTION,
        productId,
        {
          action,
          component: "ProductGallery",
          timestamp: new Date().toISOString()
        }
      );
    } catch (error) {
      console.error("Failed to log gallery action:", error);
    }
  };

  return (
    <PageContainer>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Product Gallery</h1>
        <ProductFilters 
          vendors={vendors}
          filters={filterState}
          onFilterChange={handleFilterChange} 
        />
        <div className="mt-6">
          <ProductGrid 
            products={currentProducts} 
            onEdit={handleEditProduct}
            onDelete={handleDeleteProduct}
            isDeleting={loading}
          />
        </div>
        <ProductPagination
          currentPage={currentPage}
          totalPages={Math.ceil(products.length / productsPerPage)}
          onPageChange={handlePageChange}
        />
      </div>
    </PageContainer>
  );
}
