import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem, FilterValues } from "@/types";
import { MediaEditDialog } from "@/components/MediaEditDialog";
import { useToast } from "@/components/ui/use-toast";
import { ProductGrid } from "@/components/ProductGallery/ProductGrid";
import { ProductPagination } from "@/components/ProductGallery/ProductPagination";
import { useMediaGroups } from "@/hooks/useMediaGroups";
import ProductFilters from "@/components/ProductGallery/ProductFilters";

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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 space-y-6">
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
        />
      </div>
    </div>
  );
};

export default PublicGallery;
