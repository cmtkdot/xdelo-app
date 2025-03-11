
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { useMediaRepair } from '@/hooks/useMediaRepair';
import { useToast } from '@/hooks/useToast';
import { useMediaUpload } from '@/hooks/useMediaUpload';

export function MediaRepairButton() {
  const [loading, setLoading] = useState(false);
  const { repairMissingMediaFiles } = useMediaRepair();
  const { uploadMedia } = useMediaUpload();
  const { toast } = useToast();

  const handleRepair = async () => {
    setLoading(true);
    try {
      const result = await repairMissingMediaFiles();
      
      if (result.fixed > 0) {
        toast({
          title: "Media files repaired",
          description: `Successfully repaired ${result.fixed} media files.`
        });
      } else {
        toast({
          title: "No media files to repair",
          description: "All media files are already properly stored."
        });
      }
    } catch (error) {
      console.error('Error repairing media files:', error);
      toast({
        title: "Repair failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManualRepair = async (mediaUrl: string, fileUniqueId: string) => {
    try {
      await uploadMedia(mediaUrl, fileUniqueId);
      toast({
        title: "Media file repaired",
        description: "Successfully repaired the media file."
      });
    } catch (error) {
      console.error('Error manually repairing media file:', error);
      toast({
        title: "Manual repair failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
    }
  };

  return (
    <Button onClick={handleRepair} disabled={loading} size="sm" variant="outline" className="relative">
      {loading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4 mr-2" />
      )}
      Repair Media Files
    </Button>
  );
}
