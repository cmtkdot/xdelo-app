import { MediaItem } from "@/types";
import { AlertCircle, Pencil, Trash2, Eye, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ImageSwiper } from "@/components/ui/image-swiper";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MediaViewer } from "./MediaViewer/MediaViewer";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const mainMedia = group.find(media => media.is_original_caption) || 
                   group.find(media => media.analyzed_content) || 
                   group[0];
                   
  const sortedMedia = [...group].sort((a, b) => {
    const aIsImage = a.mime_type?.startsWith('image/') || false;
    const bIsImage = b.mime_type?.startsWith('image/') || false;
    if (aIsImage && !bIsImage) return -1;
    if (!aIsImage && bIsImage) return 1;
    return 0;
  });

  const hasError = mainMedia.processing_state === 'error';
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleReanalyze = async () => {
    if (isReanalyzing) return;
    
    setIsReanalyzing(true);
    try {
      const messageToReanalyze = group.find(m => m.caption) || mainMedia;
      
      const response = await supabase.functions.invoke('reanalyze-low-confidence', {
        body: {
          message_id: messageToReanalyze.id,
          media_group_id: messageToReanalyze.media_group_id,
          caption: messageToReanalyze.caption,
          correlation_id: crypto.randomUUID()
        }
      });

      if (response.error) throw response.error;

      toast({
        title: "Reanalysis Started",
        description: "Content reanalysis and media group sync initiated",
      });
    } catch (error) {
      console.error('Reanalysis error:', error);
      toast({
        title: "Error",
        description: "Failed to start reanalysis. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsReanalyzing(false);
    }
  };

  const handleDeleteConfirm = async (deleteTelegram: boolean) => {
    try {
      const mediaToDelete = mainMedia;
      
      if (deleteTelegram && mediaToDelete.telegram_message_id && mediaToDelete.chat_id) {
        // First delete from Telegram if requested
        const response = await supabase.functions.invoke('delete-telegram-message', {
          body: {
            message_id: mediaToDelete.telegram_message_id,
            chat_id: mediaToDelete.chat_id,
            media_group_id: mediaToDelete.media_group_id
          }
        });

        if (response.error) throw response.error;
      } else {
        // If we're only deleting from database, we need to delete the media file
        // The storage file deletion is handled by the cleanup_storage_on_delete trigger
        // which is only triggered when deleteTelegram is false
        const { error: storageError } = await supabase.storage
          .from('telegram-media')
          .remove([`${mediaToDelete.file_unique_id}.${mediaToDelete.mime_type?.split('/')[1] || 'jpg'}`]);

        if (storageError) {
          console.error('Storage deletion error:', storageError);
          // Continue with database deletion even if storage deletion fails
        }
      }

      // Delete from database - this will trigger the appropriate deletion trigger
      // based on whether we deleted from Telegram or not
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', mediaToDelete.id);

      if (error) throw error;

      // Call the onDelete callback
      await onDelete(mediaToDelete);
      
      toast({
        title: "Success",
        description: `Product deleted successfully${deleteTelegram ? ' from both Telegram and database' : ' from database'}`,
      });
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Error",
        description: "Failed to delete product. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleteDialogOpen(false);
    }
  };

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden transition-all hover:shadow-md">
        <div className="relative h-64" onClick={() => setIsViewerOpen(true)}>
          <ImageSwiper media={sortedMedia} />
          
          <div className="absolute top-2 right-2 flex gap-2">
            {hasError ? (
              <div className="bg-red-100 p-2 rounded-full">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-white" />
              </div>
            ) : (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-8 w-8 rounded-full bg-white/90 backdrop-blur-sm hover:bg-white dark:bg-gray-800/90 dark:hover:bg-gray-800"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReanalyze();
                      }}
                      disabled={isReanalyzing}
                    >
                      <RefreshCw className={`h-4 w-4 ${isReanalyzing ? 'animate-spin' : ''}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="px-2 py-1 text-xs">
                    {isReanalyzing ? 'Reanalyzing...' : 'Reanalyze'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
        
        <div className="p-3 space-y-2">
          {mainMedia.purchase_order && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Order ID</span>
              <span className="text-sm font-medium truncate max-w-[60%] text-right">
                {mainMedia.purchase_order}
              </span>
            </div>
          )}
          
          {mainMedia.analyzed_content?.quantity && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Quantity</span>
              <span className="text-sm font-medium">
                {mainMedia.analyzed_content.quantity}
              </span>
            </div>
          )}

          {hasError && (
            <Alert variant="destructive" className="py-1 px-2 text-xs">
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
                        onClick={(e) => {
                          e.stopPropagation();
                          onView();
                          setIsViewerOpen(true);
                        }}
                        className="py-1.5 text-black hover:text-black/80 dark:text-white dark:hover:text-white/80"
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
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(mainMedia);
                        }}
                        className="py-1.5 text-black hover:text-black/80 dark:text-white dark:hover:text-white/80"
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
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsDeleteDialogOpen(true);
                        }}
                        className="py-1.5 text-destructive hover:text-destructive/80"
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

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Do you want to delete this product from Telegram as well?
              {mainMedia.media_group_id && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Note: This will delete all related media in the group.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => handleDeleteConfirm(false)}
            >
              Delete from Database Only
            </AlertDialogAction>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => handleDeleteConfirm(true)}
            >
              Delete from Both
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};