import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GlideConfig {
  glide_table_name: string;
  api_endpoint: string;
  auth_token: string;
  field_mappings: Record<string, string>;
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

    console.log('Starting sync queue processing...')

    // Get active Glide configuration
    const { data: config, error: configError } = await supabaseClient
      .from('glide_messages_configuration')
      .select('*')
      .eq('is_active', true)
      .single()

    if (configError || !config) {
      throw new Error('No active Glide configuration found')
    }

    // Get pending queue items (up to 500)
    const { data: queueItems, error: queueError } = await supabaseClient
      .from('glide_messages_sync_queue')
      .select('*, messages(*)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(500)

    if (queueError) {
      throw new Error(`Failed to fetch queue items: ${queueError.message}`)
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('No pending items in sync queue')
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`Processing ${queueItems.length} queue items...`)
    let successCount = 0
    let failureCount = 0
    const batchId = crypto.randomUUID()

    for (const item of queueItems) {
      try {
        if (!item.messages) {
          throw new Error('Message not found')
        }

        // Map message data to Glide fields
        const mappedData: Record<string, any> = {}
        for (const [glideField, messageField] of Object.entries(config.field_mappings)) {
          let value = item.messages[messageField]
          
          // Handle special JSON fields
          if (messageField === 'analyzed_content' || messageField === 'telegram_data') {
            value = JSON.stringify(value)
          }
          
          mappedData[glideField] = value
        }

        // Send to Glide API
        const response = await fetch(config.api_endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.auth_token}`,
          },
          body: JSON.stringify({
            data: mappedData
          }),
        })

        if (!response.ok) {
          throw new Error(`Glide API error: ${await response.text()}`)
        }

        const glideResponse = await response.json()

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
            glide_sync_json: glideResponse,
            last_synced_at: new Date().toISOString(),
          })
          .eq('id', item.messages.id)

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
        total_messages: queueItems.length,
        successful_messages: successCount,
        failed_messages: failureCount,
        completed_at: new Date().toISOString(),
      })

    console.log(`Sync completed. Success: ${successCount}, Failed: ${failureCount}`)

    return new Response(
      JSON.stringify({
        success: true,
        processed: queueItems.length,
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