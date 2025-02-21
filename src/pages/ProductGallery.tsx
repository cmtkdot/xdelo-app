import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem, FilterValues } from "@/types";
import { MediaEditDialog } from "@/components/MediaEditDialog";
import { useToast } from "@/components/ui/use-toast";
import { ProductGrid } from "@/components/ProductGallery/ProductGrid";
import { ProductPagination } from "@/components/ProductGallery/ProductPagination";
import ProductFilters from "@/components/ProductGallery/ProductFilters";
import { useVendors } from "@/hooks/useVendors";
import { useMediaGroups } from "@/hooks/useMediaGroups";

const ProductGallery = () => {
  const [editItem, setEditItem] = useState<MediaItem | null>(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<FilterValues>({
    search: "",
    vendors: [],
    sortOrder: "desc",
    processingState: ['completed']
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const vendors = useVendors();

  const [itemsPerPage, setItemsPerPage] = useState(15);

  // Set up realtime subscription
  useEffect(() => {
    const subscription = supabase
      .from('messages')
      .on('*', (payload) => {
        // Invalidate and refetch messages
        queryClient.invalidateQueries(['media-groups']);
      })
      .subscribe();

    return () => {
      supabase.removeSubscription(subscription);
    };
  }, [queryClient]);

  useEffect(() => {
    const calculateItemsPerPage = () => {
      const width = window.innerWidth;
      
      let columns = Math.floor(width / 180);
      columns = Math.max(2, Math.min(6, columns));
      
      const rows = Math.max(3, Math.min(6, Math.ceil(columns * 0.8)));
      
      return columns * rows;
    };

    const handleResize = () => {
      setItemsPerPage(calculateItemsPerPage());
    };

    handleResize();

    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { data } = useMediaGroups(page, filters, itemsPerPage);
  const mediaGroups = data?.mediaGroups ?? {};

  const handleEdit = (media: MediaItem) => {
    setEditItem(media);
  };

  const handleDelete = async (media: MediaItem) => {
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', media.id);

      if (error) throw error;

      toast({
        title: "Product deleted",
        description: "The product has been successfully deleted.",
      });

      // Refetch messages
      queryClient.invalidateQueries(['media-groups']);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete product. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleFilterChange = (newFilters: FilterValues) => {
    setFilters(newFilters);
    setPage(1); // Reset to first page when filters change
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-bold">Product Gallery</h1>
      
      <ProductFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        vendors={vendors}
      />

      <ProductGrid
        products={Object.values(mediaGroups)}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <ProductPagination
        currentPage={page}
        totalPages={data?.totalPages ?? 1}
        onPageChange={handlePageChange}
      />

      {editItem && (
        <MediaEditDialog
          media={editItem}
          open={!!editItem}
          onClose={() => setEditItem(null)}
        />
      )}
    </div>
  );
};

export default ProductGallery;
