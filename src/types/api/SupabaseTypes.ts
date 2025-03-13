
import type { Database } from '../../integrations/supabase/types';

// Database row types
export type DbMessage = Database['public']['Tables']['messages']['Row'];
export type DbMessageInsert = Database['public']['Tables']['messages']['Insert'];
export type DbMessageUpdate = Database['public']['Tables']['messages']['Update'];
export type DbGlProduct = Database['public']['Tables']['gl_products']['Row'];

// Export for backward compatibility
export { Database } from '../../integrations/supabase/types';
