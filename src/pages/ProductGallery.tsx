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
import { format } from "date-fns";

const ProductGallery = () => {
  const [editItem, setEditItem] = useState<MediaItem | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedGroupIndex, setSelectedGroupIndex] = useState<number | null>(null);
  const [filters, setFilters] = useState<FilterValues>({
    search: "",
    vendor: "all",
    dateFrom: undefined,
    dateTo: undefined,
    dateField: 'purchase_date', // Set default date field to purchase_date
    sortOrder: "desc", // Set default sort order to desc (newest first)
    productCode: "all",
    quantityRange: "all",
    processingState: "all"
  });

  const { toast } = useToast();
  const vendors = useVendors();
  const { data } = useMediaGroups(currentPage, filters);
  const mediaGroups = data?.mediaGroups ?? {};
  const totalPages = data?.totalPages ?? 1;
  const groupsArray = Object.values(mediaGroups);

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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    try {
      return format(new Date(dateString), 'yyyy-MM-dd');
    } catch (error) {
      console.error("Error formatting date:", error);
      return null;
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
          analyzed_content: analyzedContentJson,
          processing_state: 'completed',
          group_caption_synced: true
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

  const handlePrevious = () => {
    if (selectedGroupIndex !== null && selectedGroupIndex > 0) {
      setSelectedGroupIndex(selectedGroupIndex - 1);
    }
  };

  const handleNext = () => {
    if (selectedGroupIndex !== null && selectedGroupIndex < groupsArray.length - 1) {
      setSelectedGroupIndex(selectedGroupIndex + 1);
    }
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

      <ProductGrid 
        mediaGroups={mediaGroups} 
        onEdit={handleEdit}
        onGroupSelect={(index) => setSelectedGroupIndex(index)}
        selectedGroupIndex={selectedGroupIndex}
        onPrevious={handlePrevious}
        onNext={handleNext}
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
        onItemChange={handleItemChange}
        formatDate={formatDate}
      />
    </div>
  );
};

export default ProductGallery;