export interface FilterValues {
  search: string;
  vendor: string;
  dateField: 'purchase_date' | 'created_at';
  sortOrder: "asc" | "desc";
  sortBy: 'date' | 'product_name' | 'vendor' | 'chat_id';
  processingState: string;
  hasGlideMatch?: boolean;
  chatId?: string;
}

export interface MediaItem {
  id: string;
  caption: string | null;
  media_group_id: string | null;
  is_original_caption?: boolean;
  chat_id?: string;
  glide_row_id?: string | null;
  vendor?: string;
  product_name?: string;
  created_at: string;
  purchase_date?: string;
}
