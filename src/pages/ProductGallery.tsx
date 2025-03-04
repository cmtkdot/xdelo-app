
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
import { useTelegramOperations } from "@/hooks/useTelegramOperations";

const ITEMS_PER_PAGE = 12;

const ProductGallery = () => {
  const [editItem, setEditItem] = useState<Message | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<FilterValues>({
    search: "",
    vendors: [],
    sortOrder: "desc",
  });
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: mediaGroups = {}, isLoading } = useMediaGroups();
  const { data: vendors = [] } = useVendors();
  const { handleDelete, isProcessing } = useTelegramOperations();

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
          const messageData = payload.new as Message;
          if (messageData?.file_unique_id && messageData?.id) {
            try {
              await logMessageOperation('sync', messageData.id, {
                event: payload.eventType,
                table: 'messages',
                file_unique_id: messageData.file_unique_id,
                chat_id: messageData.chat_id,
                media_group_id: messageData.media_group_id
              });
            } catch (error) {
              console.error('Error logging sync:', error);
            }
          }
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
      setEditItem(media);
    }
  };

  const handleView = () => {
    console.log('Viewing media');
  };

  const filteredProducts = useMemo(() => {
    let filtered = Object.values(mediaGroups);
    
    // Only apply search and vendor filters if they are set
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(group => {
        const mainMedia = group.find(m => m.caption) || group[0];
        if (!mainMedia) return false;
        
        return (
          mainMedia.analyzed_content?.product_name?.toLowerCase().includes(searchLower) ||
          mainMedia.analyzed_content?.vendor_uid?.toLowerCase().includes(searchLower) ||
          mainMedia.analyzed_content?.product_code?.toLowerCase().includes(searchLower) ||
          mainMedia.caption?.toLowerCase().includes(searchLower) ||
          mainMedia.purchase_order?.toLowerCase().includes(searchLower)
        );
      });
    }
    
    if (filters.vendors && filters.vendors.length > 0) {
      filtered = filtered.filter(group => {
        const mainMedia = group.find(m => m.caption) || group[0];
        return mainMedia && filters.vendors?.includes(mainMedia.analyzed_content?.vendor_uid || '');
      });
    }
    
    // Sort by created_at date
    filtered.sort((a, b) => {
      const dateA = new Date(a[0]?.created_at || 0).getTime();
      const dateB = new Date(b[0]?.created_at || 0).getTime();
      return filters.sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

    console.log('Filtered products count:', filtered.length);
    return filtered;
  }, [mediaGroups, filters]);
  
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginated = filteredProducts.slice(startIndex, endIndex);
    console.log('Paginated products:', {
      startIndex,
      endIndex,
      count: paginated.length,
      totalProducts: filteredProducts.length
    });
    return paginated;
  }, [filteredProducts, currentPage]);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
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
            isDeleting={isProcessing}
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
          onOpenChange={(open) => {
            if (!open) setEditItem(null);
          }}
          onClose={() => setEditItem(null)}
        />
      )}
    </div>
  );
};

export default ProductGallery;
