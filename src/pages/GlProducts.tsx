
import { Suspense, useState } from "react";
import { Card } from "@/components/ui/card";
import { GlProductGrid } from "@/components/gl-products/gl-product-grid";
import { GlProductFilters } from "@/components/gl-products/gl-product-filters";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Message, AnalyzedContent } from "@/types";

export default function GlProducts() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const { data: products = [] } = useQuery<Message[][]>({
    queryKey: ["glapp_products", searchTerm, sortOrder],
    queryFn: async () => {
      const { data: messages, error } = await supabase
        .from("messages")
        .select(`
          *,
          gl_purchase_order:gl_purchase_orders(
            id,
            code,
            created_at,
            updated_at
          )
        `)
        .eq('is_deleted', false)
        .order("created_at", { ascending: sortOrder === "asc" });

      if (error) throw error;
      
      // Group messages by media_group_id
      const groupedMessages = (messages as any[]).reduce<{ [key: string]: Message[] }>((groups, message) => {
        const groupId = message.media_group_id || message.id;
        if (!groups[groupId]) {
          groups[groupId] = [];
        }
        const typedMessage: Message = {
          ...message,
          analyzed_content: message.analyzed_content as AnalyzedContent,
          gl_purchase_order: message.gl_purchase_order ? {
            id: message.gl_purchase_order.id,
            code: message.gl_purchase_order.code,
            created_at: message.gl_purchase_order.created_at,
            updated_at: message.gl_purchase_order.updated_at
          } : null
        };
        groups[groupId].push(typedMessage);
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
