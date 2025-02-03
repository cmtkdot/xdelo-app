import { useState } from "react";
import { MediaItem } from "@/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

interface MessageEditorProps {
  message: MediaItem;
  onUpdate: (message: MediaItem) => void;
  onCancel: () => void;
}

export const MessageEditor = ({ message, onUpdate, onCancel }: MessageEditorProps) => {
  const [editedMessage, setEditedMessage] = useState<MediaItem>(message);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(editedMessage);
  };

  const handleAnalyzedContentChange = (field: string, value: any) => {
    setEditedMessage(prev => ({
      ...prev,
      analyzed_content: {
        ...(prev.analyzed_content || {}),
        [field]: value
      }
    }));
  };

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="caption">Caption</Label>
          <Textarea
            id="caption"
            value={editedMessage.caption || ''}
            onChange={(e) => setEditedMessage(prev => ({ ...prev, caption: e.target.value }))}
            className="min-h-[100px]"
          />
        </div>

        <div>
          <Label htmlFor="product_name">Product Name</Label>
          <Input
            id="product_name"
            value={editedMessage.analyzed_content?.product_name || ''}
            onChange={(e) => handleAnalyzedContentChange('product_name', e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="product_code">Product Code</Label>
          <Input
            id="product_code"
            value={editedMessage.analyzed_content?.product_code || ''}
            onChange={(e) => handleAnalyzedContentChange('product_code', e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="vendor_uid">Vendor UID</Label>
          <Input
            id="vendor_uid"
            value={editedMessage.analyzed_content?.vendor_uid || ''}
            onChange={(e) => handleAnalyzedContentChange('vendor_uid', e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="quantity">Quantity</Label>
          <Input
            id="quantity"
            type="number"
            value={editedMessage.analyzed_content?.quantity || ''}
            onChange={(e) => handleAnalyzedContentChange('quantity', parseInt(e.target.value))}
          />
        </div>

        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={editedMessage.analyzed_content?.notes || ''}
            onChange={(e) => handleAnalyzedContentChange('notes', e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">Save Changes</Button>
        </div>
      </form>
    </Card>
  );
};