
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCw } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { repairMediaBatch } from '@/lib/mediaOperations';

interface MediaFixButtonProps {
  messageIds: string[];
  onSuccess?: () => void;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  label?: string;
  showIcon?: boolean;
}

export function MediaFixButton({
  messageIds,
  onSuccess,
  variant = 'default',
  size = 'default',
  label = 'Fix Media',
  showIcon = true
}: MediaFixButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleFix = async () => {
    if (!messageIds.length) {
      toast({
        title: 'No messages selected',
        description: 'Please select at least one message to fix.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      // Convert single ID to array if needed
      const idsToFix = Array.isArray(messageIds) ? messageIds : [messageIds];
      
      const result = await repairMediaBatch(idsToFix);
      
      if (result.success) {
        toast({
          title: 'Media Fixed',
          description: `Successfully repaired ${result.successful} out of ${idsToFix.length} media items.`,
        });
        
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Failed to repair media',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error repairing media:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred while trying to repair media.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleFix}
      disabled={isProcessing || !messageIds.length}
    >
      {showIcon && <RotateCw className={`h-4 w-4 ${isProcessing ? 'animate-spin' : ''} ${label ? 'mr-2' : ''}`} />}
      {label}
    </Button>
  );
}
