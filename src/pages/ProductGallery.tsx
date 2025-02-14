
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem, FilterValues } from "@/types";
import { MediaEditDialog } from "@/components/MediaEditDialog";
import { useToast } from "@/components/ui/use-toast";
import { ProductGrid } from "@/components/ProductGallery/ProductGrid";
import { ProductPagination } from "@/components/ProductGallery/ProductPagination";
import ProductFilters from "@/components/ProductGallery/ProductFilters";
import { useVendors } from "@/hooks/useVendors";
import { useMediaGroups } from "@/hooks/useMediaGroups";
import { useIsMobile } from "@/hooks/use-mobile";

const ProductGallery = () => {
  const [editItem, setEditItem] = useState<MediaItem | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
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
  const isMobile = useIsMobile();

  // Calculate items per page based on grid layout
  const getItemsPerPage = () => {
    const rows = 3; // Number of rows we want per page
    let cols = 4; // Default columns for xl screens
    
    if (isMobile) {
      cols = 2; // Mobile shows 2 columns
    } else if (window.innerWidth < 1280) { // lg breakpoint
      cols = 3; // Large screens show 3 columns
    }
    
    return rows * cols; // This ensures full rows on each page
  };

  const itemsPerPage = getItemsPerPage();
  const { data } = useMediaGroups(currentPage, filters, itemsPerPage);
  const mediaGroups = data?.mediaGroups ?? {};
  const totalPages = data?.totalPages ?? 1;

  const handleEdit = (media: MediaItem) => {
    const groupKey = media.media_group_id || media.id;
    const group = mediaGroups[groupKey];
    const mainMedia = group.find(m => m.is_original_caption) || media;
    setEditItem(mainMedia);
  };

  const handleSave = async () => {
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

  const handleDelete = (media: MediaItem) => {
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
        mediaGroups={mediaGroups} 
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
      
      {Object.keys(mediaGroups).length > 0 && (
        <ProductPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}

      <MediaEditDialog
        editItem={editItem}
        onClose={() => setEditItem(null)}
        onSave={handleSave}
      />
    </div>
  );
};

export default ProductGallery;
