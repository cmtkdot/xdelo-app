
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { AnalyzedContent } from "@/types";
import { PageContainer } from "@/components/Layout/PageContainer";
import { MessagesTable } from "@/components/MessagesTable/MessagesTable";
import { useMediaGroups } from "@/hooks/useMediaGroups";

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalMessages: 0,
    totalProducts: 0,
    uniqueVendors: 0
  });

  const { data: mediaGroups } = useMediaGroups();

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

  // Get the first group's messages for the table
  const latestMessages = mediaGroups ? Object.values(mediaGroups)[0] || [] : [];

  return (
    <PageContainer>
      <div className="space-y-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        
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

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Latest Messages</h2>
          <MessagesTable messages={latestMessages} />
        </div>
      </div>
    </PageContainer>
  );
};

export default Dashboard;
