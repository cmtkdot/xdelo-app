
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

// SQL migrations to run
const migrations = [
  {
    name: 'add_message_url_column',
    sql: `
    -- Add message_url column to other_messages if it doesn't exist
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'other_messages' 
            AND column_name = 'message_url'
        ) THEN
            ALTER TABLE public.other_messages ADD COLUMN message_url TEXT;
        END IF;
    END $$;

    -- Update existing rows to add message_url where possible
    UPDATE public.other_messages
    SET message_url = 
        CASE
            WHEN chat_id < 0 THEN
                CASE 
                    WHEN chat_id < -100000000000 THEN
                        'https://t.me/c/' || SUBSTRING(ABS(chat_id)::text, 4) || '/' || telegram_message_id
                    ELSE
                        'https://t.me/c/' || ABS(chat_id)::text || '/' || telegram_message_id
                END
            ELSE NULL
        END
    WHERE message_url IS NULL
    AND telegram_message_id IS NOT NULL
    AND chat_id < 0;

    -- Fix unified_audit_logs table to ensure entity_id is not null
    -- For system errors, use 'system' as the entity_id
    UPDATE public.unified_audit_logs
    SET entity_id = 'system'
    WHERE entity_id IS NULL;

    -- Add not null constraint if it doesn't already exist
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'unified_audit_logs'
        AND column_name = 'entity_id'
        AND is_nullable = 'NO'
      ) THEN
        ALTER TABLE public.unified_audit_logs 
        ALTER COLUMN entity_id SET NOT NULL;
      END IF;
    END$$;
    `
  }
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    const results = [];

    // Run each migration
    for (const migration of migrations) {
      console.log(`Running migration: ${migration.name}`);
      
      try {
        const { data, error } = await supabaseClient.rpc('pg_query', {
          query_text: migration.sql
        });
        
        if (error) {
          throw error;
        }
        
        results.push({
          name: migration.name,
          success: true,
          message: 'Migration completed successfully'
        });
        
        console.log(`Migration ${migration.name} completed successfully`);
      } catch (error) {
        console.error(`Migration ${migration.name} failed:`, error);
        
        results.push({
          name: migration.name,
          success: false,
          error: error.message
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: results.every(r => r.success), 
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error running migrations:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown error running migrations' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
