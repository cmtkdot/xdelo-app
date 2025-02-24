import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type Message } from "@/types/Message";
import { useToast } from "@/hooks/useToast";
import { supabase } from "@/integrations/supabase/client";

interface MediaEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  media: Message;
  onSave: (updatedMedia: Partial<Message>) => Promise<void>;
}

export function MediaEditDialog({ isOpen, onClose, media, onSave }: MediaEditDialogProps) {
  const [caption, setCaption] = useState(media.caption || "");
  const [purchaseOrder, setPurchaseOrder] = useState(media.purchase_order || "");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    try {
      setIsLoading(true);
      await onSave({
        caption,
        purchase_order: purchaseOrder,
      });
      toast({
        title: "Success",
        description: "Media details updated successfully",
      });
      onClose();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Media</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {media.public_url && (
            <div className="aspect-video relative rounded-lg overflow-hidden bg-muted">
              <img
                src={media.public_url}
                alt={caption || "Media preview"}
                className="object-contain w-full h-full"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="caption">Caption</Label>
            <Input
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Enter caption..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="purchaseOrder">Purchase Order</Label>
            <Input
              id="purchaseOrder"
              value={purchaseOrder}
              onChange={(e) => setPurchaseOrder(e.target.value)}
              placeholder="Enter purchase order number"
            />
          </div>
        </div>
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
