
import type { Database } from '../integrations/supabase/types';

// Database types
export type DbMessage = Database['public']['Tables']['messages']['Row'];
export type DbMessageInsert = Database['public']['Tables']['messages']['Insert'];
export type DbMessageUpdate = Database['public']['Tables']['messages']['Update'];

// We need to manually define DbGlProduct since it might not be in the generated types
export interface DbGlProduct {
  id: string;
  new_product_name?: string;
  vendor_product_name?: string;
  product_purchase_date?: string;
  total_qty_purchased?: number;
  cost?: number;
  category?: string;
  product_image1?: string;
  purchase_notes?: string;
  created_at: string;
  updated_at: string;
  [key: string]: any; // Allow additional properties
}

// Enums from database
export type ProcessingState = Database['public']['Enums']['processing_state_type'];

// Sync types
export interface SyncMetadata {
  sync_source_message_id: string;  // UUID
  media_group_id: string;
}

// Application-specific types that extend database types
export interface AnalyzedContent {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  quantity?: number;
  notes?: string;
  caption?: string;
  unit_price?: number;
  total_price?: number;
  parsing_metadata?: {
    method: 'manual' | 'ai';
    confidence: number;
    timestamp: string;
    needs_ai_analysis?: boolean;
  };
  sync_metadata?: SyncMetadata;
}

// Message type that includes all required fields
export interface Message extends DbMessage {
  user_id: string; // Make this required
  file_unique_id: string; // Make this required
  public_url: string; // Make this required
  _computed?: {
    isProcessing?: boolean;
    displayName?: string;
  };
}

export interface MatchResult {
  id: string;
  message_id: string;
  product_id: string;
  confidence: number;
  matchType: string;
  details: {
    matchedFields: string[];
    confidence: number;
  };
  isMatch?: boolean; // Added for backward compatibility
}

export interface GlProduct extends DbGlProduct {
  message_public_url?: string | null;
  messages?: {
    public_url: string;
    media_group_id: string;
  }[];
  // Legacy field mappings
  main_new_product_name?: string;
  main_vendor_product_name?: string;
  main_product_purchase_date?: string;
  main_total_qty_purchased?: number;
  main_cost?: number;
  main_category?: string;
  main_product_image1?: string;
  product_name_display?: string;
}

// Helper functions
export const analyzedContentToJson = (content: AnalyzedContent) => {
  return {
    product_name: content.product_name,
    product_code: content.product_code,
    vendor_uid: content.vendor_uid,
    purchase_date: content.purchase_date,
    quantity: content.quantity,
    notes: content.notes,
    caption: content.caption,
    unit_price: content.unit_price,
    total_price: content.total_price,
    parsing_metadata: content.parsing_metadata,
    sync_metadata: content.sync_metadata
  };
};
