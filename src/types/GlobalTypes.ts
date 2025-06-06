
import type { Database } from '../integrations/supabase/database.types';

// Database types
export type DbMessage = Database['public']['Tables']['messages']['Row'];
export type DbMessageInsert = Database['public']['Tables']['messages']['Insert'];
export type DbMessageUpdate = Database['public']['Tables']['messages']['Update'];
export type DbGlProduct = Database['public']['Tables']['gl_products']['Row'];

// Enums from database
export type ProcessingState = "initialized" | "pending" | "processing" | "completed" | "error";

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
  parsing_metadata?: {
    method: 'manual' | 'ai' ;
    confidence: number;
    timestamp: string;
    needs_ai_analysis?: boolean;
  };
  sync_metadata?: SyncMetadata;
}

// Import Message type from entities and extend it
import { Message as EntityMessage } from './entities/Message';

// Extended Message type that includes all required fields and computed properties
export interface Message extends EntityMessage {
  user_id: string; // Required field
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
  isMatch: boolean;
  score: number;
  matches: Record<string, { value: string; score: number }>;
  match_fields?: string[];
  match_date?: string;
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
    parsing_metadata: content.parsing_metadata,
    sync_metadata: content.sync_metadata
  };
};
