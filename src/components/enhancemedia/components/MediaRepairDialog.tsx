
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useUnifiedMediaRepair } from '@/hooks/useUnifiedMediaRepair';
import { useToast } from '@/hooks/useToast';
import { Loader2 } from 'lucide-react';

interface MediaRepairDialogProps {
  isOpen: boolean;
  onClose: () => void;
  messageIds: string[];
  mediaGroupId?: string;
}

export function MediaRepairDialog({
  isOpen,
  onClose,
  messageIds,
  mediaGroupId
}: MediaRepairDialogProps) {
  const [options, setOptions] = useState({
    fixContentTypes: true,
    forceRedownload: false,
    checkStorageOnly: false
  });
  const { repairMedia, isRepairing } = useUnifiedMediaRepair();
  const { toast } = useToast();

  const handleOptionChange = (option: keyof typeof options) => {
    setOptions(prev => ({ ...prev, [option]: !prev[option] }));
  };

  const handleRepair = async () => {
    try {
      const result = await repairMedia({
        messageIds,
        mediaGroupId,
        fixContentTypes: options.fixContentTypes,
        forceRedownload: options.forceRedownload,
        checkStorageOnly: options.checkStorageOnly,
      });

      toast({
        title: result.success ? 'Repair successful' : 'Repair failed',
        description: result.message,
        variant: result.success ? 'default' : 'destructive',
      });

      if (result.success) {
        onClose();
      }
    } catch (error) {
      console.error('Error repairing media:', error);
      toast({
        title: 'Repair failed',
        description: `Error: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Repair Media</DialogTitle>
          <DialogDescription>
            Select repair options for {messageIds.length} media item{messageIds.length !== 1 ? 's' : ''}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="fixContentTypes" 
              checked={options.fixContentTypes} 
              onCheckedChange={() => handleOptionChange('fixContentTypes')}
            />
            <Label htmlFor="fixContentTypes">Fix content types</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="forceRedownload" 
              checked={options.forceRedownload} 
              onCheckedChange={() => handleOptionChange('forceRedownload')}
            />
            <Label htmlFor="forceRedownload">Force redownload from Telegram</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="checkStorageOnly" 
              checked={options.checkStorageOnly} 
              onCheckedChange={() => handleOptionChange('checkStorageOnly')}
            />
            <Label htmlFor="checkStorageOnly">Check storage status only</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleRepair} disabled={isRepairing}>
            {isRepairing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Repairing...
              </>
            ) : (
              'Repair Media'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
