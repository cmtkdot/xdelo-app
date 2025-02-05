import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem, FilterValues, analyzedContentToJson } from "@/types";
import { MediaEditDialog } from "@/components/MediaEditDialog";
import { useToast } from "@/components/ui/use-toast";
import { ProductGrid } from "@/components/ProductGallery/ProductGrid";
import { ProductPagination } from "@/components/ProductGallery/ProductPagination";
import { useMediaGroups } from "@/hooks/useMediaGroups";
import { format } from "date-fns";
import ProductFilters from "@/components/ProductGallery/ProductFilters";

const SECURE_ACCESS_TOKEN = "cmtktrading-gallery-2024";

const PublicGallery = () => {
  const [editItem, setEditItem] = useState<MediaItem | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();
  const [vendors, setVendors] = useState<string[]>([]);

  const [filters, setFilters] = useState<FilterValues>({
    search: "",
    vendor: "all",
    dateField: 'purchase_date',
    sortOrder: "desc",
    quantityRange: "all",
    processingState: "completed"
  });

  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('analyzed_content')
          .not('analyzed_content', 'is', null);

        if (!error && data) {
          const uniqueVendors = new Set<string>();
          data.forEach((item) => {
            const content = item.analyzed_content as { vendor_uid?: string };
            if (content?.vendor_uid) {
              uniqueVendors.add(content.vendor_uid);
            }
          });
          setVendors(Array.from(uniqueVendors).sort());
        }
      } catch (error) {
        console.error("Error fetching vendors:", error);
      }
    };

    fetchVendors();
  }, []);

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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Filters Section */}
        <div className="bg-card rounded-lg shadow-sm p-4">
          <ProductFilters
            vendors={vendors}
            filters={filters}
            onFilterChange={setFilters}
          />
        </div>

        <ProductGrid 
          mediaGroups={mediaGroups} 
          onEdit={handleEdit}
          onDelete={() => {}}
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
    </div>
  );
};

export default PublicGallery;
