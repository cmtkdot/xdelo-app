
import React from "react";
import { Table, TableBody } from "@/components/ui/table";
import { MediaViewer } from "@/components/MediaViewer/MediaViewer";
import { Message } from "@/types";
import { MessagesTableHeader } from "./TableComponents/MessagesTableHeader";
import { MessageRow } from "./TableComponents/MessageRow";
import { DeleteConfirmationDialog } from "./TableComponents/DeleteConfirmationDialog";
import { useMessageTableState } from "./hooks/useMessageTableState";

interface MessagesTableProps {
  messages: Message[];
}

export const MessagesTable: React.FC<MessagesTableProps> = ({ messages: initialMessages }) => {
  const {
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
  } = useMessageTableState(initialMessages);

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <MessagesTableHeader />
          <TableBody>
            {messages.map((message) => (
              <MessageRow
                key={message.id}
                message={message}
                isEditing={message.isEditing}
                onEdit={handleEdit}
                onCancel={handleCancel}
                onSave={handleSaveClick}
                onDelete={handleDeleteClick}
                onCaptionChange={handleCaptionChange}
                onAnalyzedContentChange={handleAnalyzedContentChange}
                onMediaClick={handleMediaClick}
                isProcessing={isProcessing}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      <DeleteConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        messageToDelete={messageToDelete}
        onConfirm={handleDeleteConfirm}
        isProcessing={isProcessing}
      />

      <MediaViewer
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        currentGroup={selectedMedia}
      />
    </>
  );
};
