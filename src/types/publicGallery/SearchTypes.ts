
import { Message } from '@/types/MessagesTypes';

/**
 * Configuration options for the search functionality
 */
export interface SearchConfig {
  debounceTime?: number;
  placeholderText?: string;
  searchFields?: SearchField[];
}

/**
 * Fields that can be searched in the analyzed content
 */
export type SearchField = 
  | 'product_name'
  | 'product_code'
  | 'vendor_uid'
  | 'notes'
  | 'caption';

/**
 * Search result including the matched message and highlighting information
 */
export interface SearchResult {
  message: Message;
  matches: {
    field: SearchField;
    value: string;
  }[];
}
