import { useState, useEffect } from "react";
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
    vendor: "all",
    dateFrom: undefined,
    dateTo: undefined,
    dateField: 'purchase_date',
    sortOrder: "desc",
    productCode: "all",
    quantityRange: "all",
    processingState: "all"
  });

  const { toast } = useToast();
  const vendors = useVendors();

  // Calculate items per page based on viewport size
  const [itemsPerPage, setItemsPerPage] = useState(15); 

  useEffect(() => {
    const calculateItemsPerPage = () => {
      // Get viewport width
      const width = window.innerWidth;
      
      // Calculate approximate number of columns based on viewport width
      let columns = Math.floor(width / 180); // 180px is our target card width
      columns = Math.max(2, Math.min(6, columns)); // Ensure between 2 and 6 columns
      
      // Calculate rows (aim for roughly square layout)
      const rows = Math.max(3, Math.min(6, Math.ceil(columns * 0.8))); // Slightly fewer rows than columns
      
      return columns * rows;
    };

    const handleResize = () => {
      setItemsPerPage(calculateItemsPerPage());
    };

    // Initial calculation
    handleResize();

    // Add event listener
    window.addEventListener('resize', handleResize);

    // Cleanup
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

      {/* Product Grid */}
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

      {/* Edit Dialog */}
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
