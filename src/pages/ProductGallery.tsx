
import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FilterValues, Message } from "@/types";
import { MediaEditDialog } from "@/components/MediaEditDialog/MediaEditDialog";
import { useToast } from "@/hooks/useToast";
import { ProductGrid } from "@/components/ProductGallery/ProductGrid";
import { ProductPagination } from "@/components/ProductGallery/ProductPagination";
import ProductFilters from "@/components/ProductGallery/ProductFilters";
import { useMediaGroups } from "@/hooks/useMediaGroups";
import { useVendors } from "@/hooks/useVendors";
import { logMessageOperation } from "@/lib/syncLogger";
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

const ITEMS_PER_PAGE = 12;

const ProductGallery = () => {
  const [editItem, setEditItem] = useState<Message | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<FilterValues>({
    search: "",
    vendors: [],
    sortOrder: "desc",
    processingState: ['completed']
  });
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: mediaGroups = {}, isLoading } = useMediaGroups();
  const { data: vendors = [] } = useVendors();

  // Set up realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('media-groups')
      .on<Message>(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        async (payload: RealtimePostgresChangesPayload<Message>) => {
          // Log the sync operation
          const newMessage = payload.new as Message;
          if (newMessage && 'id' in newMessage) {
            try {
              await logMessageOperation('sync', newMessage.id, {
                event: payload.eventType,
                table: 'messages',
                chat_id: newMessage.chat_id,
                media_group_id: newMessage.media_group_id
              });
            } catch (error) {
              console.error('Error logging sync:', error);
            }
          }
          // Invalidate and refetch messages
          queryClient.invalidateQueries({ queryKey: ['media-groups'] });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [queryClient]);

  const handleEdit = async (media: Message) => {
    try {
      await logMessageOperation('update', media.id, {
        action: 'start_edit',
        media_group_id: media.media_group_id
      });
      setEditItem(media);
    } catch (error) {
      console.error('Error logging edit operation:', error);
      // Still allow edit even if logging fails
      setEditItem(media);
    }
  };

  const handleView = () => {
    // View logic implementation
    console.log('Viewing media');
  };

  const handleDelete = async (media: Message) => {
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', media.id);

      if (error) throw error;

      toast({
        title: "Media deleted",
        description: "The media has been successfully deleted.",
      });

      // Refetch messages
      queryClient.invalidateQueries({ queryKey: ['media-groups'] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete media. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Filter and sort products based on current filters
  const filteredProducts = useMemo(() => {
    let filtered = Object.values(mediaGroups);
    
    // Filter by search term
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(group => {
        const mainMedia = group.find(m => m.is_original_caption) || group[0];
        if (!mainMedia) return false;
        
        // Search in product name, vendor, product code, or caption
        return (
          mainMedia.analyzed_content?.product_name?.toLowerCase().includes(searchLower) ||
          mainMedia.analyzed_content?.vendor_uid?.toLowerCase().includes(searchLower) ||
          mainMedia.analyzed_content?.product_code?.toLowerCase().includes(searchLower) ||
          mainMedia.caption?.toLowerCase().includes(searchLower) ||
          mainMedia.purchase_order?.toLowerCase().includes(searchLower)
        );
      });
    }
    
    // Filter by vendors
    if (filters.vendors && filters.vendors.length > 0) {
      filtered = filtered.filter(group => {
        const mainMedia = group.find(m => m.is_original_caption) || group[0];
        return mainMedia && filters.vendors?.includes(mainMedia.analyzed_content?.vendor_uid || '');
      });
    }
    
    // Filter by processing state
    if (filters.processingState && filters.processingState.length > 0) {
      filtered = filtered.filter(group => {
        const mainMedia = group.find(m => m.is_original_caption) || group[0];
        return mainMedia && filters.processingState?.includes(mainMedia.processing_state);
      });
    }
    
    // Sort by date
    filtered.sort((a, b) => {
      const dateA = new Date(a[0]?.created_at || 0).getTime();
      const dateB = new Date(b[0]?.created_at || 0).getTime();
      return filters.sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });
    
    return filtered;
  }, [mediaGroups, filters]);
  
  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredProducts, currentPage]);
  
  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of the page
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-bold">Product Gallery</h1>
      
      <ProductFilters 
        vendors={vendors}
        filters={filters}
        onFilterChange={setFilters}
      />
      
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      ) : (
        <>
          <ProductGrid
            products={paginatedProducts}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onView={handleView}
          />
          
          {totalPages > 1 && (
            <ProductPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          )}
        </>
      )}

      {editItem && (
        <MediaEditDialog
          media={editItem}
          open={!!editItem}
          onClose={() => setEditItem(null)}
        />
      )}
    </div>
  );
};

export default ProductGallery;
