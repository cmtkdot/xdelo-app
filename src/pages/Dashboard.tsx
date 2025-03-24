import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { AnalyzedContent } from "@/types";
import { PageContainer } from "@/components/Layout/PageContainer";
import { MessagesTable } from "@/components/MessagesTable/MessagesTable";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { useEnhancedMessages } from "@/hooks/enhancedMessages";

const Dashboard = () => {
  const queryClient = useQueryClient();
  const [stats, setStats] = useState({
    totalMessages: 0,
    totalProducts: 0,
    uniqueVendors: 0
  });

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
          queryClient.invalidateQueries({ queryKey: ['enhanced-messages'] });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [queryClient]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { count: totalMessages, error: messagesError } = await supabase
          .from('messages')
          .select('*', { count: 'exact' });

        if (messagesError) {
          console.error('Error fetching message count:', messagesError);
          return;
        }

        const { data: products, error: productsError } = await supabase
          .from('messages')
          .select('analyzed_content')
          .not('analyzed_content', 'is', null);

        if (productsError) {
          console.error('Error fetching products:', productsError);
          return;
        }

        const uniqueProducts = new Set(
          products
            ?.map(msg => (msg.analyzed_content as AnalyzedContent)?.product_code)
            .filter(Boolean)
        );

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
      } catch (error) {
        console.error('Error in fetchStats:', error);
      }
    };

    fetchStats();
  }, []);

  const { 
    messages, 
    isLoading, 
    refetch,
    isRefetching
  } = useEnhancedMessages({
    limit: 100,
    enableRealtime: true,
    grouped: false
  });

  const filteredMessages = messages.filter(msg => 
    msg.analyzed_content && 
    msg.caption && 
    msg.caption.trim() !== ''
  );

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
            disabled={isRefetching}
          >
            {isRefetching ? 'Refreshing...' : 'Refresh'}
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

        <Tabs defaultValue="table" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="table" className="flex-1">Messages Table</TabsTrigger>
            <TabsTrigger value="stats" className="flex-1">Stats & Analytics</TabsTrigger>
          </TabsList>
          <TabsContent value="table">
            <Card className="p-4">
              <h2 className="text-lg font-semibold mb-4">Message Data</h2>
              <MessagesTable messages={filteredMessages} />
            </Card>
          </TabsContent>
          <TabsContent value="stats">
            <Card className="p-4">
              <h2 className="text-lg font-semibold mb-4">Statistics and Analytics</h2>
              <p>Detailed analytics will be available here soon.</p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <Toaster />
    </PageContainer>
  );
};

export default Dashboard;
