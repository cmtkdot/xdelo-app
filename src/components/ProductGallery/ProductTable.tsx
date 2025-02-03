import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MediaItem } from "@/types";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface ProductTableProps {
  mediaGroups: { [key: string]: MediaItem[] };
}

export const ProductTable = ({ mediaGroups }: ProductTableProps) => {
  const { toast } = useToast();
  const [editingCell, setEditingCell] = useState<{
    id: string;
    field: string;
    value: string;
  } | null>(null);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MM/dd/yyyy');
    } catch (error) {
      console.error("Error formatting date:", error);
      return 'Invalid Date';
    }
  };

  const formatProductCode = (code?: string) => {
    if (!code) return 'N/A';
    return code.startsWith('PO#') ? code : `PO#${code}`;
  };

  const updateCaption = async (mainMedia: MediaItem, field: string, value: any) => {
    try {
      let newCaption = mainMedia.caption || '';
      const analyzed = mainMedia.analyzed_content || {};
      
      // Update the analyzed content based on the field
      const updatedContent = {
        ...analyzed,
        [field]: value
      };

      // Reconstruct caption based on the analyzed content pattern
      if (field === 'product_name') {
        newCaption = `${value} #${analyzed.product_code || ''} x${analyzed.quantity || ''} ${analyzed.notes ? `(${analyzed.notes})` : ''}`;
      } else if (field === 'product_code') {
        newCaption = `${analyzed.product_name || ''} #${value} x${analyzed.quantity || ''} ${analyzed.notes ? `(${analyzed.notes})` : ''}`;
      } else if (field === 'quantity') {
        newCaption = `${analyzed.product_name || ''} #${analyzed.product_code || ''} x${value} ${analyzed.notes ? `(${analyzed.notes})` : ''}`;
      } else if (field === 'notes') {
        newCaption = `${analyzed.product_name || ''} #${analyzed.product_code || ''} x${analyzed.quantity || ''} (${value})`;
      }

      // Update message in Supabase
      const { error: updateError } = await supabase
        .from('messages')
        .update({
          analyzed_content: updatedContent,
          caption: newCaption
        })
        .eq('id', mainMedia.id);

      if (updateError) throw updateError;

      // Update caption in Telegram
      const { error: webhookError } = await supabase.functions.invoke('edit-telegram-message', {
        body: {
          message_id: mainMedia.telegram_message_id,
          chat_id: mainMedia.chat_id,
          caption: newCaption
        }
      });

      if (webhookError) throw webhookError;

      toast({
        title: "Success",
        description: "Product details updated successfully",
      });
    } catch (error) {
      console.error("Error updating product:", error);
      toast({
        title: "Error",
        description: "Failed to update product details",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (mainMedia: MediaItem) => {
    try {
      // Delete from Supabase
      const { error: deleteError } = await supabase
        .from('messages')
        .delete()
        .eq('media_group_id', mainMedia.media_group_id);

      if (deleteError) throw deleteError;

      toast({
        title: "Success",
        description: "Product group deleted from database",
      });
    } catch (error) {
      console.error("Error deleting product group:", error);
      toast({
        title: "Error",
        description: "Failed to delete product group",
        variant: "destructive",
      });
    }
  };

  const handleTelegramDelete = async (mainMedia: MediaItem) => {
    try {
      const { error } = await supabase.functions.invoke('delete-telegram-message', {
        body: {
          message_id: mainMedia.telegram_message_id,
          chat_id: mainMedia.chat_id
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Messages deleted from Telegram",
      });
    } catch (error) {
      console.error("Error deleting from Telegram:", error);
      toast({
        title: "Error",
        description: "Failed to delete from Telegram",
        variant: "destructive",
      });
    }
  };

  const handleCellClick = (id: string, field: string, value: any) => {
    setEditingCell({ id, field, value: value?.toString() || '' });
  };

  const handleCellBlur = async (mainMedia: MediaItem) => {
    if (!editingCell) return;

    const { field, value } = editingCell;
    if (value === (mainMedia.analyzed_content?.[field]?.toString() || '')) {
      setEditingCell(null);
      return;
    }

    await updateCaption(mainMedia, field, value);
    setEditingCell(null);
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product Name</TableHead>
            <TableHead>Product Code</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Purchase Date</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead>Caption</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Object.values(mediaGroups).map((group) => {
            const mainMedia = group.find(media => media.is_original_caption) || group[0];
            const analyzedContent = mainMedia.analyzed_content;
            const hasError = mainMedia.processing_state === 'error';

            return (
              <TableRow key={mainMedia.id}>
                <TableCell onClick={() => handleCellClick(mainMedia.id, 'product_name', analyzedContent?.product_name)}>
                  {editingCell?.id === mainMedia.id && editingCell.field === 'product_name' ? (
                    <Input
                      value={editingCell.value}
                      onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                      onBlur={() => handleCellBlur(mainMedia)}
                      autoFocus
                    />
                  ) : (
                    analyzedContent?.product_name || 'Untitled Product'
                  )}
                </TableCell>
                <TableCell onClick={() => handleCellClick(mainMedia.id, 'product_code', analyzedContent?.product_code)}>
                  {editingCell?.id === mainMedia.id && editingCell.field === 'product_code' ? (
                    <Input
                      value={editingCell.value}
                      onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                      onBlur={() => handleCellBlur(mainMedia)}
                      autoFocus
                    />
                  ) : (
                    formatProductCode(analyzedContent?.product_code)
                  )}
                </TableCell>
                <TableCell onClick={() => handleCellClick(mainMedia.id, 'vendor_uid', analyzedContent?.vendor_uid)}>
                  {editingCell?.id === mainMedia.id && editingCell.field === 'vendor_uid' ? (
                    <Input
                      value={editingCell.value}
                      onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                      onBlur={() => handleCellBlur(mainMedia)}
                      autoFocus
                    />
                  ) : (
                    analyzedContent?.vendor_uid || 'N/A'
                  )}
                </TableCell>
                <TableCell onClick={() => handleCellClick(mainMedia.id, 'purchase_date', analyzedContent?.purchase_date)}>
                  {editingCell?.id === mainMedia.id && editingCell.field === 'purchase_date' ? (
                    <Input
                      value={editingCell.value}
                      onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                      onBlur={() => handleCellBlur(mainMedia)}
                      autoFocus
                    />
                  ) : (
                    formatDate(analyzedContent?.purchase_date)
                  )}
                </TableCell>
                <TableCell onClick={() => handleCellClick(mainMedia.id, 'quantity', analyzedContent?.quantity)}>
                  {editingCell?.id === mainMedia.id && editingCell.field === 'quantity' ? (
                    <Input
                      type="number"
                      value={editingCell.value}
                      onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                      onBlur={() => handleCellBlur(mainMedia)}
                      autoFocus
                    />
                  ) : (
                    analyzedContent?.quantity || 'N/A'
                  )}
                </TableCell>
                <TableCell onClick={() => handleCellClick(mainMedia.id, 'notes', analyzedContent?.notes)}>
                  {editingCell?.id === mainMedia.id && editingCell.field === 'notes' ? (
                    <Input
                      value={editingCell.value}
                      onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                      onBlur={() => handleCellBlur(mainMedia)}
                      autoFocus
                    />
                  ) : (
                    analyzedContent?.notes || 'N/A'
                  )}
                </TableCell>
                <TableCell>{mainMedia.caption || 'N/A'}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    hasError ? 'bg-red-100 text-red-800' : 
                    mainMedia.processing_state === 'completed' ? 'bg-green-100 text-green-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {mainMedia.processing_state || 'pending'}
                  </span>
                </TableCell>
                <TableCell>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Product Group</AlertDialogTitle>
                        <AlertDialogDescription>
                          Do you want to delete this product group from both the database and Telegram?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(mainMedia)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Delete from Database Only
                        </AlertDialogAction>
                        <AlertDialogAction
                          onClick={async () => {
                            await handleDelete(mainMedia);
                            await handleTelegramDelete(mainMedia);
                          }}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Delete from Both
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};