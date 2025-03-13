import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { AnalyzedContent, Message } from "@/types";
import { PageContainer } from "@/components/Layout/PageContainer";
import { MessagesTable } from "@/components/MessagesTable/MessagesTable";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

const Dashboard = () => {
  const queryClient = useQueryClient();
  const [stats, setStats] = useState({
    totalMessages: 0,
    totalProducts: 0,
    uniqueVendors: 0
  });

  // Set up realtime subscription using channel
  useEffect(() => {
    const channel = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        () => {
          // Invalidate and refetch messages
          queryClient.invalidateQueries({ queryKey: ['messages'] });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [queryClient]);

  useEffect(() => {
    const fetchStats = async () => {
      // Get total messages
      const { count: totalMessages } = await supabase
        .from('messages')
        .select('*', { count: 'exact' });

      // Get total products (unique product codes)
      const { data: products } = await supabase
        .from('messages')
        .select('analyzed_content')
        .not('analyzed_content', 'is', null);

      const uniqueProducts = new Set(
        products
          ?.map(msg => (msg.analyzed_content as AnalyzedContent)?.product_code)
          .filter(Boolean)
      );

      // Get unique vendors
      const uniqueVendors = new Set(
        products
          ?.map(msg => (msg.analyzed_content as AnalyzedContent)?.vendor_uid)
          .filter(Boolean)
      );

      setStats({
        totalMessages: totalMessages || 0,
        totalProducts: uniqueProducts.size,
        uniqueVendors: uniqueVendors.size
      });
    };

    fetchStats();
  }, []);

  const { data: messages, isLoading, refetch } = useQuery({
    queryKey: ['messages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_messages_compatibility')
        .select(`
          id,
          telegram_message_id,
          chat_id,
          chat_type,
          chat_title,
          media_group_id,
          caption,
          file_id,
          file_unique_id,
          public_url,
          mime_type,
          file_size,
          width,
          height,
          duration,
          is_edited,
          edit_date,
          processing_state,
          processing_started_at,
          processing_completed_at,
          analyzed_content,
          error_message,
          created_at,
          updated_at,
          message_url,
          group_caption_synced,
          retry_count,
          last_error_at
        `)
        .not('analyzed_content', 'is', null)
        .gt('caption', '')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return data as Message[];
    }
  });

  if (isLoading) {
    return (
      <PageContainer>
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <Card className="p-4">
            <div className="h-8 w-full animate-pulse bg-muted rounded" />
          </Card>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <Button 
            onClick={() => refetch()}
            variant="outline"
            size="sm"
          >
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <h2 className="text-lg font-semibold">Total Messages</h2>
            <p className="text-3xl font-bold">{stats.totalMessages}</p>
          </Card>
          <Card className="p-4">
            <h2 className="text-lg font-semibold">Unique Products</h2>
            <p className="text-3xl font-bold">{stats.totalProducts}</p>
          </Card>
          <Card className="p-4">
            <h2 className="text-lg font-semibold">Unique Vendors</h2>
            <p className="text-3xl font-bold">{stats.uniqueVendors}</p>
          </Card>
        </div>

        <MessagesTable messages={messages || []} />
      </div>
    </PageContainer>
  );
};

export default Dashboard;