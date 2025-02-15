import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Edit2, Save, X, Trash2 } from "lucide-react";
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
import { MediaItem, ProcessingState, AnalyzedContent } from "@/types";

interface Message {
  id: string;
  created_at: string;
  telegram_message_id: number;
  file_unique_id: string;
  user_id: string;
  caption?: string;
  media_group_id?: string;
  message_caption_id?: string;
  is_original_caption?: boolean;
  group_caption_synced?: boolean;
  file_id?: string;
  public_url?: string;
  mime_type?: string;
  file_size?: number;
  width?: number;
  height?: number;
  duration?: number;
  updated_at?: string;
  processing_state?: ProcessingState;
  processing_started_at?: string;
  processing_completed_at?: string;
  analyzed_content?: AnalyzedContent | null;
  telegram_data?: Record<string, unknown>;
  error_message?: string;
  chat_id?: number;
}

interface EditableMessage extends Message {
  isEditing: boolean;
}

interface MessagesTableProps {
  messages: Message[];
}

export const MessagesTable: React.FC<MessagesTableProps> = ({ messages: initialMessages }) => {
  const [messages, setMessages] = useState<EditableMessage[]>(initialMessages.map(message => ({ ...message, isEditing: false })));
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);
  const { handleDelete, handleSave, isProcessing } = useTelegramOperations();
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
          ? { ...initialMessages.find(m => m.id === id)!, isEditing: false }
          : message
      )
    );
  };

  const handleCaptionChange = (id: string, value: string) => {
    setMessages(prev =>
      prev.map(message =>
        message.id === id
          ? {
              ...message,
              caption: value,
            }
          : message
      )
    );
  };

  const handleSaveClick = async (id: string) => {
    const message = messages.find(m => m.id === id);
    if (!message) return;

    try {
      await handleSave(message, message.caption || '');
      
      toast({
        title: "Success",
        description: "Caption updated successfully",
      });

      setMessages(prev =>
        prev.map(m =>
          m.id === id
            ? { ...m, isEditing: false }
            : m
        )
      );
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update caption",
        variant: "destructive",
      });
    }
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

  const handleAnalyzedContentChange = (id: string, field: keyof AnalyzedContent, value: string | number) => {
    setMessages(prev =>
      prev.map(message =>
        message.id === id
          ? {
              ...message,
              analyzed_content: {
                ...message.analyzed_content,
                [field]: value,
                method: 'manual',
                confidence: 1,
                timestamp: new Date().toISOString()
              }
            }
          : message
      )
    );
  };

  return (
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
                      onChange={(e) => handleCaptionChange(message.id, e.target.value)}
                    />
                  ) : (
                    message.caption || '-'
                  )}
                </TableCell>
                <TableCell>
                  {message.isEditing ? (
                    <Input
                      value={message.analyzed_content?.product_name || ''}
                      onChange={(e) => handleAnalyzedContentChange(message.id, 'product_name', e.target.value)}
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
                    />
                  ) : (
                    message.analyzed_content?.vendor_uid || '-'
                  )}
                </TableCell>
                <TableCell>
                  {message.isEditing ? (
                    <Input
                      type="number"
                      value={message.analyzed_content?.quantity || ''}
                      onChange={(e) => handleAnalyzedContentChange(message.id, 'quantity', parseFloat(e.target.value))}
                    />
                  ) : (
                    message.analyzed_content?.quantity || '-'
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
