
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { supabaseClient, logProcessingEvent } from "../_shared/consolidatedMessageUtils.ts";

serve(async (req) => {
  try {
    const { messageIds, limit = 100, correlation_id } = await req.json();
    const traceId = correlation_id || crypto.randomUUID().toString();
    
    // Log the operation start
    await logProcessingEvent(
      "DUPLICATE_RECOVERY_STARTED",
      "system",
      traceId,
      { 
        specific_message_ids: messageIds ? true : false,
        message_count: messageIds?.length || 0,
        limit
      }
    );

    // Query to find duplicates or use provided message IDs
    let duplicateQuery;
    
    if (messageIds && Array.isArray(messageIds) && messageIds.length > 0) {
      // Use specific message IDs
      duplicateQuery = supabaseClient
        .from('messages')
        .select('id, file_unique_id, media_group_id, is_duplicate, duplicate_reference_id')
        .in('id', messageIds)
        .eq('is_duplicate', true)
        .not('duplicate_reference_id', 'is', null);
    } else {
      // Find duplicate messages automatically
      duplicateQuery = supabaseClient
        .from('messages')
        .select('id, file_unique_id, media_group_id, is_duplicate, duplicate_reference_id')
        .eq('is_duplicate', true)
        .not('duplicate_reference_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(limit);
    }

    const { data: duplicates, error: duplicatesError } = await duplicateQuery;

    if (duplicatesError) {
      throw new Error(`Failed to find duplicates: ${duplicatesError.message}`);
    }

    if (!duplicates || duplicates.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No eligible duplicate messages found to recover", 
          recovered: 0 
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Process each duplicate message
    const results = [];
    let recoveredCount = 0;
    let errorCount = 0;

    for (const duplicate of duplicates) {
      try {
        // Get the source message (the original that this is a duplicate of)
        const { data: source, error: sourceError } = await supabaseClient
          .from('messages')
          .select('*')
          .eq('id', duplicate.duplicate_reference_id)
          .single();

        if (sourceError || !source) {
          results.push({
            id: duplicate.id,
            success: false,
            error: sourceError?.message || 'Source message not found'
          });
          errorCount++;
          continue;
        }

        // Get the analyzed content from the source
        const { data: updated, error: updateError } = await supabaseClient
          .from('messages')
          .update({
            analyzed_content: source.analyzed_content,
            processing_state: 'completed',
            is_duplicate: true, // Keep marking as duplicate for reference
            updated_at: new Date().toISOString()
          })
          .eq('id', duplicate.id)
          .select('id')
          .single();

        if (updateError) {
          results.push({
            id: duplicate.id,
            success: false,
            error: updateError.message
          });
          errorCount++;
        } else {
          results.push({
            id: duplicate.id,
            success: true,
            source_id: source.id
          });
          recoveredCount++;
        }
      } catch (error) {
        results.push({
          id: duplicate.id,
          success: false,
          error: error.message || String(error)
        });
        errorCount++;
      }
    }

    // Log completion
    await logProcessingEvent(
      "DUPLICATE_RECOVERY_COMPLETED",
      "system",
      traceId,
      { 
        processed: duplicates.length,
        recovered: recoveredCount,
        errors: errorCount,
        results: results.slice(0, 10) // Just log first 10 results to avoid large logs
      }
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${duplicates.length} duplicate messages`,
        processed: duplicates.length,
        recovered: recoveredCount,
        errors: errorCount,
        results
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    // Log error
    await logProcessingEvent(
      "DUPLICATE_RECOVERY_ERROR",
      "system",
      crypto.randomUUID().toString(),
      { error: error.message },
      error.message
    );

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || String(error) 
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
