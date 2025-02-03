import { MediaItem } from "@/types";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ProductGroupProps {
  group: MediaItem[];
  onMediaClick: (media: MediaItem, group: MediaItem[]) => void;
  onEdit: (item: MediaItem) => void;
}

export const ProductGroup = ({ group, onMediaClick, onEdit }: ProductGroupProps) => {
  const mainMedia = group[0];
  const isVideo = mainMedia.mime_type?.startsWith('video');
  const hasError = mainMedia.processing_state === 'error';

  const getMediaUrl = (media: MediaItem) => {
    if (media.public_url) return media.public_url;
    return `https://ovpsyrhigencvzlxqwqz.supabase.co/storage/v1/object/public/telegram-media/${media.file_unique_id}.${media.mime_type?.split('/')[1]}`;
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div 
        className="relative aspect-video cursor-pointer group"
        onClick={() => onMediaClick(mainMedia, group)}
      >
        {isVideo ? (
          <video
            src={getMediaUrl(mainMedia)}
            className="w-full h-full object-cover"
            autoPlay
            muted
            loop
            playsInline
          />
        ) : (
          <img
            src={getMediaUrl(mainMedia)}
            alt={mainMedia.analyzed_content?.product_name || 'Product'}
            className="w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity duration-200" />
        
        {hasError && (
          <div className="absolute top-2 right-2">
            <div className="bg-red-100 p-2 rounded-full">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
          </div>
        )}
      </div>
      
      <div className="p-4">
        <h3 className="text-lg font-semibold mb-2">
          {mainMedia.analyzed_content?.product_name || 'Untitled Product'}
        </h3>
        <p className="text-sm text-gray-600 mb-2">
          Code: {mainMedia.analyzed_content?.product_code || 'N/A'}
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