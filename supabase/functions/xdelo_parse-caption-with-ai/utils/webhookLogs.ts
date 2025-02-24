import { ParserEvent } from '../types';

export const logParserEvent = async (
  supabase: any, // Ignore SupabaseClient type for now
  event: ParserEvent
) => {
  const { error } = await supabase
    .from('parser_events')
    .insert({
      ...event,
      created_at: new Date().toISOString()
    });

  if (error) {
    console.error('Failed to log parser event:', error);
  }
}; 