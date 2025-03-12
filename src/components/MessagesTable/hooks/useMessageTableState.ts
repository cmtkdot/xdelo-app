import { useState } from "react";
import { useToast } from "@/hooks/useToast";
import { useTelegramOperations } from "@/hooks/useTelegramOperations";
import { Message } from "@/types/MessagesTypes";
import { AnalyzedContent } from "@/types";

export interface EditableMessage extends Message {
  isEditing: boolean;
}

export function useMessageTableState(initialMessages: Message[]) {
  const [messages, setMessages] = useState<EditableMessage[]>(
    initialMessages.map(message => ({ ...message, isEditing: false }))
  );
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<Message[]>([]);
  const { handleDelete, isProcessing } = useTelegramOperations();
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
      setMessages(prev =>
        prev.map(m =>
          m.id === id
            ? { ...m, isEditing: false }
            : m
        )
      );

      toast({
        description: "Changes saved successfully",
        variant: "default"
      });
    } catch (error) {
      toast({
        description: "Failed to save changes",
        variant: "destructive"
      });
    }
  };

  const handleDeleteClick = (message: Message) => {
    const typedMessage: Message = {
      ...message,
      file_unique_id: message.file_unique_id,
      public_url: message.public_url,
      storage_path_standardized: message.storage_path_standardized,
      storage_exists: message.storage_exists
    };
    
    setMessageToDelete(typedMessage);
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
                ...(message.analyzed_content as AnalyzedContent || {}),
                [field]: value,
                parsing_metadata: {
                  method: 'manual' as const,
                  timestamp: new Date().toISOString()
                }
              }
            }
          : message
      )
    );
  };

  const handleMediaClick = (message: Message) => {
    if (message.media_group_id) {
      const groupMedia = messages.filter(m => m.media_group_id === message.media_group_id);
      setSelectedMedia(groupMedia);
    } else {
      setSelectedMedia([message]);
    }
    setIsViewerOpen(true);
  };

  return {
    messages,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    messageToDelete,
    isViewerOpen,
    setIsViewerOpen,
    selectedMedia,
    isProcessing,
    handleEdit,
    handleCancel,
    handleCaptionChange,
    handleSaveClick,
    handleDeleteClick,
    handleDeleteConfirm,
    handleAnalyzedContentChange,
    handleMediaClick
  };
}
