
/**
 * Core product entity representing an inventory item
 */
export interface GlProduct {
  id: string;
  name: string;
  sku?: string;
  description?: string;
  price?: number;
  createdAt: string;
  updatedAt?: string;
  imageUrl?: string;
  category?: string;
  tags?: string[];
  vendor?: string;
  quantity?: number;
  attributes?: Record<string, string | number | boolean>;
  metadata?: Record<string, any>;
  
  // Add compatibility with existing code
  product_name_display?: string;
  main_new_product_name?: string;
  main_vendor_product_name?: string;
  main_product_purchase_date?: string;
  main_total_qty_purchased?: number;
  main_cost?: number;
  main_category?: string;
  main_product_image1?: string;
  main_purchase_notes?: string;
  messages?: {
    public_url: string;
    media_group_id: string;
  }[];
}
