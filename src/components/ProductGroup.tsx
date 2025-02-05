import { MediaItem, AnalyzedContent, ProcessingMetadata, processingMetadataToJson, analyzedContentToJson } from "@/types";
import { AlertCircle, Pencil, Trash2, RotateCw, Eye } from "lucide-react";
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
      await supabase.from('analysis_audit_log').insert({
        message_id: mainMedia.id,
        media_group_id: mainMedia.media_group_id,
        event_type: 'MANUAL_REANALYSIS_REQUESTED',
        old_state: mainMedia.processing_state,
        new_state: 'pending',
        analyzed_content: analyzedContent ? analyzedContentToJson(analyzedContent) : null,
        processing_details: processingMetadataToJson(processingMetadata)
      });

      const { error } = await supabase.functions.invoke('reanalyze-low-confidence', {
        body: {
          message_id: mainMedia.id,
          media_group_id: mainMedia.media_group_id,
          caption: mainMedia.caption,
          analyzed_content: analyzedContent,
          correlation_id: correlationId
        }
      });

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
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="relative h-72 md:h-80">
        <ImageSwiper media={sortedMedia} />
        
        {hasError && (
          <div className="absolute top-2 right-2">
            <div className="bg-red-100 p-2 rounded-full">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-white" />
            </div>
          </div>
        )}

        {/* Core product info overlaid on image bottom */}
        <div className="absolute bottom-0 left-0 right-0 bg-black/50 backdrop-blur-sm p-3 text-white">
          <h3 className="text-base md:text-lg font-semibold mb-1">
            {analyzedContent?.product_name || 'Untitled Product'}
          </h3>
          <div className="text-sm opacity-90">
            {formatDate(analyzedContent?.purchase_date)}
          </div>
        </div>
      </div>
      
      <div className="p-3 space-y-2">
        {/* Secondary info in compact form */}
        <div className="space-y-1 text-xs text-gray-600">
          {analyzedContent?.product_code && (
            <p>PO#: {analyzedContent.product_code}</p>
          )}
          {analyzedContent?.vendor_uid && (
            <p>Vendor: {analyzedContent.vendor_uid}</p>
          )}
        </div>

        {analyzedContent?.parsing_metadata?.confidence < 0.7 && (
          <p className="text-xs text-yellow-600">
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
        
        <div className="flex justify-center gap-2 pt-1">
          <Tabs defaultValue="edit" className="w-full max-w-xs">
            <TabsList className="grid grid-cols-4 gap-2">
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <TabsTrigger 
                      value="view" 
                      onClick={() => setIsViewerOpen(true)} 
                      className="py-2 text-black hover:text-black/80"
                    >
                      <Eye className="w-4 h-4 text-black dark:text-white" />
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
                      className="py-2 text-black hover:text-black/80"
                    >
                      <Pencil className="w-4 h-4 text-black dark:text-white" />
                    </TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent className="px-2 py-1 text-xs">Edit</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <TabsTrigger 
                      value="reanalyze" 
                      onClick={handleReanalyze} 
                      className="py-2 text-black hover:text-black/80"
                    >
                      <RotateCw className="w-4 h-4 text-black dark:text-white" />
                    </TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent className="px-2 py-1 text-xs">Reanalyze</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <TabsTrigger 
                      value="delete" 
                      onClick={handleDelete} 
                      className="py-2 text-destructive hover:text-destructive/80"
                    >
                      <Trash2 className="w-4 h-4 text-destructive dark:text-white" />
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
        onPrevious={onPrevious}
        onNext={onNext}
        hasPrevious={hasPrevious}
        hasNext={hasNext}
      />
    </div>
  );
};
