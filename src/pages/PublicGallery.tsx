
import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FilterValues, Message } from "@/types";
import { ProductGrid } from "@/components/ProductGallery/ProductGrid";
import { MediaEditDialog } from "@/components/MediaEditDialog/MediaEditDialog";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuth";
import ProductFilters from "@/components/ProductGallery/ProductFilters";
import { ProductPagination } from "@/components/ProductGallery/ProductPagination";
import { parseISO, isWithinInterval } from "date-fns";

const ITEMS_PER_PAGE = 12;

const PublicGallery = () => {
  const [editItem, setEditItem] = useState<Message | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<FilterValues>({
    search: "",
    vendors: [],
    sortOrder: "desc",
    sortField: "created_at"
  });
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: mediaGroups, isLoading } = useQuery({
    queryKey: ['public-messages', filters.sortField, filters.sortOrder],
    queryFn: async () => {
      const query = supabase
        .from('messages')
        .select('*')
        .eq('processing_state', 'completed');
      
      // Order by the appropriate field
      query.order(filters.sortField || 'created_at', { ascending: filters.sortOrder === 'asc' });
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      const groupedMessages = (data as Message[]).reduce((groups: { [key: string]: Message[] }, message) => {
        const groupId = message.media_group_id || message.id;
        if (!groups[groupId]) {
          groups[groupId] = [];
        }
        groups[groupId].push(message);
        return groups;
      }, {});

      return groupedMessages;
    }
  });

  useEffect(() => {
    const channel = supabase
      .channel('public-messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['public-messages'] });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [queryClient]);

  const handleEdit = (media: Message) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "You must be logged in to edit media.",
        variant: "destructive",
      });
      return;
    }
    setEditItem(media);
  };

  const handleView = () => {
    console.log('Viewing media');
  };

  const handleDelete = async (media: Message) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "You must be logged in to delete media.",
        variant: "destructive",
      });
      return;
    }

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

      queryClient.invalidateQueries({ queryKey: ['public-messages'] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete media. Please try again.",
        variant: "destructive",
      });
    }
  };

  const filteredProducts = useMemo(() => {
    if (!mediaGroups) return [];
    
    let filtered = Object.values(mediaGroups);
    
    // Apply search filter
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
    
    // Apply vendor filter
    if (filters.vendors && filters.vendors.length > 0) {
      filtered = filtered.filter(group => {
        const mainMedia = group.find(m => m.caption) || group[0];
        return mainMedia && filters.vendors?.includes(mainMedia.analyzed_content?.vendor_uid || '');
      });
    }
    
    // Apply date range filter
    if (filters.dateRange && filters.dateRange.from && filters.dateRange.to) {
      filtered = filtered.filter(group => {
        const mainMedia = group.find(m => m.caption) || group[0];
        if (!mainMedia) return false;
        
        // Get purchase date from either the field or analyzed_content
        let purchaseDate: Date | null = null;
        
        if (mainMedia.purchase_date) {
          purchaseDate = new Date(mainMedia.purchase_date);
        } else if (mainMedia.analyzed_content?.purchase_date) {
          purchaseDate = parseISO(mainMedia.analyzed_content.purchase_date);
        }
        
        if (!purchaseDate) return false;
        
        // Check if the purchase date is within the selected range
        return isWithinInterval(purchaseDate, {
          start: filters.dateRange!.from,
          end: filters.dateRange!.to
        });
      });
    }
    
    return filtered;
  }, [mediaGroups, filters]);
  
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredProducts.slice(startIndex, endIndex);
  }, [filteredProducts, currentPage]);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const allVendors = useMemo(() => {
    if (!mediaGroups) return [];
    
    const vendors = new Set<string>();
    
    Object.values(mediaGroups).forEach(group => {
      group.forEach(message => {
        if (message.analyzed_content?.vendor_uid) {
          vendors.add(message.analyzed_content.vendor_uid);
        }
      });
    });
    
    return Array.from(vendors);
  }, [mediaGroups]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-bold">Public Gallery</h1>
      
      <ProductFilters 
        vendors={allVendors}
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
            onEdit={user ? handleEdit : undefined}
            onDelete={user ? handleDelete : undefined}
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
          onOpenChange={(open) => {
            if (!open) setEditItem(null);
          }}
          onClose={() => setEditItem(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['public-messages'] });
          }}
        />
      )}
    </div>
  );
};

export default PublicGallery;
