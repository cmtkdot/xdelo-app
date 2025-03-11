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
import { isSameDay, isWithinInterval, parseISO } from "date-fns";
import { useTelegramOperations } from "@/hooks/useTelegramOperations";
import { MediaViewer } from "@/components/MediaViewer/MediaViewer";
import { MediaFixButton } from "@/components/ProductGallery/MediaFixButton";
import { useMediaUpload } from "@/hooks/useMediaUpload";

const ITEMS_PER_PAGE = 12;

const ProductGallery = () => {
  const [editItem, setEditItem] = useState<Message | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<FilterValues>({
    search: "",
    vendors: [],
    sortOrder: "desc",
    sortField: "purchase_date",
    showUntitled: false
  });
  
  const [viewerOpen, setViewerOpen] = useState(false);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [currentViewGroup, setCurrentViewGroup] = useState<Message[]>([]);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: mediaGroups = {}, isLoading, refetch } = useMediaGroups();
  const { data: vendors = [] } = useVendors();
  const { handleDelete, isProcessing } = useTelegramOperations();
  const { checkMediaExists, uploadMedia } = useMediaUpload();

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

  const handleView = async (group: Message[]) => {
    if (!group || group.length === 0) return;
    
    if (group[0]?.file_unique_id && group[0]?.mime_type) {
      const exists = await checkMediaExists(group[0].file_unique_id, group[0].mime_type);
      if (!exists) {
        toast({
          title: "Media file missing",
          description: "The media file could not be found in storage. Try repairing media files.",
          variant: "destructive"
        });
      }
    }
    
    setCurrentViewGroup(group);
    setViewerOpen(true);
    
    const groupIndex = paginatedProducts.findIndex(g => {
      return g[0]?.id === group[0]?.id;
    });
    
    if (groupIndex !== -1) {
      setCurrentGroupIndex(groupIndex);
    }
  };

  const handlePreviousGroup = () => {
    if (currentGroupIndex > 0) {
      const prevIndex = currentGroupIndex - 1;
      setCurrentGroupIndex(prevIndex);
      setCurrentViewGroup(paginatedProducts[prevIndex]);
    }
  };

  const handleNextGroup = () => {
    if (currentGroupIndex < paginatedProducts.length - 1) {
      const nextIndex = currentGroupIndex + 1;
      setCurrentGroupIndex(nextIndex);
      setCurrentViewGroup(paginatedProducts[nextIndex]);
    }
  };

  const handleMediaRepair = async (fileUrl: string, fileUniqueId: string) => {
    try {
      await uploadMedia(fileUrl, fileUniqueId);
      refetch();
    } catch (error) {
      console.error('Media repair failed:', error);
    }
  };

  const filteredProducts = useMemo(() => {
    let filtered = Object.values(mediaGroups);
    
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
    
    if (filters.dateRange && filters.dateRange.from && filters.dateRange.to) {
      filtered = filtered.filter(group => {
        const mainMedia = group.find(m => m.caption) || group[0];
        if (!mainMedia) return false;
        
        let purchaseDate: Date | null = null;
        
        if (mainMedia.analyzed_content?.purchase_date) {
          purchaseDate = parseISO(mainMedia.analyzed_content.purchase_date);
        }
        
        if (!purchaseDate) return false;
        
        return isWithinInterval(purchaseDate, {
          start: filters.dateRange!.from,
          end: filters.dateRange!.to
        });
      });
    }
    
    if (!filters.showUntitled) {
      filtered = filtered.filter(group => {
        const mainMedia = group.find(m => m.caption) || group[0];
        return mainMedia && 
               mainMedia.analyzed_content?.product_name && 
               mainMedia.analyzed_content.product_name.toLowerCase() !== "untitled";
      });
    }
    
    filtered.sort((a, b) => {
      const mainMediaA = a.find(m => m.caption) || a[0];
      const mainMediaB = b.find(m => m.caption) || b[0];
      
      if (!mainMediaA || !mainMediaB) return 0;
      
      if (filters.sortField === 'purchase_date') {
        let dateA: Date | null = null;
        let dateB: Date | null = null;
        
        if (mainMediaA.analyzed_content?.purchase_date) {
          dateA = parseISO(mainMediaA.analyzed_content.purchase_date);
        }
        
        if (mainMediaB.analyzed_content?.purchase_date) {
          dateB = parseISO(mainMediaB.analyzed_content.purchase_date);
        }
        
        if (!dateA) dateA = new Date(mainMediaA.created_at || 0);
        if (!dateB) dateB = new Date(mainMediaB.created_at || 0);
        
        return filters.sortOrder === 'asc' ? 
          dateA.getTime() - dateB.getTime() : 
          dateB.getTime() - dateA.getTime();
      } else if (filters.sortField === 'updated_at') {
        const dateA = new Date(mainMediaA.updated_at || mainMediaA.created_at || 0).getTime();
        const dateB = new Date(mainMediaB.updated_at || mainMediaB.created_at || 0).getTime();
        return filters.sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      } else {
        const dateA = new Date(mainMediaA.created_at || 0).getTime();
        const dateB = new Date(mainMediaB.created_at || 0).getTime();
        return filters.sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      }
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
          <div className="flex space-x-4">
            <MediaFixButton />
          </div>
        
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
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['media-groups'] });
          }}
        />
      )}
      
      <MediaViewer
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        currentGroup={currentViewGroup}
        onPrevious={handlePreviousGroup}
        onNext={handleNextGroup}
        hasPrevious={currentGroupIndex > 0}
        hasNext={currentGroupIndex < paginatedProducts.length - 1}
      />
    </div>
  );
};

export default ProductGallery;
