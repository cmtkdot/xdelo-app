import { useState, useEffect, useCallback } from 'react';
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
  const [isLoadingVendors, setIsLoadingVendors] = useState(false);

  const fetchVendors = useCallback(async () => {
    try {
      setIsLoadingVendors(true);
      const { data, error } = await supabase
        .from('messages')
        .select('vendor_uid')
        .not('vendor_uid', 'is', null)
        .order('vendor_uid')
        .limit(100);

      if (error) {
        console.error('Error fetching vendors:', error);
        return;
      }

      const uniqueVendors = [...new Set(
        data
          .map(item => item.vendor_uid)
          .filter(Boolean)
          .map(item => String(item))
      )];
      
      setVendors(uniqueVendors);
    } catch (error) {
      console.error('Error in fetchVendors:', error);
    } finally {
      setIsLoadingVendors(false);
    }
  }, []);

  const fetchMessages = async (fetchPage = 1, append = false) => {
    if (fetchPage === 1) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      let query = supabase
        .from('messages')
        .select('*')
        .is('deleted_from_telegram', false);

      if (vendorFilter.length > 0) {
        query = query.in('vendor_uid', vendorFilter);
      }

      query = query.order(dateField, { ascending: sortOrder === 'asc' });

      query = query.range((fetchPage - 1) * itemsPerPage, fetchPage * itemsPerPage - 1);

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching messages:", error);
        toast.error("Error loading gallery");
        return;
      }

      if (data) {
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

  useEffect(() => {
    fetchMessages(page);
    fetchVendors();
  }, [vendorFilter, dateField, sortOrder, page]);

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
