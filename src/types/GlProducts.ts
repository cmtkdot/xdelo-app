import type { SyncStatus } from "@/types";
import type { GlProduct as BaseGlProduct } from "@/types/entities/Product";

export interface GlProduct extends Omit<BaseGlProduct, 'name' | 'createdAt'> {
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
  cart_rename: string;
  date_timestamp_subm?: string;
  email_email_of_user_who_added_product?: string;
  glide_id?: string;
  rowid_account_rowid?: string;
  rowid_purchase_order_row_id?: string;
  messages?: any[];
  [key: string]: any; // Allow additional properties
}

/**
 * Converts data to a GlProduct type, ensuring all required fields are present
 * and properly typed.
 */
export const xdelo_convertToGlProduct = (data: any): GlProduct => {
  return {
    id: data.id,
    main_new_product_name: data.new_product_name || '',
    main_vendor_product_name: data.vendor_product_name || '',
    main_product_purchase_date: data.product_purchase_date || '',
    main_total_qty_purchased: data.total_qty_purchased || 0,
    main_cost: data.cost || 0,
    main_category: data.category || '',
    main_product_image1: data.product_image1 || '',
    main_purchase_notes: data.purchase_notes || '',
    cart_rename: String(data.cart_rename || ''), // Always convert cart_rename to string
    product_name_display: data.product_name_display || data.new_product_name || data.vendor_product_name || '',
    created_at: data.created_at || new Date().toISOString(),
    updated_at: data.updated_at || new Date().toISOString(),
    sync_status: data.sync_status || 'pending'
  } as GlProduct;
};

// Keep the old function name for backward compatibility
export const convertToGlProduct = xdelo_convertToGlProduct;
