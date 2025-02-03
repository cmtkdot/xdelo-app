import { MediaItem, AnalyzedContent, processingMetadataToJson, analyzedContentToJson } from "@/types";
import { AlertCircle, Pencil, Trash2, RotateCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ImageSwiper } from "@/components/ui/image-swiper";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

interface ProductGroupProps {
  group: MediaItem[];
  onEdit: (item: MediaItem) => void;
}

export const ProductGroup = ({ group, onEdit }: ProductGroupProps) => {
  const mainMedia = group.find(media => media.is_original_caption) || group[0];
  const hasError = mainMedia.processing_state === 'error';
  const analyzedContent = group.find(media => media.is_original_caption)?.analyzed_content || mainMedia.analyzed_content;
  const { toast } = useToast();

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MM/dd/yyyy');
    } catch (error) {
      console.error("Error formatting date:", error);
      return 'Invalid Date';
    }
  };

  const formatProductCode = (code?: string) => {
    if (!code) return 'N/A';
    return code.startsWith('PO#') ? code : `PO#${code}`;
  };

  useEffect(() => {
    const checkConfidence = async () => {
      if (
        mainMedia.caption &&
        analyzedContent?.parsing_metadata?.confidence < 0.7 &&
        !analyzedContent?.parsing_metadata?.reanalysis_attempted
      ) {
        console.log('Low confidence detected, triggering reanalysis:', {
          confidence: analyzedContent?.parsing_metadata?.confidence,
          message_id: mainMedia.id,
          media_group_id: mainMedia.media_group_id
        });

        try {
          const correlationId = crypto.randomUUID();
          const processingMetadata = {
            correlation_id: correlationId,
            timestamp: new Date().toISOString(),
            method: 'hybrid' as const,
            confidence: analyzedContent?.parsing_metadata?.confidence || 0,
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

          // Log reanalysis attempt to audit log
          await supabase.from('analysis_audit_log').insert({
            message_id: mainMedia.id,
            media_group_id: mainMedia.media_group_id,
            event_type: 'REANALYSIS_REQUESTED',
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
            title: "Reanalysis Started",
            description: "The content is being reanalyzed for better accuracy.",
          });
        } catch (error) {
          console.error("Error triggering reanalysis:", error);
          toast({
            title: "Error",
            description: "Failed to start reanalysis",
            variant: "destructive",
          });
        }
      }
    };

    checkConfidence();
  }, [mainMedia.id, mainMedia.caption, analyzedContent, toast, mainMedia.media_group_id, mainMedia.processing_state, mainMedia.group_message_count]);

  const handleDelete = async () => {
    try {
      // Log deletion attempt
      await supabase.from('analysis_audit_log').insert({
        message_id: mainMedia.id,
        media_group_id: mainMedia.media_group_id,
        event_type: 'DELETE_REQUESTED',
        old_state: mainMedia.processing_state,
        processing_details: {
          group_message_count: mainMedia.group_message_count,
          is_original_caption: mainMedia.is_original_caption
        }
      });

      if (mainMedia.media_group_id) {
        const { error } = await supabase
          .from('messages')
          .delete()
          .eq('media_group_id', mainMedia.media_group_id);

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Product group deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting product group:", error);
      toast({
        title: "Error",
        description: "Failed to delete product group",
        variant: "destructive",
      });
    }
  };

  const handleReanalyze = async () => {
    try {
      const correlationId = crypto.randomUUID();
      const processingMetadata = {
        correlation_id: correlationId,
        timestamp: new Date().toISOString(),
        method: 'manual' as const,
        confidence: 0,
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
          <p className="mb-1">Code: {formatProductCode(analyzedContent?.product_code)}</p>
          <p>Vendor: {analyzedContent?.vendor_uid || 'N/A'}</p>
          <p>Purchase Date: {formatDate(analyzedContent?.purchase_date)}</p>
          <p>Quantity: {analyzedContent?.quantity || 'N/A'}</p>
          {analyzedContent?.notes && (
            <p className="text-gray-500 italic">Notes: {analyzedContent.notes}</p>
          )}
          {analyzedContent?.parsing_metadata?.confidence < 0.7 && (
            <p className="text-yellow-600">
              Low confidence analysis ({Math.round(analyzedContent.parsing_metadata.confidence * 100)}%)
            </p>
          )}
        </div>
        
        {hasError && (
          <Alert variant="destructive" className="mt-3 mb-3">
            <AlertDescription>
              {mainMedia.error_message || 'Processing error occurred'}
            </AlertDescription>
          </Alert>
        )}
        
        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(mainMedia)}
            className="flex items-center"
          >
            <Pencil className="w-4 h-4 mr-1" />
            Edit
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleReanalyze}
            className="flex items-center"
          >
            <RotateCw className="w-4 h-4 mr-1" />
            Reanalyze
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            className="flex items-center text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
};
