
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from './types';

// Define the extended client without conflicting with the existing type
export interface ExtendedSupabaseClient extends SupabaseClient<Database> {
  // Add any additional methods or properties here
}

// Add this type to the global namespace to avoid issues with existing code
declare global {
  interface Window {
    supabase: ExtendedSupabaseClient;
  }
}

// Export a type-safe extension function that doesn't modify the client type
export function extendSupabaseClient(client: SupabaseClient<Database>): SupabaseClient<Database> {
  // Add any extensions here if needed
  return client;
}
