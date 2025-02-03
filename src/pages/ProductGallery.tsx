import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem, FilterValues, analyzedContentToJson } from "@/types";
import { MediaEditDialog } from "@/components/MediaEditDialog";
import { useToast } from "@/components/ui/use-toast";
import { ProductGrid } from "@/components/ProductGallery/ProductGrid";
import { ProductPagination } from "@/components/ProductGallery/ProductPagination";
import ProductFilters from "@/components/ProductGallery/ProductFilters";
import { useVendors } from "@/hooks/useVendors";
import { useMediaGroups } from "@/hooks/useMediaGroups";

const ProductGallery = () => {
  const [editItem, setEditItem] = useState<MediaItem | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<FilterValues>({
    search: "",
    vendor: "all",
    dateFrom: undefined,
    dateTo: undefined,
    sortOrder: "desc",
  });
  const { toast } = useToast();
  const vendors = useVendors();
  const { mediaGroups, totalPages } = useMediaGroups(currentPage, filters);

  const formatDate = (date: string | null) => {
    if (!date) return null;
    try {
      const d = new Date(date);
      return d.toISOString().split('T')[0];
    } catch (error) {
      console.error("Error formatting date:", error);
      return null;
    }
  };

  const handleEdit = (media: MediaItem) => {
    const groupKey = media.media_group_id || media.id;
    const group = mediaGroups[groupKey];
    const mainMedia = group.find(m => m.is_original_caption) || media;
    setEditItem(mainMedia);
  };

  const handleItemChange = (field: string, value: any) => {
    if (editItem) {
      const updatedContent = {
        ...(editItem.analyzed_content || {}),
        [field]: value,
        parsing_metadata: {
          method: 'manual' as const,
          confidence: 1.0,
          timestamp: new Date().toISOString()
        }
      };

      setEditItem({
        ...editItem,
        analyzed_content: updatedContent
      });
    }
  };

  const handleSave = async () => {
    if (!editItem) return;

    try {
      const analyzedContentJson = editItem.analyzed_content ? 
        analyzedContentToJson(editItem.analyzed_content) : null;

      const { error } = await supabase
        .from('messages')
        .update({
          analyzed_content: analyzedContentJson
        })
        .eq('id', editItem.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Product details updated successfully.",
      });
      
      setEditItem(null);
    } catch (error) {
      console.error('Error updating message:', error);
      toast({
        title: "Error",
        description: "Failed to update product details.",
        variant: "destructive",
      });
    }
  };

  const handleFilterChange = (newFilters: FilterValues) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Product Gallery</h2>
      </div>

      <ProductFilters
        vendors={vendors}
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      <ProductGrid mediaGroups={mediaGroups} onEdit={handleEdit} />
      
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
        onItemChange={handleItemChange}
        formatDate={formatDate}
      />
    </div>
  );
};

export default ProductGallery;