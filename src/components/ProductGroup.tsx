
import { MediaItem } from "@/types";
import { AlertCircle } from "lucide-react";
import { ImageSwiper } from "@/components/ui/image-swiper";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { MediaViewer } from "./MediaViewer/MediaViewer";
import { ProductInfo } from "./ProductGroup/ProductInfo";
import { ProductDetails } from "./ProductGroup/ProductDetails";
import { ProductActions } from "./ProductGroup/ProductActions";
import { getMainMedia, getAnalyzedContent } from "./ProductGroup/utils";

interface ProductGroupProps {
  group: MediaItem[];
  onEdit: (item: MediaItem) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

export const ProductGroup = ({ 
  group, 
  onEdit,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext 
}: ProductGroupProps) => {
  const mainMedia = getMainMedia(group);
  const hasError = mainMedia.processing_state === 'error';
  const analyzedContent = getAnalyzedContent(group);
  const { toast } = useToast();
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const handleDelete = async () => {
    try {
      if (mainMedia.media_group_id) {
        const { data, error } = await supabase.rpc('delete_media_group', {
          p_media_group_id: mainMedia.media_group_id
        });

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('messages')
          .delete()
          .eq('id', mainMedia.id);

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Product deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting product:", error);
      toast({
        title: "Error",
        description: "Failed to delete product. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="relative h-72 md:h-80">
        <ImageSwiper media={group} />
        
        {hasError && (
          <div className="absolute top-2 right-2">
            <div className="bg-red-100 p-2 rounded-full">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-white" />
            </div>
          </div>
        )}

        <ProductInfo group={group} />
      </div>
      
      <div className="p-3 space-y-2">
        <ProductDetails 
          group={group} 
          hasError={hasError} 
          errorMessage={mainMedia.error_message} 
        />
        
        <div className="flex justify-center gap-2 pt-1">
          <ProductActions
            mainMedia={mainMedia}
            analyzedContent={analyzedContent}
            onEdit={() => onEdit(mainMedia)}
            onView={() => setIsViewerOpen(true)}
            onDelete={handleDelete}
          />
        </div>
      </div>

      <MediaViewer
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        currentGroup={group}
        onPrevious={onPrevious}
        onNext={onNext}
        hasPrevious={hasPrevious}
        hasNext={hasNext}
      />
    </div>
  );
};

