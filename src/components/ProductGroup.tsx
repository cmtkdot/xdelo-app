import { MediaItem } from "@/types";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ImageSwiper } from "@/components/ui/image-swiper";

interface ProductGroupProps {
  group: MediaItem[];
  onMediaClick: (media: MediaItem, group: MediaItem[]) => void;
  onEdit: (item: MediaItem) => void;
}

export const ProductGroup = ({ group, onMediaClick, onEdit }: ProductGroupProps) => {
  // Find the message with original caption or the first message as fallback
  const mainMedia = group.find(media => media.is_original_caption) || group[0];
  const hasError = mainMedia.processing_state === 'error';

  // Get the analyzed content from the original caption message
  const analyzedContent = group.find(media => media.is_original_caption)?.analyzed_content || mainMedia.analyzed_content;

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="relative">
        <div 
          className="absolute inset-0 z-20"
          onClick={() => onMediaClick(mainMedia, group)}
        />
        <ImageSwiper media={group} />
        
        {hasError && (
          <div className="absolute top-2 right-2 z-30">
            <div className="bg-red-100 p-2 rounded-full">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
          </div>
        )}
      </div>
      
      <div className="p-4">
        <h3 className="text-lg font-semibold mb-2">
          {analyzedContent?.product_name || 'Untitled Product'}
        </h3>
        <p className="text-sm text-gray-600 mb-2">
          Code: {analyzedContent?.product_code || 'N/A'}
        </p>
        
        {hasError && (
          <Alert variant="destructive" className="mb-3">
            <AlertDescription>
              {mainMedia.error_message || 'Processing error occurred'}
              {mainMedia.retry_count > 0 && ` (Retry ${mainMedia.retry_count}/3)`}
            </AlertDescription>
          </Alert>
        )}
        
        <button
          onClick={() => onEdit(mainMedia)}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          Edit Details
        </button>
      </div>
    </div>
  );
};