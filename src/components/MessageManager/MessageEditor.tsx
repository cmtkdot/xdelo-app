import { useState } from "react";
import { MediaItem } from "@/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface MessageEditorProps {
  message: MediaItem;
  onUpdate: (message: MediaItem) => void;
  onCancel: () => void;
}

export const MessageEditor = ({ message, onUpdate, onCancel }: MessageEditorProps) => {
  const [editedMessage, setEditedMessage] = useState<MediaItem>(message);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Update message in Telegram
      const { error: telegramError } = await supabase.functions.invoke('edit-telegram-message', {
        body: {
          chat_id: editedMessage.chat_id,
          message_id: editedMessage.telegram_message_id,
          caption: editedMessage.caption,
        },
      });

      if (telegramError) throw telegramError;

      // Update message in database
      const { error: dbError } = await supabase
        .from('messages')
        .update({
          caption: editedMessage.caption,
          analyzed_content: editedMessage.analyzed_content as Record<string, any>,
        })
        .eq('id', editedMessage.id);

      if (dbError) throw dbError;

      toast({
        title: "Success",
        description: "Message updated successfully",
      });

      onUpdate(editedMessage);
    } catch (error) {
      console.error("Error updating message:", error);
      toast({
        title: "Error",
        description: "Failed to update message",
        variant: "destructive",
      });
    }
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