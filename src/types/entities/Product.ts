
import { SyncStatus } from '../index';

export interface GlProduct {
  id: string;
  product_name: string;
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
}
