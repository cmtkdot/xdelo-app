
import { Suspense, useState } from "react";
import { Card } from "@/components/ui/card";
import { GlProductGrid } from "@/components/gl-products/gl-product-grid";
import { GlProductFilters } from "@/components/gl-products/gl-product-filters";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Message } from "@/types";

export default function GlProducts() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const { data: products = [] } = useQuery({
    queryKey: ["glapp_products", searchTerm, sortOrder],
    queryFn: async () => {
      const { data: messages, error } = await supabase
        .from("messages")
        .select(`
          *,
          gl_purchase_order:gl_purchase_orders!messages_purchase_order_uid_fkey(*)
        `)
        .eq('is_deleted', false)
        .order("created_at", { ascending: sortOrder === "asc" });

      if (error) throw error;
      
      // Group messages by media_group_id
      const groupedMessages = messages.reduce((groups: { [key: string]: Message[] }, message) => {
        const groupId = message.media_group_id || message.id;
        if (!groups[groupId]) {
          groups[groupId] = [];
        }
        groups[groupId].push(message as Message);
        return groups;
      }, {});

      return Object.values(groupedMessages);
    }
  });

  const handleViewProduct = (product: Message[]) => {
    console.log("Viewing product:", product);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-bold">GL Products</h1>
      <Card className="p-4">
        <GlProductFilters 
          onSearch={setSearchTerm}
          onSort={setSortOrder}
        />
      </Card>
      <Suspense fallback={<div>Loading...</div>}>
        <GlProductGrid 
          products={products} 
          onViewProduct={handleViewProduct}
        />
      </Suspense>
    </div>
  );
}
