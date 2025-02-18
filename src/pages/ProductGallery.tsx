import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem, FilterValues, ProcessingState } from "@/types";
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

  const { toast } = useToast();
  const vendors = useVendors();

  const [itemsPerPage, setItemsPerPage] = useState(15); 

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
  const totalPages = data?.totalPages ?? 1;

  const handleEditMedia = (media: MediaItem) => {
    const groupKey = media.media_group_id || media.id;
    const group = mediaGroups[groupKey];
    const mainMedia = group.find(m => m.is_original_caption) || media;
    setEditItem(mainMedia);
  };

  const handleSaveEdit = async () => {
    if (!editItem) return;

    try {
      toast({
        title: "Success",
        description: "Caption updated successfully.",
      });
      
      setEditItem(null);
    } catch (error) {
      console.error('Error updating message:', error);
      toast({
        title: "Error",
        description: "Failed to update caption.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteMedia = (media: MediaItem) => {
    // Implement delete functionality if needed
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Product Gallery</h2>
      </div>

      <ProductFilters
        vendors={vendors}
        filters={filters}
        onFilterChange={setFilters}
      />

      <ProductGrid
        products={Object.values(mediaGroups)}
        onEdit={handleEditMedia}
        onDelete={handleDeleteMedia}
        onView={() => {}}
      />
      
      {Object.keys(mediaGroups).length > 0 && (
        <ProductPagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}

      {editItem && (
        <MediaEditDialog
          editItem={editItem}
          onClose={() => setEditItem(null)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
};

export default ProductGallery;
