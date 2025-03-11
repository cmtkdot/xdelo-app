
import React from 'react';
import { Button } from '@/components/ui/button';
import { useMediaUpload } from '@/hooks/useMediaUpload';
import { useToast } from '@/hooks/useToast';

interface MediaRepairButtonProps {
  fileUrl: string;
  fileUniqueId: string;
  extension: string;
  onSuccess?: () => void;
}

export function MediaRepairButton({ 
  fileUrl, 
  fileUniqueId, 
  extension,
  onSuccess 
}: MediaRepairButtonProps) {
  const { uploadMedia, isUploading } = useMediaUpload();
  const { toast } = useToast();

  const handleRepair = async () => {
    try {
      await uploadMedia(fileUrl, fileUniqueId, extension);
      onSuccess?.();
      toast({
        title: "Media repaired",
        description: "File has been re-uploaded successfully"
      });
    } catch (error) {
      toast({
        title: "Repair failed",
        description: error instanceof Error ? error.message : "Failed to repair media",
        variant: "destructive"
      });
    }
  };

  return (
    <Button 
      onClick={handleRepair}
      disabled={isUploading}
      variant="outline"
      size="sm"
    >
      {isUploading ? 'Repairing...' : 'Repair Media'}
    </Button>
  );
}
