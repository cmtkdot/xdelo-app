import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MediaItem, TelegramData, AnalyzedContent } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useEffect, useRef } from "react";

interface MediaEditDialogProps {
  editItem: MediaItem | null;
  onClose: () => void;
  onSave: () => void;
  onItemChange: (field: string, value: any) => void;
  formatDate: (date: string | null) => string | null;
}

export const MediaEditDialog = ({
  editItem,
  onClose,
  onSave,
  onItemChange,
  formatDate,
}: MediaEditDialogProps) => {
  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  useEffect(() => {
    if (textareaRef.current && getTelegramCaption()) {
      textareaRef.current.style.height = '80px';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [editItem?.telegram_data?.message?.caption]);

  if (!editItem) return null;

  const content = editItem.analyzed_content || {};
  
  const getTelegramCaption = (): string => {
    return (editItem.telegram_data as TelegramData)?.message?.caption || '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const originalCaption = (editItem.telegram_data as TelegramData)?.message?.caption || '';
      const newCaption = getTelegramCaption();
      
      // Update caption in Telegram if changed
      if (originalCaption !== newCaption) {
        const { error: captionError } = await supabase.functions.invoke('update-telegram-caption', {
          body: {
            messageId: editItem.id,
            newCaption: newCaption
          }
        });

        if (captionError) {
          throw captionError;
        }
      }

      // Update analyzed content with new metadata
      const updatedContent: AnalyzedContent = {
        ...content,
        parsing_metadata: {
          ...(content.parsing_metadata || {}),
          method: 'manual' as const,
          confidence: 1.0,
          timestamp: new Date().toISOString(),
          last_modified: new Date().toISOString(),
          modification_source: 'user' as const,
          caption_history: [
            ...(content.parsing_metadata?.caption_history || []),
            {
              original: originalCaption,
              modified: newCaption,
              modified_at: new Date().toISOString()
            }
          ]
        }
      };

      onItemChange('analyzed_content', updatedContent);

      toast({
        title: "Success",
        description: "Product details and caption have been updated",
      });

      onSave();
      onClose();
    } catch (error) {
      console.error('Error updating message:', error);
      toast({
        title: "Error",
        description: "Failed to update details. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCaptionChange = (value: string) => {
    const updatedTelegramData = {
      ...(editItem.telegram_data as TelegramData),
      message: {
        ...(editItem.telegram_data as TelegramData)?.message,
        caption: value
      }
    };
    onItemChange('telegram_data', updatedTelegramData);
  };

  return (
    <Dialog open={!!editItem} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogTitle>Edit Media Details</DialogTitle>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="caption">Caption</Label>
            <Textarea
              ref={textareaRef}
              id="caption"
              value={getTelegramCaption()}
              onChange={(e) => {
                const textarea = e.target;
                textarea.style.height = '80px';
                textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
                handleCaptionChange(e.target.value);
              }}
              placeholder="Enter caption"
              className="min-h-[80px] max-h-[200px] resize-y"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="product_name">Product Name</Label>
            <Input
              id="product_name"
              value={content.product_name || ''}
              onChange={(e) => onItemChange('analyzed_content.product_name', e.target.value)}
              placeholder="Enter product name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="product_code">Product Code</Label>
            <Input
              id="product_code"
              value={content.product_code || ''}
              onChange={(e) => onItemChange('analyzed_content.product_code', e.target.value)}
              placeholder="Enter product code"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendor_uid">Vendor UID</Label>
            <Input
              id="vendor_uid"
              value={content.vendor_uid || ''}
              onChange={(e) => onItemChange('analyzed_content.vendor_uid', e.target.value)}
              placeholder="Enter vendor UID"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="purchase_date">Purchase Date</Label>
            <Input
              id="purchase_date"
              type="date"
              value={formatDate(content.purchase_date || null) || ''}
              onChange={(e) => onItemChange('analyzed_content.purchase_date', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              value={content.quantity || ''}
              onChange={(e) => onItemChange('analyzed_content.quantity', parseInt(e.target.value))}
              placeholder="Enter quantity"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={content.notes || ''}
              onChange={(e) => onItemChange('analyzed_content.notes', e.target.value)}
              placeholder="Enter notes"
              className="min-h-[80px] resize-y"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
          
          {/* Telegram Channel Information */}
          <div className="mt-6 border-t pt-4">
            <p className="text-xs text-gray-500">
              Telegram Info:
              {editItem.chat_id && (
                <span className="block">
                  Channel ID: {editItem.chat_id}
                </span>
              )}
              {editItem.chat_type && (
                <span className="block">
                  Type: {editItem.chat_type}
                </span>
              )}
              {editItem.message_url && (
                <a 
                  href={editItem.message_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block text-blue-500 hover:underline"
                >
                  View in Telegram
                </a>
              )}
            </p>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};