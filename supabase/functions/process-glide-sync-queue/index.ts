import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
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

    // Get active Glide configuration
    const { data: config, error: configError } = await supabaseClient
      .from('glide_messages_configuration')
      .select('*')
      .eq('is_active', true)
      .maybeSingle()

    if (configError || !config) {
      throw new Error('No active Glide configuration found')
    }

    console.log('Processing with config:', {
      tableName: config.glide_table_name,
      authToken: config.auth_token ? 'present' : 'missing'
    })

    // Process pending queue items
    const { data: queueItems, error: queueError } = await supabaseClient
      .from('glide_messages_sync_queue')
      .select('*, messages(*)')
      .eq('status', 'pending')
      .limit(500)

    if (queueError) {
      throw new Error(`Failed to fetch queue items: ${queueError.message}`)
    }

    console.log(`Processing ${queueItems?.length || 0} queue items`)

    const mutations = []
    let successCount = 0
    let failureCount = 0

    for (const item of queueItems || []) {
      try {
        const message = item.messages
        if (!message) continue

        // Use the supabase_sync_json for Glide column mapping
        const mappedData = message.supabase_sync_json || {}
        
        // Determine if the record exists in Glide
        const glideRowId = message.glide_row_id
        const operation = glideRowId ? 'set-columns-in-row' : 'add-row-to-table'
        
        mutations.push({
          kind: operation,
          tableName: config.glide_table_name,
          columnValues: mappedData,
          ...(glideRowId && { rowID: glideRowId })
        })

        // Update sync status
        await supabaseClient
          .from('messages')
          .update({
            glide_last_sync_at: new Date().toISOString(),
            glide_sync_status: 'completed'
          })
          .eq('id', message.id)

        successCount++
      } catch (error) {
        console.error('Sync error:', error)
        failureCount++

        // Update error status
        if (item.messages?.id) {
          await supabaseClient
            .from('messages')
            .update({
              glide_sync_status: 'error',
              last_error_at: new Date().toISOString()
            })
            .eq('id', item.messages.id)
        }
      }
    }

    // Send mutations to Glide if any
    if (mutations.length > 0) {
      console.log(`Sending ${mutations.length} mutations to Glide`)
      
      const response = await fetch('https://api.glideapp.io/api/function/mutateTables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.auth_token}`,
        },
        body: JSON.stringify({
          appID: config.app_id,
          mutations
        })
      })

      if (!response.ok) {
        throw new Error(`Glide mutation error: ${await response.text()}`)
      }

      const result = await response.json()
      console.log('Glide sync result:', result)
    }

    // Update queue items status
    if (queueItems?.length) {
      await supabaseClient
        .from('glide_messages_sync_queue')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString()
        })
        .in('id', queueItems.map(item => item.id))
    }

    // Log metrics
    await supabaseClient
      .from('glide_messages_sync_metrics')
      .insert({
        sync_batch_id: crypto.randomUUID(),
        total_messages: queueItems?.length || 0,
        successful_messages: successCount,
        failed_messages: failureCount,
        completed_at: new Date().toISOString()
      })

    return new Response(
      JSON.stringify({
        success: true,
        processed: queueItems?.length || 0,
        successful: successCount,
        failed: failureCount
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