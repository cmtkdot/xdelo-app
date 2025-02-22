/// <reference lib="deno.ns" />
/// <reference types="https://deno.land/x/supabase@1.127.3/mod.ts" />

export interface ParsedContent {
  product_name: string;
  product_code?: string | undefined;
  vendor_uid?: string | undefined;
  purchase_date?: string | undefined;
  quantity?: number | undefined;
  notes?: string | undefined;
  parsing_metadata?: {
    method: 'manual' | 'ai' | 'hybrid';
    confidence: number;
    fallbacks_used?: string[];
    timestamp: string;
    needs_ai_analysis?: boolean;
    manual_confidence?: number;
    ai_confidence?: number;
  };
}

export interface QuantityParseResult {
  value: number;
  confidence: number;
}

export interface MessageBase {
  id: string;
  created_at: string;
  processing_state: 'pending' | 'processing' | 'completed' | 'error';
  caption?: string;
  analyzed_content?: ParsedContent;
}

export interface ProcessingMetadata {
  correlation_id: string;
  method?: 'manual' | 'ai' | 'hybrid';
  timestamp?: string;
  error?: string;
}
