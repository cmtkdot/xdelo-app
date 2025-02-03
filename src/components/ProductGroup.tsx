import { MediaItem } from "@/types";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ImageSwiper } from "@/components/ui/image-swiper";
import { format } from "date-fns";

interface ProductGroupProps {
  group: MediaItem[];
  onEdit: (item: MediaItem) => void;
}

export const ProductGroup = ({ group, onEdit }: ProductGroupProps) => {
  const mainMedia = group.find(media => media.is_original_caption) || group[0];
  const hasError = mainMedia.processing_state === 'error';
  const analyzedContent = group.find(media => media.is_original_caption)?.analyzed_content || mainMedia.analyzed_content;

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MM/dd/yyyy');
    } catch (error) {
      console.error("Error formatting date:", error);
      return 'Invalid Date';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="relative">
        <ImageSwiper media={group} />
        
        {hasError && (
          <div className="absolute top-2 right-2">
            <div className="bg-red-100 p-2 rounded-full">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
          </div>
        )}
      </div>
      
      <div className="p-3 md:p-4">
        <h3 className="text-base md:text-lg font-semibold mb-2">
          {analyzedContent?.product_name || 'Untitled Product'}
        </h3>
        
        <div className="space-y-1 text-xs md:text-sm text-gray-600">
          <p className="mb-1">Code: {analyzedContent?.product_code ? `PO#${analyzedContent.product_code}` : 'N/A'}</p>
          <p>Vendor: {analyzedContent?.vendor_uid || 'N/A'}</p>
          <p>Purchase Date: {formatDate(analyzedContent?.purchase_date)}</p>
          <p>Quantity: {analyzedContent?.quantity || 'N/A'}</p>
          {analyzedContent?.notes && (
            <p className="text-gray-500 italic">Notes: {analyzedContent.notes}</p>
          )}
        </div>
        
        {hasError && (
          <Alert variant="destructive" className="mt-3 mb-3">
            <AlertDescription>
              {mainMedia.error_message || 'Processing error occurred'}
              {mainMedia.retry_count > 0 && ` (Retry ${mainMedia.retry_count}/3)`}
            </AlertDescription>
          </Alert>
        )}
        
        <button
          onClick={() => onEdit(mainMedia)}
          className="text-xs md:text-sm text-blue-600 hover:text-blue-800 mt-3"
        >
          Edit Details
        </button>
      </div>
    </div>
  );
};