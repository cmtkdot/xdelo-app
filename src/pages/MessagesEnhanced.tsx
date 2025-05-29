
"use client";

import { EnhancedMessagesFilters } from "@/components/EnhancedMessages/EnhancedMessagesFilters";
import { MessageViewContainer } from "@/components/EnhancedMessages/MessageViewContainer";
import { MediaViewer } from "@/components/ui/media-viewer";
import { useEnhancedMessages } from "@/hooks/enhancedMessages";
import { useDebounce } from "@/hooks/useDebounce";
import { useMessageViewHandlers } from "@/hooks/useMessageViewHandlers";
import { useToast } from "@/hooks/useToast";
import { Message } from "@/types/entities/Message";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

const ITEMS_PER_PAGE = 50;

export default function MessagesEnhanced() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 300);
  const [showMode, setShowMode] = useState<"list" | "grid">("grid");
  const [selectedDateRange, setSelectedDateRange] = useState<
    Date[] | undefined
  >(undefined);
  const [sliderValue, setSliderValue] = useState<number[]>([100]);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    selectedMessages,
    handleToggleSelect,
    clearSelection,
    getSelectedMessageIds,
    deleteMessage,
    isProcessing
  } = useMessageViewHandlers();

  const {
    messages: items,
    groupedMessages,
    isLoading,
    refetch,
  } = useEnhancedMessages({
    limit: ITEMS_PER_PAGE,
    searchTerm: debouncedSearch,
    grouped: showMode === "grid", // Request grouped data for grid view
  });

  const [viewItem, setViewItem] = useState<Message[] | null>(null);
  const [editItem, setEditItem] = useState<Message | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  const totalItems = items?.length || 0;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  const paginatedItems = useMemo(() => {
    if (!items) return [];
    // Use the appropriate data structure for each view mode
    return showMode === "grid" ? groupedMessages : items;
  }, [items, groupedMessages, showMode]);

  // View handler consistently accepts array of messages
  const handleViewMessage = (messages: Message[]) => {
    if (!messages || messages.length === 0) return;
    setViewItem(messages);
    setViewerOpen(true);
  };

  const handleEditMessage = (message: Message) => {
    setEditItem(message);
  };

  const handleDeleteMessage = async (id: string) => {
    try {
      const messageToDelete = items?.find(m => m.id === id);
      if (!messageToDelete) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Message not found",
        });
        return;
      }

      await deleteMessage(messageToDelete, false);
      toast({
        title: "Message deleted",
        description: "The message has been successfully deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error deleting message",
        description:
          "There was an error deleting the message. Please try again.",
      });
    }
  };

  // Function to handle loading more items
  const handleLoadMore = async () => {
    await refetch();
  };

  // Check if we can load more based on the available data
  const hasMoreItems = useMemo(() => {
    return totalItems > paginatedItems.length;
  }, [totalItems, paginatedItems]);

  const toggleShowMode = () =>
    setShowMode(showMode === "grid" ? "list" : "grid");

  return (
    <div className="container mx-auto py-10">
      <EnhancedMessagesFilters
        searchTerm={search}
        onSearchChange={setSearch}
        showMode={showMode}
        onToggleShowMode={toggleShowMode}
      />

      <MessageViewContainer
        showMode={showMode}
        paginatedItems={paginatedItems}
        isLoading={isLoading}
        hasMoreItems={hasMoreItems}
        handleLoadMore={handleLoadMore}
        handleViewMessage={handleViewMessage}
        handleEditMessage={handleEditMessage}
        handleDeleteMessage={handleDeleteMessage}
        handleToggleSelect={handleToggleSelect}
        selectedMessages={selectedMessages}
      />

      {viewItem && (
        <MediaViewer
          isOpen={viewerOpen}
          onClose={() => setViewerOpen(false)}
          currentGroup={viewItem}
        />
      )}
    </div>
  );
}
