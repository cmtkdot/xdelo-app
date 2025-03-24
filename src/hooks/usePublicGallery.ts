
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Message } from '@/types';
import { toast } from 'sonner';

interface UsePublicGalleryProps {
  itemsPerPage?: number;
  initialFilter?: string;
  initialVendorFilter?: string[];
  initialDateField?: 'purchase_date' | 'created_at';
  initialSortOrder?: 'asc' | 'desc';
}

export function usePublicGallery({
  itemsPerPage = 16,
  initialFilter = 'all',
  initialVendorFilter = [],
  initialDateField = 'created_at',
  initialSortOrder = 'desc'
}: UsePublicGalleryProps = {}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [filter, setFilter] = useState<string>(initialFilter);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreItems, setHasMoreItems] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [vendorFilter, setVendorFilter] = useState<string[]>(initialVendorFilter);
  const [dateField, setDateField] = useState<'purchase_date' | 'created_at'>(initialDateField);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialSortOrder);
  const [vendors, setVendors] = useState<string[]>([]);

  // Fetch available vendors for filter
  const fetchVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('vendor_uid')
        .is('deleted_from_telegram', false)
        .not('vendor_uid', 'is', null)
        .order('vendor_uid');

      if (error) {
        console.error("Error fetching vendors:", error);
        return;
      }

      if (data) {
        // Extract unique vendor values
        const uniqueVendors = [...new Set(data.map(item => item.vendor_uid).filter(Boolean))];
        setVendors(uniqueVendors);
      }
    } catch (err) {
      console.error("Error in fetchVendors:", err);
    }
  };

  const fetchMessages = async (page = 1, append = false) => {
    if (page === 1) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      // Build the base query
      let query = supabase
        .from('messages')
        .select('*')
        .is('deleted_from_telegram', false);

      // Apply vendor filter if any
      if (vendorFilter.length > 0) {
        query = query.in('vendor_uid', vendorFilter);
      }

      // Apply sort order
      query = query.order(dateField, { ascending: sortOrder === 'asc' });

      // Apply pagination
      query = query.range((page - 1) * itemsPerPage, page * itemsPerPage - 1);

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching messages:", error);
        toast.error("Error loading gallery");
        return;
      }

      if (data) {
        // Use type assertion to convert database response to Message[]
        const newMessages = data as unknown as Message[];
        
        if (newMessages.length < itemsPerPage) {
          setHasMoreItems(false);
        } else {
          setHasMoreItems(true);
        }

        if (append) {
          setMessages(prev => [...prev, ...newMessages]);
        } else {
          setMessages(newMessages);
        }
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const loadMore = () => {
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    fetchMessages(nextPage, true);
  };

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, vendorFilter, dateField, sortOrder]);

  // Apply filters whenever messages or filter change
  useEffect(() => {
    let result = [...messages];
    
    // Apply search filter if search term exists
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(msg => 
        (msg.caption && msg.caption.toLowerCase().includes(term))
      );
    }
    
    // Apply media type filter
    if (filter === "images") {
      result = result.filter(m => m.mime_type?.startsWith('image/'));
    } else if (filter === "videos") {
      result = result.filter(m => m.mime_type?.startsWith('video/'));
    }
    
    setFilteredMessages(result);
  }, [messages, filter, searchTerm]);

  // Load initial data
  useEffect(() => {
    fetchMessages();
    fetchVendors();
  }, [vendorFilter, dateField, sortOrder]);

  // Group messages by media_group_id
  const mediaGroups = useMemo(() => {
    const groups: Record<string, Message[]> = {};
    
    // Group messages by media_group_id or individually
    filteredMessages.forEach(message => {
      if (message.media_group_id) {
        groups[message.media_group_id] = groups[message.media_group_id] || [];
        groups[message.media_group_id].push(message);
      } else {
        // For messages without a group, use the message ID as a key
        groups[message.id] = [message];
      }
    });
    
    // Convert record to array of arrays
    return Object.values(groups);
  }, [filteredMessages]);

  // Delete a message - updates local state
  const deleteMessage = (id: string) => {
    setMessages(prev => prev.filter(message => message.id !== id));
    setFilteredMessages(prev => prev.filter(message => message.id !== id));
  };

  return {
    messages,
    filteredMessages,
    mediaGroups,
    isLoading,
    isLoadingMore,
    hasMoreItems,
    filter,
    setFilter,
    searchTerm,
    setSearchTerm,
    vendorFilter,
    setVendorFilter,
    dateField,
    setDateField,
    sortOrder,
    setSortOrder,
    vendors,
    currentPage,
    fetchMessages,
    loadMore,
    deleteMessage
  };
}
