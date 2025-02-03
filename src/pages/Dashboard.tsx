import { Card } from "@/components/ui/card";
import { MessageSquare, Package, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
type MessageParsedRow = Database["public"]["Views"]["messages_parsed"]["Row"];

const Dashboard = () => {
  const { data: messageCount = 0 } = useQuery({
    queryKey: ['messageCount'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true });
      
      if (error) throw error;
      return count || 0;
    }
  });

  const { data: productCount = 0 } = useQuery({
    queryKey: ['productCount'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('messages_parsed')
        .select('*', { count: 'exact', head: true })
        .not('analyzed_content', 'is', null);
      
      if (error) throw error;
      return count || 0;
    }
  });

  const { data: vendorCount = 0 } = useQuery({
    queryKey: ['vendorCount'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages_parsed')
        .select('vendor_uid')
        .not('vendor_uid', 'is', null);
      
      if (error) throw error;
      
      const uniqueVendors = new Set(
        data.map(item => item.vendor_uid)
          .filter(Boolean)
      );
      
      return uniqueVendors.size;
    }
  });

  const stats = [
    {
      name: "Total Messages",
      value: messageCount.toString(),
      icon: MessageSquare,
      change: "+0%",
      changeType: "positive",
    },
    {
      name: "Products Created",
      value: productCount.toString(),
      icon: Package,
      change: "+0%",
      changeType: "positive",
    },
    {
      name: "Active Vendors",
      value: vendorCount.toString(),
      icon: Users,
      change: "+0%",
      changeType: "positive",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.name} className="p-6">
            <div className="flex items-center gap-4">
              <stat.icon className="h-6 w-6 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-500">{stat.name}</p>
                <p className="text-2xl font-semibold">{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;