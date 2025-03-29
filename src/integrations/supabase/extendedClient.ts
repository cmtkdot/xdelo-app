
import { createClient } from '@supabase/supabase-js';
import type { ExtendedDatabase } from './databaseExtensions';

// Use the environment variables for Supabase connection
const SUPABASE_URL = "https://xjhhehxcxkiumnwbirel.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqaGhlaHhjeGtpdW1ud2JpcmVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgxNDYwMjIsImV4cCI6MjA1MzcyMjAyMn0.ibZQd1XNtfa3zq-uzRmA8AEvxAy6Cjs22S7yb736xPc";

// Create a client with the extended database type
export const extendedSupabase = createClient<ExtendedDatabase>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Helper function for type-safe RPC calls
export async function callExtendedRpc<T = any>(
  functionName: keyof ExtendedDatabase['public']['Functions'],
  params: Record<string, any> = {}
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const { data, error } = await extendedSupabase.rpc(functionName, params);
    return { data: data as T, error };
  } catch (err) {
    console.error(`Error calling ${functionName}:`, err);
    return { data: null, error: err as Error };
  }
}
