import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FilterValues } from "@/types";
import { Message } from "@/types/MessagesTypes";
import { MediaEditDialog } from "@/components/MediaEditDialog/MediaEditDialog";
import { useToast } from "@/hooks/useToast";
import { ProductGrid } from "@/components/ProductGallery/ProductGrid";
import { ProductPagination } from "@/components/ProductGallery/ProductPagination";
import ProductFilters from "@/components/ProductGallery/ProductFilters";
import { useEnhancedMessages } from "@/hooks/useEnhancedMessages";
import { useVendors } from "@/hooks/useVendors";
import { logEvent, LogEventType } from "@/lib/logUtils";
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { isSameDay, isWithinInterval, parseISO } from "date-fns";
import { useTelegramOperations } from "@/hooks/useTelegramOperations";
import { MediaViewer } from "@/components/ui/media-viewer";
import { MediaFixButton } from "@/components/ProductGallery/MediaFixButton";
import { AnalyzedContent } from "@/types";

const ITEMS_PER_PAGE = 12;

function hasProperty<T extends object, K extends string>(
  obj: T | null | undefined, 
  prop: K
): obj is T & Record<K, any> {
  return !!obj && typeof obj === 'object' && prop in obj;
}

const ProductGallery = () => {
  const [editItem, setEditItem] = useState<Message | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<FilterValues>({
    search: "",
    vendors: [],
    sortOrder: "desc",
    sortField: "created_at",
    showUntitled: false
  });
  
  const [viewerOpen, setViewerOpen] = useState(false);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [currentViewGroup, setCurrentViewGroup] = useState<Message[]>([]);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { 
    groupedMessages: mediaGroupsData = [], 
    isLoading 
  } = useEnhancedMessages({
    grouped: true,
    limit: 500,
    sortBy: filters.sortField as any,
    sortOrder: filters.sortOrder as any,
    searchTerm: filters.search
  });
  
  const { data: vendors = [] } = useVendors();
  const { handleDelete, isProcessing } = useTelegramOperations();

  const mediaGroups = useMemo(() => {
    return Array.isArray(mediaGroupsData) ? mediaGroupsData : [] as Message[][];
  }, [mediaGroupsData]);

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
              await logEvent(
                LogEventType.MESSAGE_UPDATED,
                messageData.id,
                {
                  event: payload.eventType,
                  table: 'messages',
                  file_unique_id: messageData.file_unique_id,
                  chat_id: messageData.chat_id,
                  media_group_id: messageData.media_group_id
                }
              );
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

  const logUserAction = async (action: string, details: any = {}) => {
    try {
      await logEvent(
        LogEventType.USER_ACTION,
        details.productId || 'gallery',
        {
          action,
          user_id: user?.id,
          timestamp: new Date().toISOString(),
          ...details
        }
      );
    } catch (error) {
      console.error("Error logging user action:", error);
    }
  };

  const handleEdit = async (media: Message) => {
    try {
      await logUserAction(
        'start_edit',
        {
          media_group_id: media.media_group_id
        }
      );
      setEditItem(media);
    } catch (error) {
      console.error('Error logging edit operation:', error);
      setEditItem(media);
    }
  };

  const handleView = (group: Message[]) => {
    if (!group || group.length === 0) return;
    
    setCurrentViewGroup([...group]);
    setViewerOpen(true);
    
    const groupIndex = paginatedProducts.findIndex(g => {
      if (!g || !Array.isArray(g) || g.length === 0) return false;
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
      const group = paginatedProducts[prevIndex];
      if (group && Array.isArray(group)) {
        setCurrentViewGroup([...group]);
      }
    }
  };

  const handleNextGroup = () => {
    if (currentGroupIndex < paginatedProducts.length - 1) {
      const nextIndex = currentGroupIndex + 1;
      setCurrentGroupIndex(nextIndex);
      const group = paginatedProducts[nextIndex];
      if (group && Array.isArray(group)) {
        setCurrentViewGroup([...group]);
      }
    }
  };

  const filteredProducts = useMemo(() => {
    let filtered = [...mediaGroups];
    
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(group => {
        if (!group || !Array.isArray(group) || group.length === 0) return false;
        
        const mainMedia = group.find(m => m.caption) || group[0];
        if (!mainMedia) return false;
        
        const ac = mainMedia.analyzed_content as AnalyzedContent | null;
        
        return (
          (hasProperty(ac, 'product_name') && ac.product_name.toLowerCase().includes(searchLower)) ||
          (hasProperty(ac, 'vendor_uid') && ac.vendor_uid.toLowerCase().includes(searchLower)) ||
          (hasProperty(ac, 'product_code') && ac.product_code.toLowerCase().includes(searchLower)) ||
          (mainMedia.caption?.toLowerCase().includes(searchLower)) ||
          (mainMedia.purchase_order?.toLowerCase().includes(searchLower))
        );
      });
    }
    
    if (filters.vendors && filters.vendors.length > 0) {
      filtered = filtered.filter(group => {
        if (!group || !Array.isArray(group) || group.length === 0) return false;
        
        const mainMedia = group.find(m => m.caption) || group[0];
        if (!mainMedia) return false;
        
        const ac = mainMedia.analyzed_content as AnalyzedContent | null;
        return hasProperty(ac, 'vendor_uid') && filters.vendors?.includes(ac.vendor_uid);
      });
    }
    
    if (filters.dateRange && filters.dateRange.from && filters.dateRange.to) {
      filtered = filtered.filter(group => {
        if (!group || !Array.isArray(group) || group.length === 0) return false;
        
        const mainMedia = group.find(m => m.caption) || group[0];
        if (!mainMedia) return false;
        
        const ac = mainMedia.analyzed_content as AnalyzedContent | null;
        if (!hasProperty(ac, 'purchase_date') || !ac.purchase_date) return false;
        
        try {
          const purchaseDate = parseISO(ac.purchase_date);
          
          return isWithinInterval(purchaseDate, {
            start: filters.dateRange!.from,
            end: filters.dateRange!.to
          });
        } catch (error) {
          return false;
        }
      });
    }
    
    if (!filters.showUntitled) {
      filtered = filtered.filter(group => {
        if (!group || !Array.isArray(group) || group.length === 0) return false;
        
        const mainMedia = group.find(m => m.caption) || group[0];
        if (!mainMedia) return false;
        
        const ac = mainMedia.analyzed_content as AnalyzedContent | null;
        return hasProperty(ac, 'product_name') && 
               ac.product_name && 
               ac.product_name.toLowerCase() !== "untitled";
      });
    }
    
    filtered.sort((a, b) => {
      if (!a || !Array.isArray(a) || a.length === 0) return 1;
      if (!b || !Array.isArray(b) || b.length === 0) return -1;
      
      const mainMediaA = a.find(m => m.caption) || a[0];
      const mainMediaB = b.find(m => m.caption) || b[0];
      
      if (!mainMediaA || !mainMediaB) return 0;
      
      const acA = mainMediaA.analyzed_content as AnalyzedContent | null;
      const acB = mainMediaB.analyzed_content as AnalyzedContent | null;
      
      if (filters.sortField === 'purchase_date') {
        let dateA: Date | null = null;
        let dateB: Date | null = null;
        
        if (hasProperty(acA, 'purchase_date') && acA.purchase_date) {
          try {
            dateA = parseISO(acA.purchase_date);
          } catch (e) {
            dateA = null;
          }
        }
        
        if (hasProperty(acB, 'purchase_date') && acB.purchase_date) {
          try {
            dateB = parseISO(acB.purchase_date);
          } catch (e) {
            dateB = null;
          }
        }
        
        if (!dateA) dateA = new Date(mainMediaA.created_at || 0);
        if (!dateB) dateB = new Date(mainMediaB.created_at || 0);
        
        return filters.sortOrder === 'asc' ? 
          dateA.getTime() - dateB.getTime() : 
          dateB.getTime() - dateA.getTime();
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
            products={paginatedProducts as Message[][]}
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
