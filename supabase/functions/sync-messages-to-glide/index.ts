import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GlideColumnMapping {
  [key: string]: string;
}

interface GlideMutation {
  kind: 'add-row-to-table' | 'delete-row' | 'set-columns-in-row';
  tableName: string;
  columnValues?: Record<string, any>;
  rowID?: string;
}

interface GlideConfig {
  appID: string;
  tableName: string;
  authToken: string;
  columnMapping: GlideColumnMapping;
}

// Handle CORS preflight requests
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get Glide configuration
    const { data: configData, error: configError } = await supabaseClient
      .from('glide_messages_configuration')
      .select('*')
      .eq('is_active', true)
      .single()

    if (configError || !configData) {
      throw new Error('No active Glide configuration found')
    }

    const glideConfig: GlideConfig = {
      appID: configData.glide_table_name.split('-')[2], // Extract appID from table name
      tableName: configData.glide_table_name,
      authToken: configData.auth_token,
      columnMapping: configData.field_mappings as GlideColumnMapping,
    }

    // Process sync queue
    const { data: queueItems, error: queueError } = await supabaseClient
      .from('glide_messages_sync_queue')
      .select('*, messages(*)')
      .eq('status', 'pending')
      .limit(10)

    if (queueError) {
      throw new Error(`Failed to fetch queue items: ${queueError.message}`)
    }

    const batchId = crypto.randomUUID()
    let successCount = 0
    let failureCount = 0

    for (const item of queueItems || []) {
      try {
        const message = item.messages
        if (!message) continue

        // Map Supabase data to Glide columns
        const columnValues: Record<string, any> = {}
        for (const [glideCol, supabaseCol] of Object.entries(glideConfig.columnMapping)) {
          let value = message[supabaseCol]
          
          // Handle special cases for JSON fields
          if (supabaseCol === 'analyzed_content' || supabaseCol === 'telegram_data') {
            value = JSON.stringify(value)
          }
          
          columnValues[glideCol] = value
        }

        // Prepare Glide mutation
        const mutation: GlideMutation = {
          kind: 'add-row-to-table',
          tableName: glideConfig.tableName,
          columnValues,
        }

        // Send to Glide API
        const response = await fetch('https://api.glideapp.io/api/function/mutateTables', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${glideConfig.authToken}`,
          },
          body: JSON.stringify({
            appID: glideConfig.appID,
            mutations: [mutation],
          }),
        })

        if (!response.ok) {
          throw new Error(`Glide API error: ${await response.text()}`)
        }

        // Update sync status
        await supabaseClient
          .from('glide_messages_sync_queue')
          .update({
            status: 'completed',
            processed_at: new Date().toISOString(),
          })
          .eq('id', item.id)

        await supabaseClient
          .from('messages')
          .update({
            glide_sync_status: 'completed',
            last_synced_at: new Date().toISOString(),
          })
          .eq('id', message.id)

        successCount++
      } catch (error) {
        console.error('Sync error:', error)
        
        // Update error status
        await supabaseClient
          .from('glide_messages_sync_queue')
          .update({
            status: 'error',
            last_error: error.message,
            retry_count: (item.retry_count || 0) + 1,
          })
          .eq('id', item.id)

        await supabaseClient
          .from('messages')
          .update({
            glide_sync_status: 'error',
          })
          .eq('id', item.messages?.id)

        failureCount++
      }
    }

    // Log sync metrics
    await supabaseClient
      .from('glide_messages_sync_metrics')
      .insert({
        sync_batch_id: batchId,
        total_messages: (queueItems || []).length,
        successful_messages: successCount,
        failed_messages: failureCount,
        completed_at: new Date().toISOString(),
      })

    return new Response(
      JSON.stringify({
        success: true,
        processed: (queueItems || []).length,
        successful: successCount,
        failed: failureCount,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})