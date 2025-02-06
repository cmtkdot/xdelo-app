import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MediaItem } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

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
  if (!editItem) return null;

  const content = editItem.analyzed_content || {};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Update caption in Telegram
      const { error: captionError } = await supabase.functions.invoke('update-telegram-caption', {
        body: {
          messageId: editItem.id,
          newCaption: editItem.caption
        }
      });

      if (captionError) {
        throw captionError;
      }

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

  return (
    <Dialog open={!!editItem} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogTitle>Edit Media Details</DialogTitle>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="caption">Caption</Label>
            <Input
              id="caption"
              value={editItem.caption || ''}
              onChange={(e) => onItemChange('caption', e.target.value)}
              placeholder="Enter caption"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="product_name">Product Name</Label>
            <Input
              id="product_name"
              value={content.product_name || ''}
              onChange={(e) => onItemChange('analyzed_content.product_name', e.target.value)}
              placeholder="Enter product name"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="product_code">Product Code</Label>
            <Input
              id="product_code"
              value={content.product_code || ''}
              onChange={(e) => onItemChange('analyzed_content.product_code', e.target.value)}
              placeholder="Enter product code"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="vendor_uid">Vendor UID</Label>
            <Input
              id="vendor_uid"
              value={content.vendor_uid || ''}
              onChange={(e) => onItemChange('analyzed_content.vendor_uid', e.target.value)}
              placeholder="Enter vendor UID"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="purchase_date">Purchase Date</Label>
            <Input
              id="purchase_date"
              type="date"
              value={formatDate(content.purchase_date || null) || ''}
              onChange={(e) => onItemChange('analyzed_content.purchase_date', e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              value={content.quantity || ''}
              onChange={(e) => onItemChange('analyzed_content.quantity', parseInt(e.target.value))}
              placeholder="Enter quantity"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              value={content.notes || ''}
              onChange={(e) => onItemChange('analyzed_content.notes', e.target.value)}
              placeholder="Enter notes"
              className="mt-1"
            />
          </div>
          <div className="flex justify-end gap-2">
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