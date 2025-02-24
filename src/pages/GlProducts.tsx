
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { GLProductGrid } from "@/components/GlProducts/GLProductGrid";
import { GLProductFilters } from "@/components/GlProducts/GLProductFilters";
import { supabase } from "@/integrations/supabase/client";
import { GlProduct } from "@/types";

const GlProducts = () => {
  const { data: products, isLoading, error } = useQuery({
    queryKey: ["glapp_products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gl_products")
        .select(`
          *,
          messages:messages!gl_products_messages_fkey(
            public_url,
            media_group_id
          )
        `)
        .eq('messages.is_deleted', false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Transform and type-cast the data to match GlProduct interface
      const productsWithImages = data.map(product => {
        // Extract messages or provide empty array if it's an error
        const messages = Array.isArray(product.messages) ? product.messages : [];
        
        return {
          id: product.id,
          main_new_product_name: product.main_new_product_name || '',
          main_vendor_product_name: product.main_vendor_product_name || '',
          main_product_purchase_date: product.main_product_purchase_date || '',
          main_total_qty_purchased: product.main_total_qty_purchased || 0,
          main_cost: product.main_cost || 0,
          main_category: product.main_category || '',
          main_product_image1: product.main_product_image1 || '',
          main_purchase_notes: product.main_purchase_notes || '',
          product_name_display: product.product_name_display || '',
          created_at: product.created_at,
          updated_at: product.updated_at,
          sync_status: product.sync_status || 'pending',
          cart_add_note: product.cart_add_note,
          cart_rename: product.cart_rename,
          date_timestamp_subm: product.date_timestamp_subm,
          email_email_of_user_who_added_product: product.email_email_of_user_who_added_product,
          glide_id: product.glide_id,
          rowid_account_rowid: product.rowid_account_rowid,
          rowid_purchase_order_row_id: product.rowid_purchase_order_row_id,
          messages: messages
        } as GlProduct;
      });

      return productsWithImages;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Products</h2>
      </div>
      
      <GLProductFilters />
      
      <Card className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="text-destructive">Error loading products</div>
        ) : !products?.length ? (
          <p className="text-muted-foreground">No products found</p>
        ) : (
          <GLProductGrid products={products} />
        )}
      </Card>
    </div>
  );
};

export default GlProducts;
