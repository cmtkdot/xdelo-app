
export interface MediaItem {
  id: string;
  public_url?: string;
  mime_type?: string;
  caption?: string;
  created_at?: string;
  analyzed_content?: {
    product_name?: string;
    vendor_uid?: string;
    product_code?: string;
    purchase_date?: string;
    notes?: string;
    caption?: string;
  };
}
