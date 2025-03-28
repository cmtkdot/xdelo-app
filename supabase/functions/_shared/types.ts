
export type ProcessingState = 'pending' | 'processing' | 'completed' | 'error' | 'initialized';

export interface ParsedContent {
  product_name: string;
  product_code: string;
  vendor_uid: string | null;
  purchase_date: string | null;
  quantity: number | null;
  notes: string;
  caption: string;
  parsing_metadata: {
    method: string;
    timestamp: string;
    [key: string]: any;
  };
  sync_metadata?: {
    media_group_id?: string;
    sync_source_message_id?: string;
  };
}
