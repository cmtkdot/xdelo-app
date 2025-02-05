
import { MediaItem, ProcessingMetadata, analyzedContentToJson } from "@/types";
import { Eye, Pencil, RotateCw, Trash2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface ProductActionsProps {
  mainMedia: MediaItem;
  analyzedContent: any;
  onEdit: () => void;
  onView: () => void;
  onDelete: () => void;
}

export const ProductActions = ({ 
  mainMedia, 
  analyzedContent, 
  onEdit, 
  onView,
  onDelete 
}: ProductActionsProps) => {
  const { toast } = useToast();

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
    <Tabs defaultValue="edit" className="w-full max-w-xs">
      <TabsList className="grid grid-cols-4 gap-2">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <TabsTrigger 
                value="view" 
                onClick={onView} 
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
                onClick={onEdit} 
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
                onClick={onDelete} 
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
  );
};

