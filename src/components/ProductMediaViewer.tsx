import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Trash } from "lucide-react";
import { MediaItem } from "@/types";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface ProductMediaViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  media: MediaItem | null;
  relatedMedia: MediaItem[];
}

export const ProductMediaViewer = ({
  open,
  onOpenChange,
  media,
  relatedMedia,
}: ProductMediaViewerProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setCurrentIndex(0);
  }, [media]);

  if (!media) return null;

  const currentMedia = relatedMedia[currentIndex] || media;
  const isVideo = currentMedia.mime_type?.startsWith('video');
  const mediaUrl = `https://ovpsyrhigencvzlxqwqz.supabase.co/storage/v1/object/public/telegram-media/${currentMedia.file_unique_id}.${currentMedia.mime_type?.split('/')[1]}`;

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % relatedMedia.length);
  };

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + relatedMedia.length) % relatedMedia.length);
  };

  const handleDelete = async () => {
    try {
      setIsLoading(true);

      // First, update all messages that reference this message as their caption source
      const { error: updateError } = await supabase
        .from('messages')
        .update({ message_caption_id: null })
        .eq('message_caption_id', currentMedia.id);

      if (updateError) throw updateError;

      // Delete the file from storage
      const fileExtension = currentMedia.mime_type?.split('/')[1];
      const fileName = `${currentMedia.file_unique_id}.${fileExtension}`;
      const { error: storageError } = await supabase.storage
        .from('telegram-media')
        .remove([fileName]);

      if (storageError) {
        console.error('Error deleting file from storage:', storageError);
        // Continue with message deletion even if storage deletion fails
      }

      // Then delete the message
      const { error: deleteError } = await supabase
        .from('messages')
        .delete()
        .eq('id', currentMedia.id);

      if (deleteError) throw deleteError;

      toast({
        title: "Media deleted",
        description: "The media has been successfully deleted.",
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Error deleting media:', error);
      toast({
        title: "Error",
        description: "Failed to delete media. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full h-[80vh] p-0 bg-black">
        <div className="relative w-full h-full flex items-center justify-center">
          {isVideo ? (
            <video
              src={mediaUrl}
              className="max-h-full max-w-full object-contain"
              controls
              autoPlay
              playsInline
              onError={(e) => {
                console.error('Video loading error:', e);
                toast({
                  title: "Error",
                  description: "Failed to load video. Please try again.",
                  variant: "destructive",
                });
              }}
            />
          ) : (
            <img
              src={mediaUrl}
              alt={currentMedia.analyzed_content?.product_name || 'Product'}
              className="max-h-full max-w-full object-contain"
              onError={(e) => {
                console.error('Image loading error:', e);
                toast({
                  title: "Error",
                  description: "Failed to load image. Please try again.",
                  variant: "destructive",
                });
              }}
            />
          )}

          <div className="absolute top-4 right-4 flex gap-2">
            <Button
              variant="destructive"
              size="icon"
              onClick={handleDelete}
              disabled={isLoading}
              className="rounded-full"
            >
              <Trash className="h-4 w-4" />
            </Button>
          </div>

          {relatedMedia.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevious}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full"
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};