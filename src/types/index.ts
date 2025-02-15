
export interface FilterValues {
  search: string;
  vendor: string;
  dateField: 'purchase_date' | 'created_at';
  sortOrder: "asc" | "desc";
  processingState: string;
}

export interface AnalyzedContent {
  quantity?: number;
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  unit_price?: number;
  total_price?: number;
  notes?: string;
  caption?: string;
  parsing_metadata?: {
    method: 'manual' | 'ai';
    confidence: number;
    timestamp: string;
  };
}

export interface MediaItem {
  id: string;
  caption: string | null;
  media_group_id: string | null;
  is_original_caption?: boolean;
  chat_id?: number;
  telegram_message_id?: number;
  file_unique_id?: string;
  mime_type?: string;
  analyzed_content?: AnalyzedContent;
  glide_row_id?: string | null;
  vendor?: string;
  product_name?: string;
  created_at: string;
  purchase_date?: string;
}
