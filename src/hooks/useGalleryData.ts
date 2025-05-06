import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ProcessingState } from "@/types/api/ProcessingState";
import { Message } from "@/types/entities/Message";
import { useEffect, useState } from "react";

interface UseGalleryDataProps {
  itemsPerPage?: number;
  vendorFilter?: string[];
  searchTerm?: string;
  dateRange?: { from: string; to: string };
  dateField?: "created_at" | "updated_at";
  sortOrder?: "asc" | "desc";
  processingState?: ProcessingState;
  page?: number;
}

export function useGalleryData({
  itemsPerPage = 16,
  vendorFilter = [],
  searchTerm = "",
  dateRange = { from: "", to: "" },
  dateField = "created_at",
  sortOrder = "desc",
  processingState = "" as ProcessingState,
  page = 1,
}: UseGalleryDataProps = {}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreItems, setHasMoreItems] = useState(true);
  const [vendors, setVendors] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(page);
  const { toast } = useToast();

  // Fetch available vendors for filter
  const fetchVendors = async () => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("vendor_uid")
        .is("deleted_from_telegram", false)
        .not("vendor_uid", "is", null)
        .order("vendor_uid");

      if (error) {
        console.error("Supabase error fetching vendors:", error);
        toast({
          variant: "destructive",
          title: "Error loading vendors",
          description: error.message,
        });
        return;
      }

      if (data) {
        // Extract unique vendor values
        const uniqueVendors = Array.from(
          new Set(data.map((item) => item.vendor_uid).filter(Boolean))
        ) as string[];
        setVendors(uniqueVendors);
      }
    } catch (err) {
      console.error("Error in fetchVendors:", err);

      // Check for network connectivity issues
      if (err instanceof TypeError && err.message.includes("Failed to fetch")) {
        toast({
          variant: "destructive",
          title: "Network connection issue",
          description:
            "Please check your internet connection or if the Supabase service is available.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error loading vendors",
          description: err instanceof Error ? err.message : String(err),
        });
      }

      // Set fallback vendors to prevent UI errors
      setVendors([]);
    }
  };

  // Fetch messages with filters
  const fetchMessages = async (pageToFetch: number = 1) => {
    try {
      if (pageToFetch === 1) {
        setIsLoading(true);
        setMessages([]); // Clear messages when explicitly fetching first page
      } else {
        setIsLoadingMore(true);
      }

      console.log("Fetching gallery data with filters:", {
        vendorFilter,
        searchTerm,
        dateRange,
        dateField,
        processingState,
        page: pageToFetch,
        itemsPerPage,
      });

      // Start building the query
      let query = supabase
        .from("messages")
        .select("*")
        .is("deleted_from_telegram", false);

      // Apply search term across multiple fields
      if (searchTerm) {
        query = query.or(
          `product_code.ilike.%${searchTerm}%,product_name.ilike.%${searchTerm}%,caption.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%,vendor_uid.ilike.%${searchTerm}%`
        );
      }

      // Apply vendor filter (only if there are values)
      if (vendorFilter && vendorFilter.length > 0) {
        query = query.in("vendor_uid", vendorFilter);
      }

      // Apply processing state filter
      if (processingState) {
        query = query.eq("processing_state", processingState);
      }

      // Apply date range filters
      if (dateRange.from) {
        query = query.gte(dateField, dateRange.from);
      }

      if (dateRange.to) {
        // Add one day to include the end date fully
        const nextDay = new Date(dateRange.to);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDayStr = nextDay.toISOString().split("T")[0];
        query = query.lt(dateField, nextDayStr);
      }

      // Log the query - helps with debugging
      console.log("Executing Supabase query...");

      // Apply sorting and pagination
      const { data, error } = await query
        .order(dateField, { ascending: sortOrder === "asc" })
        .range(
          (pageToFetch - 1) * itemsPerPage,
          pageToFetch * itemsPerPage - 1
        );

      if (error) {
        console.error("Supabase error fetching messages:", error);
        toast({
          variant: "destructive",
          title: "Failed to load gallery items",
          description: error.message,
        });
        return;
      }

      if (data) {
        console.log(`Received ${data.length} messages from Supabase`);

        // If it's the first page, replace the existing data
        // Otherwise, append to existing data
        if (pageToFetch === 1) {
          setMessages(data as Message[]);
        } else {
          setMessages((prevData) => [...prevData, ...(data as Message[])]);
        }

        // Update pagination state
        setCurrentPage(pageToFetch);
        setHasMoreItems(data.length === itemsPerPage);
      } else {
        console.log("No data returned from Supabase query");
        if (pageToFetch === 1) {
          setMessages([]); // Ensure messages is empty if no data returned
        }
        setHasMoreItems(false);
      }
    } catch (err) {
      console.error("Error in fetchMessages:", err);

      // Check for network connectivity issues
      if (err instanceof TypeError && err.message.includes("Failed to fetch")) {
        toast({
          variant: "destructive",
          title: "Network connection issue",
          description:
            "Please check your internet connection or if the Supabase service is available.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Failed to load gallery items",
          description: err instanceof Error ? err.message : String(err),
        });
      }

      // Set empty state to prevent UI errors
      if (pageToFetch === 1) {
        setMessages([]);
      }
      setHasMoreItems(false);
    } finally {
      // Always reset loading states
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  // Load more messages (pagination)
  const loadMore = () => {
    if (!isLoadingMore && hasMoreItems) {
      fetchMessages(currentPage + 1);
    }
  };

  // Delete a message (optimistic UI update)
  const deleteMessage = (id: string) => {
    setMessages((prevMessages) => prevMessages.filter((msg) => msg.id !== id));
  };

  // Initial data fetch
  useEffect(() => {
    fetchVendors();
    fetchMessages(1);
  }, [
    vendorFilter,
    searchTerm,
    dateRange,
    dateField,
    sortOrder,
    processingState,
  ]);

  return {
    messages,
    vendors,
    isLoading,
    isLoadingMore,
    hasMoreItems,
    currentPage,
    setPage: (page: number) => setCurrentPage(page),
    fetchMessages,
    loadMore,
    deleteMessage: async (id: string) => {
      try {
        // Optimistic update - remove from UI immediately
        setMessages((prev) => prev.filter((msg) => msg.id !== id));

        // Then actually delete
        const { error } = await supabase
          .from("messages")
          .update({ deleted_from_telegram: true })
          .eq("id", id);

        if (error) {
          toast({
            variant: "destructive",
            title: "Error deleting message",
            description: error.message,
          });
          // Fetch messages again to restore if error
          fetchMessages(currentPage);
        } else {
          toast({
            title: "Success",
            description: "Message deleted successfully",
          });
        }
      } catch (err) {
        console.error("Error deleting message:", err);
        toast({
          variant: "destructive",
          title: "Failed to delete message",
          description: err instanceof Error ? err.message : String(err),
        });
        // Fetch messages again to restore if error
        fetchMessages(currentPage);
      }
    },
  };
}
