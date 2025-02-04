import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

interface SyncMetrics {
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: any[];
}

// Handle CORS preflight requests
Deno.serve(async (req) => {
  console.log("📥 Received sync request");

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log("🔍 Fetching active Glide configuration");
    const { data: config, error: configError } = await supabaseClient
      .from('glide_messages_configuration')
      .select('*')
      .eq('is_active', true)
      .maybeSingle()

    if (configError) {
      console.error("❌ Error fetching Glide configuration:", configError);
      throw new Error(`Failed to fetch Glide configuration: ${configError.message}`);
    }

    if (!config) {
      console.error("❌ No active Glide configuration found");
      throw new Error('No active Glide configuration found');
    }

    console.log("✅ Configuration found:", {
      tableName: config.glide_table_name,
      authToken: config.auth_token ? 'present' : 'missing'
    });

    // Process pending queue items with batching
    console.log("🔄 Fetching pending queue items");
    const { data: queueItems, error: queueError } = await supabaseClient
      .from('glide_messages_sync_queue')
      .select('*, messages(*)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(100) // Process in smaller batches

    if (queueError) {
      console.error("❌ Error fetching queue items:", queueError);
      throw new Error(`Failed to fetch queue items: ${queueError.message}`);
    }

    console.log(`📊 Processing ${queueItems?.length || 0} queue items`);

    const metrics: SyncMetrics = {
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    const batchId = crypto.randomUUID();
    const mutations = [];
    const processedIds = [];

    // Rate limiting helper
    const rateLimitDelay = 100; // ms between requests
    let lastRequestTime = Date.now();

    const waitForRateLimit = async () => {
      const now = Date.now();
      const elapsed = now - lastRequestTime;
      if (elapsed < rateLimitDelay) {
        await new Promise(resolve => setTimeout(resolve, rateLimitDelay - elapsed));
      }
      lastRequestTime = Date.now();
    };

    for (const item of queueItems || []) {
      try {
        console.log(`🔄 Processing item ${item.id}`);
        const message = item.messages;
        
        if (!message) {
          console.warn(`⚠️ No message found for queue item ${item.id}`);
          metrics.skipped++;
          continue;
        }

        // Compare with existing Glide data
        const existingGlideData = message.glide_sync_data?.data;
        const newData = message.supabase_sync_json;

        // Skip if data hasn't changed
        if (existingGlideData && 
            JSON.stringify(existingGlideData) === JSON.stringify(newData)) {
          console.log(`⏭️ Skipping unchanged message ${message.id}`);
          metrics.skipped++;
          continue;
        }

        // Validate required fields
        if (!newData || Object.keys(newData).length === 0) {
          throw new Error('Invalid sync data');
        }

        // Determine operation type
        const glideRowId = message.glide_row_id;
        const operation = glideRowId ? 'set-columns-in-row' : 'add-row-to-table';
        
        console.log(`📝 Preparing ${operation} mutation for message ${message.id}`);
        mutations.push({
          kind: operation,
          tableName: config.glide_table_name,
          columnValues: newData,
          ...(glideRowId && { rowID: glideRowId })
        });

        processedIds.push(item.id);
        await waitForRateLimit();

        // Update sync status
        const { error: updateError } = await supabaseClient
          .from('messages')
          .update({
            glide_last_sync_at: new Date().toISOString(),
            glide_sync_status: 'completed',
            glide_sync_data: {
              last_sync: new Date().toISOString(),
              batch_id: batchId,
              operation: operation,
              data: newData
            }
          })
          .eq('id', message.id);

        if (updateError) {
          console.error(`❌ Error updating message ${message.id}:`, updateError);
          throw updateError;
        }

        metrics.successful++;
        console.log(`✅ Successfully processed message ${message.id}`);
      } catch (error) {
        console.error(`❌ Sync error for item ${item.id}:`, error);
        metrics.failed++;
        metrics.errors.push({
          item_id: item.id,
          error: error.message,
          timestamp: new Date().toISOString()
        });

        // Update error status
        if (item.messages?.id) {
          const { error: statusError } = await supabaseClient
            .from('messages')
            .update({
              glide_sync_status: 'error',
              last_error_at: new Date().toISOString(),
              glide_sync_data: {
                last_error: error.message,
                error_time: new Date().toISOString(),
                batch_id: batchId
              }
            })
            .eq('id', item.messages.id);

          if (statusError) {
            console.error(`❌ Error updating error status for message ${item.messages.id}:`, statusError);
          }
        }
      }
      metrics.processed++;
    }

    // Send mutations to Glide if any
    if (mutations.length > 0) {
      console.log(`📤 Sending ${mutations.length} mutations to Glide`);
      
      try {
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
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("❌ Glide API error:", errorText);
          throw new Error(`Glide mutation error: ${errorText}`);
        }

        const result = await response.json();
        console.log('✅ Glide sync result:', result);

        // Update queue items status
        if (processedIds.length) {
          console.log("📝 Updating queue items status");
          const { error: queueUpdateError } = await supabaseClient
            .from('glide_messages_sync_queue')
            .update({
              status: 'completed',
              processed_at: new Date().toISOString()
            })
            .in('id', processedIds);

          if (queueUpdateError) {
            console.error("❌ Error updating queue status:", queueUpdateError);
          }
        }
      } catch (error) {
        console.error("❌ Failed to send mutations to Glide:", error);
        throw error;
      }
    }

    // Log metrics
    console.log("📊 Logging sync metrics");
    const { error: metricsError } = await supabaseClient
      .from('glide_messages_sync_metrics')
      .insert({
        sync_batch_id: batchId,
        total_messages: metrics.processed,
        successful_messages: metrics.successful,
        failed_messages: metrics.failed,
        completed_at: new Date().toISOString(),
        performance_data: {
          batch_size: mutations.length,
          processing_time: Date.now(),
          skipped_messages: metrics.skipped,
          errors: metrics.errors
        }
      });

    if (metricsError) {
      console.error("❌ Error logging metrics:", metricsError);
    }

    console.log("✅ Sync process completed");
    return new Response(
      JSON.stringify({
        success: true,
        metrics: {
          processed: metrics.processed,
          successful: metrics.successful,
          failed: metrics.failed,
          skipped: metrics.skipped
        },
        batch_id: batchId
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error("❌ Function error:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString(),
        type: error.name || 'UnknownError'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})