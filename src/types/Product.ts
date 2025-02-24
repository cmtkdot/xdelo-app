import { Message } from './Message';

export interface Product {
  id: string;
  name: string;
  description?: string;
  code?: string;
  vendor?: string;
  quantity?: number;
  price?: number;
  image?: string;
  created_at?: string;
  updated_at?: string;
  rowid_account_rowid?: string;
  rowid_purchase_order_row_id?: string;
  messages?: Message[];
  sync_status?: 'pending' | 'completed' | 'failed';
  cart_add_note?: string;
  cart_rename?: string;
  date_timestamp_subm?: string;
  email_email_of_user_who_added_product?: string;
  glide_id?: string;
}

export interface ProductFilter {
  search?: string;
  vendor?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  sortOrder?: 'asc' | 'desc';
  processingState?: string;
  quantity?: {
    min?: number;
    max?: number;
  };
}
