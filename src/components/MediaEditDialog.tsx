import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MediaItem } from "@/types";

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
  if (!editItem) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave();
    onClose();
  };

  return (
    <Dialog open={!!editItem} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="product_name">Product Name</Label>
            <Input
              id="product_name"
              value={editItem.analyzed_content?.product_name || ''}
              onChange={(e) => onItemChange('product_name', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="product_code">Product Code</Label>
            <Input
              id="product_code"
              value={editItem.analyzed_content?.product_code || ''}
              onChange={(e) => onItemChange('product_code', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="vendor_uid">Vendor UID</Label>
            <Input
              id="vendor_uid"
              value={editItem.analyzed_content?.vendor_uid || ''}
              onChange={(e) => onItemChange('vendor_uid', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="purchase_date">Purchase Date</Label>
            <Input
              id="purchase_date"
              type="date"
              value={formatDate(editItem.analyzed_content?.purchase_date || null) || ''}
              onChange={(e) => onItemChange('purchase_date', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              value={editItem.analyzed_content?.quantity || ''}
              onChange={(e) => onItemChange('quantity', parseInt(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              value={editItem.analyzed_content?.notes || ''}
              onChange={(e) => onItemChange('notes', e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};