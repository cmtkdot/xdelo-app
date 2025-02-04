import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GlideResponse {
  rows?: Array<Record<string, any>>;
  next?: string;
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
      .single()

    if (configError || !config) {
      throw new Error('No active Glide configuration found')
    }

    console.log('Processing with config:', {
      tableName: config.glide_table_name,
      authToken: config.auth_token ? 'present' : 'missing',
      mappings: Object.keys(config.field_mappings).length
    })

    // Extract appID from table name (format: native-table-{appID})
    const appID = config.glide_table_name.split('-')[2]
    if (!appID) {
      throw new Error('Invalid Glide table name format')
    }

    // First, get current Glide data to compare
    const glideResponse = await fetch('https://api.glideapp.io/api/function/queryTables', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.auth_token}`,
      },
      body: JSON.stringify({
        appID: appID,
        queries: [{
          tableName: config.glide_table_name,
          utc: true
        }]
      })
    })

    if (!glideResponse.ok) {
      throw new Error(`Glide API error: ${await glideResponse.text()}`)
    }

    const glideData: GlideResponse = await glideResponse.json()
    const glideRows = glideData.rows || []
    
    // Create a map of Glide rows by ID for quick lookup
    const glideRowsMap = new Map(
      glideRows.map(row => [row[config.field_mappings['id']], row])
    )

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

        const glideRow = glideRowsMap.get(message.id)
        const mappedData: Record<string, any> = {}

        // Map message data to Glide columns
        for (const [glideField, messageField] of Object.entries(config.field_mappings)) {
          let value = message[messageField]
          
          // Handle special JSON fields
          if (messageField === 'analyzed_content' || messageField === 'telegram_data') {
            value = JSON.stringify(value)
          }
          
          mappedData[glideField] = value
        }

        // Determine operation type
        const operation = glideRow ? 'set-columns-in-row' : 'add-row-to-table'
        
        mutations.push({
          kind: operation,
          tableName: config.glide_table_name,
          columnValues: mappedData,
          ...(glideRow && { rowID: glideRow[config.field_mappings['id']] })
        })

        // Update sync status
        await supabaseClient
          .from('messages')
          .update({
            glide_sync_data: glideRow || {},
            glide_last_sync_at: new Date().toISOString(),
            glide_row_id: glideRow?.[config.field_mappings['id']] || null
          })
          .eq('id', message.id)

        successCount++
      } catch (error) {
        console.error('Sync error:', error)
        failureCount++
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
          appID: appID,
          mutations
        })
      })

      if (!response.ok) {
        throw new Error(`Glide mutation error: ${await response.text()}`)
      }
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