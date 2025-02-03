import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem } from "@/types";
import { MediaEditDialog } from "@/components/MediaEditDialog";
import { useToast } from "@/components/ui/use-toast";
import { ProductGrid } from "@/components/ProductGallery/ProductGrid";
import { ProductPagination } from "@/components/ProductGallery/ProductPagination";
import { ProductFilters, FilterValues } from "@/components/ProductGallery/ProductFilters";

const ITEMS_PER_PAGE = 16;

const ProductGallery = () => {
  const [mediaGroups, setMediaGroups] = useState<{ [key: string]: MediaItem[] }>({});
  const [editItem, setEditItem] = useState<MediaItem | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [vendors, setVendors] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterValues>({
    search: "",
    vendor: "",
    dateFrom: undefined,
    dateTo: undefined,
    sortOrder: "desc",
  });
  const { toast } = useToast();

  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const { data, error } = await supabase
          .from("messages")
          .select("analyzed_content")
          .not("analyzed_content", "is", null);

        if (error) throw error;

        const uniqueVendors = new Set<string>();
        data.forEach((message) => {
          const content = message.analyzed_content as MediaItem['analyzed_content'];
          if (content?.vendor_uid) {
            uniqueVendors.add(content.vendor_uid);
          }
        });

        setVendors(Array.from(uniqueVendors).sort());
      } catch (error) {
        console.error("Error fetching vendors:", error);
      }
    };

    fetchVendors();
  }, []);

  const formatDate = (date: string | null) => {
    if (!date) return null;
    try {
      const d = new Date(date);
      return d.toISOString().split('T')[0];
    } catch (error) {
      console.error("Error formatting date:", error);
      return null;
    }
  };

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        let query = supabase
          .from("messages")
          .select("*", { count: "exact" });

        // Apply filters
        if (filters.search) {
          query = query.textSearch(
            "analyzed_content->>'product_name'", 
            filters.search
          );
        }

        if (filters.vendor) {
          query = query.eq("analyzed_content->>'vendor_uid'", filters.vendor);
        }

        if (filters.dateFrom) {
          query = query.gte("created_at", filters.dateFrom.toISOString());
        }

        if (filters.dateTo) {
          query = query.lte("created_at", filters.dateTo.toISOString());
        }

        // Apply sorting
        query = query.order("created_at", { ascending: filters.sortOrder === "asc" });

        // Apply pagination
        const from = (currentPage - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;
        query = query.range(from, to);

        const { data, count, error } = await query;

        if (error) throw error;

        const total = count || 0;
        setTotalPages(Math.ceil(total / ITEMS_PER_PAGE));

        const groups: { [key: string]: MediaItem[] } = {};
        data?.forEach((message) => {
          const groupKey = message.media_group_id || message.id;
          if (!groups[groupKey]) {
            groups[groupKey] = [];
          }
          groups[groupKey].push(message as MediaItem);
        });

        Object.keys(groups).forEach(key => {
          groups[key].sort((a, b) => {
            if (a.is_original_caption && !b.is_original_caption) return -1;
            if (!a.is_original_caption && b.is_original_caption) return 1;
            return 0;
          });
        });

        setMediaGroups(groups);
      } catch (error) {
        console.error("Error fetching messages:", error);
        toast({
          title: "Error",
          description: "Failed to load messages. Please try again.",
          variant: "destructive",
        });
      }
    };

    fetchMessages();

    const channel = supabase
      .channel("schema-db-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          console.log("Real-time update:", payload);
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast, currentPage, filters]);

  const handleEdit = (media: MediaItem) => {
    const groupKey = media.media_group_id || media.id;
    const group = mediaGroups[groupKey];
    const mainMedia = group.find(m => m.is_original_caption) || media;
    setEditItem(mainMedia);
  };

  const handleItemChange = (field: string, value: any) => {
    if (editItem) {
      setEditItem({
        ...editItem,
        analyzed_content: {
          ...editItem.analyzed_content,
          [field]: value
        }
      });
    }
  };

  const handleSave = async () => {
    if (!editItem) return;

    try {
      const { error } = await supabase
        .from('messages')
        .update({
          analyzed_content: editItem.analyzed_content
        })
        .eq('id', editItem.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Product details updated successfully.",
      });
      
      setEditItem(null);
    } catch (error) {
      console.error('Error updating message:', error);
      toast({
        title: "Error",
        description: "Failed to update product details.",
        variant: "destructive",
      });
    }
  };

  const handleFilterChange = (newFilters: FilterValues) => {
    setFilters(newFilters);
    setCurrentPage(1); // Reset to first page when filters change
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Product Gallery</h2>
      </div>

      <ProductFilters
        vendors={vendors}
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      <ProductGrid mediaGroups={mediaGroups} onEdit={handleEdit} />
      
      {Object.keys(mediaGroups).length > 0 && (
        <ProductPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}

      <MediaEditDialog
        editItem={editItem}
        onClose={() => setEditItem(null)}
        onSave={handleSave}
        onItemChange={handleItemChange}
        formatDate={formatDate}
      />
    </div>
  );
};

export default ProductGallery;