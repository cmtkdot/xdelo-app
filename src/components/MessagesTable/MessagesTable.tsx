import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Edit2, Save, X, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { format } from "date-fns";
import { useTelegramOperations } from "@/hooks/useTelegramOperations";
import { MediaViewer } from "@/components/MediaViewer/MediaViewer";
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
import { Message } from "@/types";

interface EditableMessage extends Message {
  isEditing: boolean;
}

interface MessagesTableProps {
  messages: Message[];
}

export const MessagesTable: React.FC<MessagesTableProps> = ({ messages: initialMessages }) => {
  const [messages, setMessages] = useState<EditableMessage[]>(
    initialMessages.map(message => ({ ...message, isEditing: false }))
  );
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<Message[]>([]);
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
    const originalMessage = initialMessages.find(m => m.id === id);
    if (!originalMessage) return;
    
    setMessages(prev =>
      prev.map(message =>
        message.id === id
          ? { ...originalMessage, isEditing: false }
          : message
      )
    );
  };

  const handleCaptionChange = (id: string, value: string) => {
    setMessages(prev =>
      prev.map(message =>
        message.id === id
          ? { ...message, caption: value }
          : message
      )
    );
  };

  const handleSaveClick = async (id: string) => {
    const message = messages.find(m => m.id === id);
    if (!message) return;

    try {
      await handleSave(message, message.caption || '');
      
      setMessages(prev =>
        prev.map(m =>
          m.id === id
            ? { ...m, isEditing: false }
            : m
        )
      );

      toast({
        title: "Success",
        description: "Changes saved successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save changes",
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

  const handleAnalyzedContentChange = (id: string, field: keyof typeof messages[0]['analyzed_content'], value: string | number) => {
    setMessages(prev =>
      prev.map(message =>
        message.id === id
          ? {
              ...message,
              analyzed_content: {
                ...message.analyzed_content,
                [field]: value,
                parsing_metadata: {
                  method: 'manual' as const,
                  confidence: 1,
                  timestamp: new Date().toISOString()
                }
              }
            }
          : message
      )
    );
  };

  const handleMediaClick = (message: Message) => {
    // If it's part of a media group, show all media from the group
    if (message.media_group_id) {
      const groupMedia = messages.filter(m => m.media_group_id === message.media_group_id);
      setSelectedMedia(groupMedia);
    } else {
      setSelectedMedia([message]);
    }
    setIsViewerOpen(true);
  };

  const renderMediaPreview = (message: Message) => {
    if (!message.public_url) return null;

    if (message.mime_type?.startsWith('video/')) {
      return (
        <div 
          className="relative w-16 h-16 cursor-pointer"
          onClick={() => handleMediaClick(message)}
        >
          <video 
            src={message.public_url}
            className="w-16 h-16 object-cover rounded-md"
          />
        </div>
      );
    }

    return (
      <img 
        src={message.public_url} 
        alt={message.caption || 'Product image'} 
        className="w-16 h-16 object-cover rounded-md cursor-pointer"
        onClick={() => handleMediaClick(message)}
      />
    );
  };

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Media</TableHead>
              <TableHead>Purchase Date</TableHead>
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
                  {renderMediaPreview(message)}
                </TableCell>
                <TableCell>
                  {message.analyzed_content?.purchase_date ? 
                    format(new Date(message.analyzed_content.purchase_date), 'MM/dd/yyyy') : 
                    '-'}
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

      <MediaViewer
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        currentGroup={selectedMedia}
      />
    </>
  );
};
