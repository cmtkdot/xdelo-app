import React, { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MediaViewer } from "@/components/ui/media-viewer";
import { Message } from "@/types";
import { DeleteConfirmationDialog } from "./TableComponents/DeleteConfirmationDialog";
import { useMessageTableState } from "./hooks/useMessageTableState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Edit2, Save, X, Trash2, Search, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/generalUtils";
import { VideoPreviewCard } from "@/components/media-viewer/VideoPreviewCard";
import { isVideoMessage } from "@/utils/mediaUtils";

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

  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const filteredAndSortedMessages = useMemo(() => {
    const filtered = messages.filter((message) => {
      const searchContent = [
        message.caption,
        message.analyzed_content?.product_name,
        message.analyzed_content?.vendor_uid,
        message.analyzed_content?.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchTerm === "" || searchContent.includes(searchTerm.toLowerCase());
    });

    if (!sortColumn) return filtered;

    return [...filtered].sort((a, b) => {
      let valueA, valueB;

      switch (sortColumn) {
        case "product_name":
          valueA = a.analyzed_content?.product_name || "";
          valueB = b.analyzed_content?.product_name || "";
          break;
        case "vendor_uid":
          valueA = a.analyzed_content?.vendor_uid || "";
          valueB = b.analyzed_content?.vendor_uid || "";
          break;
        case "purchase_date":
          valueA = a.analyzed_content?.purchase_date ? new Date(a.analyzed_content.purchase_date).getTime() : 0;
          valueB = b.analyzed_content?.purchase_date ? new Date(b.analyzed_content.purchase_date).getTime() : 0;
          break;
        case "quantity":
          valueA = a.analyzed_content?.quantity || 0;
          valueB = b.analyzed_content?.quantity || 0;
          break;
        case "notes":
          valueA = a.analyzed_content?.notes || "";
          valueB = b.analyzed_content?.notes || "";
          break;
        case "caption":
          valueA = a.caption || "";
          valueB = b.caption || "";
          break;
        default:
          valueA = a[sortColumn as keyof Message] || "";
          valueB = b[sortColumn as keyof Message] || "";
      }

      const comparison = typeof valueA === "string"
        ? valueA.localeCompare(valueB as string)
        : (valueA as number) - (valueB as number);

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [messages, searchTerm, sortColumn, sortDirection]);

  const renderSortIcon = (column: string) => {
    if (sortColumn !== column) return null;
    return sortDirection === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

  const renderMediaPreview = (message: Message) => {
    if (!message.public_url) return null;

    if (isVideoMessage(message)) {
      return (
        <div className="w-16 h-16">
          <VideoPreviewCard 
            message={message} 
            onClick={handleMediaClick}
            className="w-full h-full"
            showTitle={false}
          />
        </div>
      );
    }

    return (
      <img 
        src={message.public_url} 
        alt={message.caption || 'Preview'} 
        className="w-16 h-16 object-cover rounded-md cursor-pointer"
        onClick={() => handleMediaClick(message)}
      />
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <div className="relative flex-grow">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search messages..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Media</TableHead>
              <TableHead 
                className={cn("cursor-pointer", sortColumn === "product_name" && "text-primary")}
                onClick={() => handleSort("product_name")}
              >
                <div className="flex items-center gap-1">
                  Product Name
                  {renderSortIcon("product_name")}
                </div>
              </TableHead>
              <TableHead 
                className={cn("cursor-pointer", sortColumn === "vendor_uid" && "text-primary")}
                onClick={() => handleSort("vendor_uid")}
              >
                <div className="flex items-center gap-1">
                  Vendor UID
                  {renderSortIcon("vendor_uid")}
                </div>
              </TableHead>
              <TableHead 
                className={cn("cursor-pointer", sortColumn === "purchase_date" && "text-primary")}
                onClick={() => handleSort("purchase_date")}
              >
                <div className="flex items-center gap-1">
                  Purchase Date
                  {renderSortIcon("purchase_date")}
                </div>
              </TableHead>
              <TableHead 
                className={cn("cursor-pointer", sortColumn === "quantity" && "text-primary")}
                onClick={() => handleSort("quantity")}
              >
                <div className="flex items-center gap-1">
                  Quantity
                  {renderSortIcon("quantity")}
                </div>
              </TableHead>
              <TableHead 
                className={cn("cursor-pointer", sortColumn === "notes" && "text-primary")}
                onClick={() => handleSort("notes")}
              >
                <div className="flex items-center gap-1">
                  Notes
                  {renderSortIcon("notes")}
                </div>
              </TableHead>
              <TableHead 
                className={cn("cursor-pointer", sortColumn === "caption" && "text-primary")}
                onClick={() => handleSort("caption")}
              >
                <div className="flex items-center gap-1">
                  Original Caption
                  {renderSortIcon("caption")}
                </div>
              </TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedMessages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  No messages found.
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedMessages.map((message) => (
                <TableRow key={message.id} className="hover:bg-muted/50">
                  <TableCell>{renderMediaPreview(message)}</TableCell>
                  <TableCell>
                    {message.isEditing ? (
                      <Input
                        value={message.analyzed_content?.product_name || ''}
                        onChange={(e) => handleAnalyzedContentChange(message.id, 'product_name', e.target.value)}
                        className="max-w-[200px]"
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
                        className="max-w-[150px]"
                      />
                    ) : (
                      message.analyzed_content?.vendor_uid || '-'
                    )}
                  </TableCell>
                  <TableCell>
                    {message.analyzed_content?.purchase_date ? 
                      new Date(message.analyzed_content.purchase_date).toLocaleDateString('en-US', {
                        month: '2-digit',
                        day: '2-digit',
                        year: 'numeric'
                      }) : 
                      '-'}
                  </TableCell>
                  <TableCell>
                    {message.isEditing ? (
                      <Input
                        type="number"
                        value={message.analyzed_content?.quantity || ''}
                        onChange={(e) => handleAnalyzedContentChange(message.id, 'quantity', parseFloat(e.target.value))}
                        className="max-w-[80px]"
                      />
                    ) : (
                      message.analyzed_content?.quantity || '-'
                    )}
                  </TableCell>
                  <TableCell>
                    {message.isEditing ? (
                      <Input
                        value={message.analyzed_content?.notes || ''}
                        onChange={(e) => handleAnalyzedContentChange(message.id, 'notes', e.target.value)}
                        className="max-w-[200px]"
                      />
                    ) : (
                      message.analyzed_content?.notes || '-'
                    )}
                  </TableCell>
                  <TableCell>
                    {message.isEditing ? (
                      <Input
                        value={message.caption || ''}
                        onChange={(e) => handleCaptionChange(message.id, e.target.value)}
                        className="max-w-[200px]"
                      />
                    ) : (
                      message.caption || '-'
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
                            className="h-8 w-8"
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCancel(message.id)}
                            disabled={isProcessing}
                            className="h-8 w-8"
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
                            className="h-8 w-8"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(message)}
                            disabled={isProcessing}
                            className="h-8 w-8 text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
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
    </div>
  );
};
