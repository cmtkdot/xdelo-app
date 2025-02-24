
import type { SyncStatus } from "@/types";

export interface GlProduct {
  id: string;
  main_new_product_name: string;
  main_vendor_product_name: string;
  main_product_purchase_date: string;
  main_total_qty_purchased: number;
  main_cost: number;
  main_category: string;
  main_product_image1: string;
  main_purchase_notes: string;
  product_name_display: string;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
  cart_rename: string | boolean;
  date_timestamp_subm?: string;
  email_email_of_user_who_added_product?: string;
  glide_id?: string;
  rowid_account_rowid?: string;
  rowid_purchase_order_row_id?: string;
  messages: any[];
  [key: string]: any; // Allow additional properties
}

export const convertToGlProduct = (data: any): GlProduct => {
  return {
    ...data,
    cart_rename: String(data.cart_rename), // Convert boolean to string if needed
    main_product_image1: data.main_product_image1 || '',
    main_purchase_notes: data.main_purchase_notes || '',
    product_name_display: data.product_name_display || '',
    created_at: data.created_at || new Date().toISOString(),
    updated_at: data.updated_at || new Date().toISOString(),
    sync_status: data.sync_status || 'pending'
  };
};
