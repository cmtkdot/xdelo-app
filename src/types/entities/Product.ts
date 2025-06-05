
import { SyncStatus } from '../index';

export interface GlProduct {
  id: string;
  product_name: string;
  product_name_display?: string;
  product_code?: string;
  vendor_name?: string;
  vendor_uid?: string;
  description?: string;
  purchase_date?: string;
  unit_price?: number;
  quantity?: number;
  total_price?: number;
  product_category?: string;
  status?: string;
  glide_id?: string;
  created_at?: string;
  updated_at?: string;
  sync_status?: SyncStatus;
  new_product_name?: string;
  vendor_product_name?: string;
  product_purchase_date?: string;
  
  // Additional fields for display
  main_new_product_name?: string;
  main_vendor_product_name?: string;
  main_product_purchase_date?: string;
  main_total_qty_purchased?: number;
  main_cost?: number;
  main_category?: string;
  main_product_image1?: string;
  main_purchase_notes?: string;
  
  // Support for related messages
  messages?: Array<{
    public_url: string;
    media_group_id?: string;
  }>;
}
