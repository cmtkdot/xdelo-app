
import type { Database } from '../../integrations/supabase/types';

// Database row types
export type DbMessage = Database['public']['Tables']['messages']['Row'];
export type DbMessageInsert = Database['public']['Tables']['messages']['Insert'];
export type DbMessageUpdate = Database['public']['Tables']['messages']['Update'];
export type DbGlProduct = Database['public']['Tables']['gl_products']['Row'];
export type DbOtherMessage = Database['public']['Tables']['other_messages']['Row'];
export type DbUnifiedAuditLog = Database['public']['Tables']['unified_audit_logs']['Row'];
export type DbMessageOperationLog = Database['public']['Tables']['message_operations_log']['Row'];
export type DbWebhookLog = Database['public']['Tables']['webhook_logs']['Row'];

// Function return types
export type StorageOperationResult = {
  success: boolean;
  path?: string;
  error?: string;
  url?: string;
};

export type ApiResponse<T = any> = {
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
  status: number;
};

// Export for backward compatibility
export { Database } from '../../integrations/supabase/types';
