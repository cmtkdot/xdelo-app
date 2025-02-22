import type { Database } from '../integrations/supabase/types';

// Database types
export type DbMessage = Database['public']['Tables']['messages']['Row'];
export type DbMessageInsert = Database['public']['Tables']['messages']['Insert'];
export type DbMessageUpdate = Database['public']['Tables']['messages']['Update'];
export type DbGlProduct = Database['public']['Tables']['gl_products']['Row'];

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
  product_sku?: string;
  purchase_order_uid?: string;
  parsing_metadata?: {
    method: 'manual' | 'ai' | 'hybrid';
    confidence: number;
    timestamp: string;
    needs_ai_analysis?: boolean;
  };
  sync_metadata?: SyncMetadata;
}

// Message type that includes all required fields
export interface Message extends DbMessage {
  user_id: string; // Make this required
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
}

export interface GlProduct extends DbGlProduct {
  message_public_url?: string | null;
  messages?: {
    public_url: string;
    media_group_id: string;
  }[];
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
    product_sku: content.product_sku,
    purchase_order_uid: content.purchase_order_uid,
    parsing_metadata: content.parsing_metadata,
    sync_metadata: content.sync_metadata
  };
};
