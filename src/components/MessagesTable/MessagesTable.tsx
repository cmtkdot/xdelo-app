import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { useTelegramOperations } from "@/hooks/useTelegramOperations";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Message {
  id: string;
  created_at: string;
<<<<<<< Updated upstream
  caption?: string;
  product_name?: string;
  vendor_name?: string;
  product_quantity?: number;
  telegram_message_id?: number;
  chat_id?: number;
  media_group_id?: string;
  file_unique_id?: string;
  mime_type?: string;
=======
  glide_row_id?: string;
  glide_stock?: number;
  analyzed_content?: {
    product_name?: string;
    vendor_uid?: string;
    product_code?: string;
    quantity?: number;
    purchase_date?: string;
  };
>>>>>>> Stashed changes
}

interface EditableMessage extends Message {
  isEditing: boolean;
}

interface MessagesTableProps {
  messages: Message[];
}

export const MessagesTable: React.FC<MessagesTableProps> = ({ messages: initialMessages }) => {
<<<<<<< Updated upstream
  const [messages, setMessages] = useState<EditableMessage[]>(initialMessages);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);
  const { handleDelete, handleSave, isProcessing } = useTelegramOperations();
=======
  const [messages, setMessages] = useState<EditableMessage[]>(initialMessages.map(message => ({
    id: message.id,
    isEditing: false,
    created_at: message.created_at,
    glide_row_id: message.glide_row_id,
    glide_stock: message.glide_stock,
    analyzed_content: message.analyzed_content,
  })));
>>>>>>> Stashed changes
  const { toast } = useToast();

  const handleEdit = (id: string) => {
    setMessages(prev =>
      prev.map(message =>
        message.id === id
          ? { ...message, isEditing: true }
          : message
      )
    );
  };

  const handleCancel = (id: string) => {
    setMessages(prev =>
      prev.map(message =>
        message.id === id
          ? {
              id: message.id,
              isEditing: false,
              created_at: initialMessages.find(m => m.id === id)!.created_at,
              glide_row_id: initialMessages.find(m => m.id === id)!.glide_row_id,
              glide_stock: initialMessages.find(m => m.id === id)!.glide_stock,
              analyzed_content: initialMessages.find(m => m.id === id)!.analyzed_content,
            }
          : message
      )
    );
  };

  const handleSaveClick = async (id: string) => {
    const message = messages.find(m => m.id === id);
    if (!message) return;

<<<<<<< Updated upstream
    await handleSave(message, message.caption || '');
    
    setMessages(prev =>
      prev.map(m =>
        m.id === id
          ? { ...m, isEditing: false }
          : m
      )
    );
  };

  const handleDeleteClick = (message: Message) => {
    setMessageToDelete(message);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async (deleteTelegram: boolean) => {
    if (!messageToDelete) return;

    await handleDelete(messageToDelete, deleteTelegram);
    setMessages(prev => prev.filter(m => m.id !== messageToDelete.id));
    setIsDeleteDialogOpen(false);
    setMessageToDelete(null);
  };

=======
    const updateData = {
      glide_row_id: message.glide_row_id,
      glide_stock: message.glide_stock,
      analyzed_content: {
        product_name: message.analyzed_content?.product_name,
        vendor_uid: message.analyzed_content?.vendor_uid,
        product_code: message.analyzed_content?.product_code,
        quantity: message.analyzed_content?.quantity,
        purchase_date: message.analyzed_content?.purchase_date
      }
    };

    try {
      const { error } = await supabase
        .from('messages')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      setMessages(prev =>
        prev.map(msg =>
          msg.id === id
            ? { ...msg, isEditing: false }
            : msg
        )
      );

      toast({
        title: "Success",
        description: "Message updated successfully",
      });
    } catch (error) {
      console.error('Error updating message:', error);
      toast({
        title: "Error",
        description: "Failed to update message",
        variant: "destructive",
      });
    }
  };

>>>>>>> Stashed changes
  const handleChange = (id: string, field: keyof Message, value: string | number) => {
    setMessages(prev =>
      prev.map(message =>
        message.id === id
          ? { ...message, [field]: value }
          : message
      )
    );
  };

  const handleAnalyzedContentChange = (id: string, field: keyof Message['analyzed_content'], value: string | number) => {
    setMessages(prev =>
      prev.map(message =>
        message.id === id
          ? { ...message, analyzed_content: { ...message.analyzed_content, [field]: value } }
          : message
      )
    );
  };

  return (
<<<<<<< Updated upstream
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Created At</TableHead>
              <TableHead>Caption</TableHead>
              <TableHead>Product Name</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
=======
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Created At</TableHead>
            <TableHead>Product Name</TableHead>
            <TableHead>Vendor UID</TableHead>
            <TableHead>Product Code</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Purchase Date</TableHead>
            <TableHead>Glide Synced</TableHead>
            <TableHead>Current Stock</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {messages.map((message) => (
            <TableRow key={message.id}>
              <TableCell>
                {format(new Date(message.created_at), 'yyyy-MM-dd HH:mm:ss')}
              </TableCell>
              <TableCell>
                {message.isEditing ? (
                  <Input
                    value={message.analyzed_content?.product_name || ''}
                    onChange={(e) => handleAnalyzedContentChange(message.id, 'product_name', e.target.value)}
                    className="w-full"
                  />
                ) : (
                  message.analyzed_content?.product_name || '-'
                )}
              </TableCell>
              <TableCell>
                {message.isEditing ? (
                  <Input
                    value={message.analyzed_content?.vendor_uid || ''}
                    onChange={(e) => handleAnalyzedContentChange(message.id, 'vendor_uid', e.target.value)}
                    className="w-full"
                  />
                ) : (
                  message.analyzed_content?.vendor_uid || '-'
                )}
              </TableCell>
              <TableCell>
                {message.isEditing ? (
                  <Input
                    value={message.analyzed_content?.product_code || ''}
                    onChange={(e) => handleAnalyzedContentChange(message.id, 'product_code', e.target.value)}
                    className="w-full"
                  />
                ) : (
                  message.analyzed_content?.product_code || '-'
                )}
              </TableCell>
              <TableCell>
                {message.isEditing ? (
                  <Input
                    type="number"
                    value={message.analyzed_content?.quantity || ''}
                    onChange={(e) => handleAnalyzedContentChange(message.id, 'quantity', parseFloat(e.target.value))}
                    className="w-full"
                  />
                ) : (
                  message.analyzed_content?.quantity || '-'
                )}
              </TableCell>
              <TableCell>
                {message.isEditing ? (
                  <Input
                    value={message.analyzed_content?.purchase_date || ''}
                    onChange={(e) => handleAnalyzedContentChange(message.id, 'purchase_date', e.target.value)}
                    className="w-full"
                  />
                ) : (
                  message.analyzed_content?.purchase_date || '-'
                )}
              </TableCell>
              <TableCell>
                {message.isEditing ? (
                  <Input
                    value={message.glide_row_id || ''}
                    onChange={(e) => handleChange(message.id, 'glide_row_id', e.target.value)}
                  />
                ) : (
                  message.glide_row_id || 'Not synced'
                )}
              </TableCell>
              <TableCell>
                {message.isEditing ? (
                  <Input
                    type="number"
                    value={message.glide_stock || 0}
                    onChange={(e) => handleChange(message.id, 'glide_stock', Number(e.target.value))}
                  />
                ) : (
                  message.glide_stock ?? 'N/A'
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {message.isEditing ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSave(message.id)}
                      >
                        Save
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancel(message.id)}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(message.id)}
                    >
                      Edit
                    </Button>
                  )}
                </div>
              </TableCell>
>>>>>>> Stashed changes
            </TableRow>
          </TableHeader>
          <TableBody>
            {messages.map((message) => (
              <TableRow key={message.id}>
                <TableCell>
                  {message.created_at ? format(new Date(message.created_at), 'MM/dd/yyyy HH:mm') : '-'}
                </TableCell>
                <TableCell>
                  {message.isEditing ? (
                    <Input
                      value={message.caption || ''}
                      onChange={(e) => handleChange(message.id, 'caption', e.target.value)}
                    />
                  ) : (
                    message.caption || '-'
                  )}
                </TableCell>
                <TableCell>
                  {message.isEditing ? (
                    <Input
                      value={message.product_name || ''}
                      onChange={(e) => handleChange(message.id, 'product_name', e.target.value)}
                    />
                  ) : (
                    message.product_name || '-'
                  )}
                </TableCell>
                <TableCell>
                  {message.isEditing ? (
                    <Input
                      value={message.vendor_name || ''}
                      onChange={(e) => handleChange(message.id, 'vendor_name', e.target.value)}
                    />
                  ) : (
                    message.vendor_name || '-'
                  )}
                </TableCell>
                <TableCell>
                  {message.isEditing ? (
                    <Input
                      type="number"
                      value={message.product_quantity || ''}
                      onChange={(e) => handleChange(message.id, 'product_quantity', parseFloat(e.target.value))}
                    />
                  ) : (
                    message.product_quantity || '-'
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {message.isEditing ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSaveClick(message.id)}
                          disabled={isProcessing}
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCancel(message.id)}
                          disabled={isProcessing}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(message.id)}
                          disabled={isProcessing}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(message)}
                          disabled={isProcessing}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>
              Do you want to delete this message from Telegram as well?
              {messageToDelete?.media_group_id && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Note: This will delete all related media in the group.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => handleDeleteConfirm(false)}
              disabled={isProcessing}
            >
              Delete from Database Only
            </AlertDialogAction>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => handleDeleteConfirm(true)}
              disabled={isProcessing}
            >
              Delete from Both
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};