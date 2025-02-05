import { MediaItem, AnalyzedContent, ProcessingMetadata, processingMetadataToJson, analyzedContentToJson } from "@/types";
import { AlertCircle, Pencil, Trash2, RotateCw, Eye, Package, Calendar, Tag, Building } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ImageSwiper } from "@/components/ui/image-swiper";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MediaViewer } from "./MediaViewer/MediaViewer";

interface ProductGroupProps {
  group: MediaItem[];
  onEdit: (media: MediaItem) => void;
  onDelete: (media: MediaItem) => void;
  onView: () => void;
}

export const ProductGroup: React.FC<ProductGroupProps> = ({
  group,
  onEdit,
  onDelete,
  onView
}) => {
  // Find the main media item (original caption or first analyzed item)
  const mainMedia = group.find(media => media.is_original_caption) || 
                   group.find(media => media.analyzed_content) || 
                   group[0];
                   
  // Sort media items: images first, then videos
  const sortedMedia = [...group].sort((a, b) => {
    const aIsImage = a.mime_type?.startsWith('image/') || false;
    const bIsImage = b.mime_type?.startsWith('image/') || false;
    if (aIsImage && !bIsImage) return -1;
    if (!aIsImage && bIsImage) return 1;
    return 0;
  });

  const hasError = mainMedia.processing_state === 'error';
  const analyzedContent = mainMedia.analyzed_content;
  const { toast } = useToast();
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      return format(new Date(dateString), 'MM/dd/yyyy');
    } catch (error) {
      console.error("Error formatting date:", error);
      return '';
    }
  };

  const handleDelete = async () => {
    try {
      console.log('Attempting to delete:', {
        id: mainMedia.id,
        media_group_id: mainMedia.media_group_id
      });

      if (mainMedia.media_group_id) {
        console.log('Deleting media group:', mainMedia.media_group_id);
        const { data, error } = await supabase.rpc('delete_media_group', {
          p_media_group_id: mainMedia.media_group_id
        });

        if (error) {
          console.error('Error deleting media group:', error);
          throw error;
        }

        console.log('Media group deleted successfully:', data);
      } else {
        console.log('Deleting single message:', mainMedia.id);
        const { error } = await supabase
          .from('messages')
          .delete()
          .eq('id', mainMedia.id);

        if (error) {
          console.error('Error deleting single message:', error);
          throw error;
        }

        console.log('Single message deleted successfully');
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

  const handleReanalyze = async () => {
    try {
      const correlationId = crypto.randomUUID();
      const processingMetadata: ProcessingMetadata = {
        correlation_id: correlationId,
        timestamp: new Date().toISOString(),
        method: 'manual',
        confidence: 0,
        original_caption: mainMedia.caption || '',
        message_id: mainMedia.id,
        reanalysis_attempted: true,
        group_message_count: mainMedia.group_message_count,
        is_original_caption: mainMedia.is_original_caption
      };

      // First, update all messages in the group to pending state
      if (mainMedia.media_group_id) {
        const { error: updateError } = await supabase
          .from('messages')
          .update({
            processing_state: 'pending',
            group_caption_synced: false
          })
          .eq('media_group_id', mainMedia.media_group_id)
          .select();

        if (updateError) throw updateError;
      }

      // Log reanalysis request
      const { error } = await supabase
        .from('analysis_audit_log')
        .insert([{
          event_type: 'MANUAL_REANALYSIS_REQUESTED',
          message_id: mainMedia.id,
          media_group_id: mainMedia.media_group_id,
          old_state: mainMedia.processing_state,
          new_state: 'pending',
          analyzed_content: analyzedContent ? analyzedContentToJson(analyzedContent) : null,
          processing_details: processingMetadataToJson(processingMetadata)
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Reanalysis started",
      });
    } catch (error) {
      console.error("Error triggering reanalysis:", error);
      toast({
        title: "Error",
        description: "Failed to start reanalysis",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-all hover:shadow-lg">
      <div className="relative h-72 md:h-80">
        <ImageSwiper media={sortedMedia} />
        
        {hasError && (
          <div className="absolute top-2 right-2">
            <div className="bg-red-100 p-2 rounded-full">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-white" />
            </div>
          </div>
        )}
      </div>
      
      <div className="p-4 space-y-3">
        {/* Product Details Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Purchase Order */}
          {analyzedContent?.product_code && (
            <div className="bg-secondary/10 rounded-lg p-3 flex items-center space-x-2 hover:bg-secondary/20 transition-colors">
              <Tag className="w-4 h-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground font-medium">Purchase Order</p>
                <p className="text-sm font-medium">{analyzedContent.product_code}</p>
              </div>
            </div>
          )}
          
          {/* Quantity */}
          {analyzedContent?.quantity && (
            <div className="bg-secondary/10 rounded-lg p-3 flex items-center space-x-2 hover:bg-secondary/20 transition-colors">
              <Package className="w-4 h-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground font-medium">Quantity</p>
                <p className="text-sm font-medium">{analyzedContent.quantity}</p>
              </div>
            </div>
          )}
        </div>

        {/* Vendor and Date Row */}
        <div className="grid grid-cols-2 gap-3">
          {/* Vendor */}
          {analyzedContent?.vendor_uid && (
            <div className="bg-secondary/10 rounded-lg p-3 flex items-center space-x-2 hover:bg-secondary/20 transition-colors">
              <Building className="w-4 h-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground font-medium">Vendor</p>
                <p className="text-sm font-medium">{analyzedContent.vendor_uid}</p>
              </div>
            </div>
          )}

          {/* Purchase Date */}
          {analyzedContent?.purchase_date && (
            <div className="bg-secondary/10 rounded-lg p-3 flex items-center space-x-2 hover:bg-secondary/20 transition-colors">
              <Calendar className="w-4 h-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground font-medium">Purchase Date</p>
                <p className="text-sm font-medium">{formatDate(analyzedContent.purchase_date)}</p>
              </div>
            </div>
          )}
        </div>

        {analyzedContent?.parsing_metadata?.confidence < 0.7 && (
          <p className="text-xs text-yellow-600 dark:text-yellow-400">
            Low confidence analysis ({Math.round(analyzedContent.parsing_metadata.confidence * 100)}%)
          </p>
        )}
        
        {hasError && (
          <Alert variant="destructive" className="mt-2 p-2 text-xs">
            <AlertDescription>
              {mainMedia.error_message || 'Processing error occurred'}
            </AlertDescription>
          </Alert>
        )}
        
        <div className="flex justify-between pt-2 border-t border-border">
          <Tabs defaultValue="edit" className="w-full max-w-xs">
            <TabsList className="grid grid-cols-3 gap-2">
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <TabsTrigger 
                      value="view" 
                      onClick={() => {
                        onView();
                        setIsViewerOpen(true);
                      }}
                      className="py-2 text-black hover:text-black/80 dark:text-white dark:hover:text-white/80"
                    >
                      <Eye className="w-4 h-4" />
                    </TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent className="px-2 py-1 text-xs">View</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <TabsTrigger 
                      value="edit" 
                      onClick={() => onEdit(mainMedia)} 
                      className="py-2 text-black hover:text-black/80 dark:text-white dark:hover:text-white/80"
                    >
                      <Pencil className="w-4 h-4" />
                    </TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent className="px-2 py-1 text-xs">Edit</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <TabsTrigger 
                      value="delete" 
                      onClick={() => onDelete(mainMedia)} 
                      className="py-2 text-destructive hover:text-destructive/80"
                    >
                      <Trash2 className="w-4 h-4" />
                    </TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent className="px-2 py-1 text-xs">Delete</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <MediaViewer
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        currentGroup={sortedMedia}
      />
    </div>
  );
};