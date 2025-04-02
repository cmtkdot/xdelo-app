
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Message } from '@/types';
import { toast } from 'sonner';

interface UseGalleryDataProps {
  itemsPerPage?: number;
  vendorFilter?: string[];
  dateField?: 'purchase_date' | 'created_at';
  sortOrder?: 'asc' | 'desc';
  page?: number;
}

export function useGalleryData({
  itemsPerPage = 16,
  vendorFilter = [],
  dateField = 'created_at',
  sortOrder = 'desc',
  page = 1
}: UseGalleryDataProps = {}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreItems, setHasMoreItems] = useState(true);
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

  const fetchMessages = async (fetchPage = 1, append = false) => {
    if (fetchPage === 1) {
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
      query = query.range((fetchPage - 1) * itemsPerPage, fetchPage * itemsPerPage - 1);

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

  // Load initial data
  useEffect(() => {
    fetchMessages(page);
    fetchVendors();
  }, [vendorFilter, dateField, sortOrder, page]);

  // Delete a message - updates local state
  const deleteMessage = (id: string) => {
    setMessages(prev => prev.filter(message => message.id !== id));
  };

  return {
    messages,
    isLoading,
    isLoadingMore,
    hasMoreItems,
    vendors,
    fetchMessages,
    deleteMessage
  };
}
