import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem, FilterValues } from "@/types";
import { MediaEditDialog } from "@/components/MediaEditDialog";
import { useToast } from "@/components/ui/use-toast";
import { ProductGrid } from "@/components/ProductGallery/ProductGrid";
import { ProductPagination } from "@/components/ProductGallery/ProductPagination";
import { useMediaGroups } from "@/hooks/useMediaGroups";
import { format } from "date-fns";

const PublicGallery = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [editItem, setEditItem] = useState<MediaItem | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedGroupIndex, setSelectedGroupIndex] = useState<number | null>(null);
  const [isValidToken, setIsValidToken] = useState(false);
  const { toast } = useToast();

  // Default filters for public view
  const filters: FilterValues = {
    search: "",
    vendor: "all",
    dateFrom: undefined,
    dateTo: undefined,
    dateField: 'purchase_date',
    sortOrder: "desc",
    productCode: "all",
    quantityRange: "all",
    processingState: "all"
  };

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setIsValidToken(false);
        return;
      }

      const { data, error } = await supabase.rpc('validate_secure_token', {
        token: token
      });

      if (error) {
        console.error('Error validating token:', error);
        toast({
          title: "Error",
          description: "Invalid or expired access token",
          variant: "destructive",
        });
        setIsValidToken(false);
        return;
      }

      setIsValidToken(data);
    };

    validateToken();
  }, [token, toast]);

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
      const { error } = await supabase
        .from('messages')
        .update({
          analyzed_content: editItem.analyzed_content,
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

  if (!isValidToken) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Invalid Access Token</h1>
          <p className="mt-2 text-gray-600">Please check your URL and try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <ProductGrid 
          mediaGroups={mediaGroups} 
          onEdit={handleEdit}
          onGroupSelect={(index) => setSelectedGroupIndex(index)}
          selectedGroupIndex={selectedGroupIndex}
          onPrevious={() => {
            if (selectedGroupIndex !== null && selectedGroupIndex > 0) {
              setSelectedGroupIndex(selectedGroupIndex - 1);
            }
          }}
          onNext={() => {
            if (selectedGroupIndex !== null && selectedGroupIndex < groupsArray.length - 1) {
              setSelectedGroupIndex(selectedGroupIndex + 1);
            }
          }}
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