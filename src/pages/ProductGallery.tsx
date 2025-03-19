
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import ProductGrid from "@/components/ProductGallery/ProductGrid";
import ProductFilters from "@/components/ProductGallery/ProductFilters";
import ProductPagination from "@/components/ProductGallery/ProductPagination"; 
import { PageContainer } from "@/components/Layout/PageContainer";
import { logEvent, LogEventType } from "@/lib/logUtils";
import { useToast } from "@/hooks/useToast";
import { Button } from "@/components/ui/button";
import { GlProduct } from "@/types/GlProducts";

interface FilterState {
  category: string;
  searchTerm: string;
  dateRange: { from: Date | null; to: Date | null };
}

interface ProductPaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (pageNumber: number) => void;
}

export default function ProductGallery() {
  const [products, setProducts] = useState<GlProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterState, setFilterState] = useState<FilterState>({
    category: "all",
    searchTerm: "",
    dateRange: { from: null, to: null },
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [productsPerPage] = useState(20);
  const { toast } = useToast();

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
        query = query.eq("main_category", filterState.category);
      }

      if (filterState.searchTerm) {
        query = query.ilike("main_new_product_name", `%${filterState.searchTerm}%`);
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
      } else {
        // Convert database products to GlProduct type
        const productList: GlProduct[] = data?.map(item => ({
          id: item.id,
          name: item.main_new_product_name || item.product_name_display || item.vendor_product_name,
          sku: item.main_product_code,
          description: item.main_purchase_notes,
          price: item.main_cost,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
          imageUrl: item.main_product_image1,
          category: item.main_category,
          vendor: item.main_vendor_uid,
          quantity: item.main_total_qty_purchased,
          main_new_product_name: item.main_new_product_name,
          main_vendor_product_name: item.vendor_product_name,
          main_product_purchase_date: item.main_product_purchase_date,
          main_total_qty_purchased: item.main_total_qty_purchased,
          main_cost: item.main_cost,
          main_category: item.main_category,
          main_product_image1: item.main_product_image1,
          main_purchase_notes: item.main_purchase_notes
        })) || [];
        
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
        <ProductFilters onFilterChange={handleFilterChange} />
        <ProductGrid
          products={currentProducts}
          loading={loading}
          onEdit={handleEditProduct}
          onDelete={handleDeleteProduct}
        />
        <ProductPagination
          currentPage={currentPage}
          totalItems={products.length}
          itemsPerPage={productsPerPage}
          onPageChange={handlePageChange}
        />
      </div>
    </PageContainer>
  );
}
