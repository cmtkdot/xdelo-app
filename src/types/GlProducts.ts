
/**
 * GlProduct interface for consistent product data representation
 */
export interface GlProduct {
  id: string;
  glide_id?: string | null;
  new_product_name?: string | null;
  vendor_product_name?: string | null;
  vendor_uid?: string | null;
  product_purchase_date?: string | null;
  created_at?: string;
  updated_at?: string;
  product_name_display?: string;
  public_url_image?: string | null;
  public_url_video?: string | null;
  message_public_url?: string | null;
  cost?: number | null;
  messages?: {
    public_url: string;
    media_group_id: string;
  }[];
}
