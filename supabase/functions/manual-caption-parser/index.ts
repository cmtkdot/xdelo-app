
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Manual parsing logic
import { parseCaption } from "./captionParser.ts";
import { ParsedContent, MediaGroupResult } from "./types.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req) => {
  // This function is designed to be triggered by database changes
  // via webhook requests from the Supabase hook system
  try {
    const payload = await req.json();
    
    // Log the payload for debugging
    console.log("Received webhook payload:", JSON.stringify(payload));
    
    // Extract the message data from the payload
    const record = payload.record;
    if (!record) {
      throw new Error("No record found in payload");
    }
    
    const messageId = record.id;
    const caption = record.caption;
    
    console.log(`Processing message ${messageId} with caption: ${caption}`);
    
    if (!caption) {
      console.log("Skipping message with no caption");
      return new Response(JSON.stringify({
        success: false,
        error: "No caption to process"
      }), {
        headers: { "Content-Type": "application/json" },
        status: 200 // Still return 200 to acknowledge the webhook
      });
    }
    
    // Parse the caption
    const parsedContent = parseCaption(caption);
    
    // Update the message with the parsed content
    // Always use 'completed' for the processing state
    const { error: updateError } = await supabase
      .from("messages")
      .update({
        analyzed_content: parsedContent,
        processing_state: "completed",
        processing_completed_at: new Date().toISOString()
      })
      .eq("id", messageId);
    
    if (updateError) {
      throw new Error(`Failed to update message: ${updateError.message}`);
    }
    
    // Handle media group sync if needed
    let mediaGroupResult: MediaGroupResult = { success: false };
    
    if (record.media_group_id) {
      mediaGroupResult = await syncMediaGroup(
        record.media_group_id,
        messageId,
        parsedContent
      );
    }
    
    return new Response(JSON.stringify({
      success: true,
      messageId,
      parsedContent,
      mediaGroupSync: mediaGroupResult
    }), {
      headers: { "Content-Type": "application/json" },
      status: 200
    });
  } catch (error) {
    console.error("Error processing caption:", error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { "Content-Type": "application/json" },
      status: 500
    });
  }
});

// Helper function to sync parsed content across a media group
async function syncMediaGroup(
  mediaGroupId: string,
  sourceMessageId: string,
  parsedContent: ParsedContent
): Promise<MediaGroupResult> {
  try {
    if (!mediaGroupId) {
      return { success: false, reason: "No media group ID provided" };
    }

    // Add sync metadata to parsed content
    const contentWithSync = {
      ...parsedContent,
      sync_metadata: {
        ...parsedContent.sync_metadata,
        media_group_id: mediaGroupId,
        sync_source_message_id: sourceMessageId
      }
    };

    // Get all messages in the media group except the source message
    const { data: groupMessages, error: queryError } = await supabase
      .from("messages")
      .select("id")
      .eq("media_group_id", mediaGroupId)
      .neq("id", sourceMessageId);

    if (queryError) {
      return { 
        success: false, 
        error: `Failed to query media group: ${queryError.message}` 
      };
    }

    if (!groupMessages || groupMessages.length === 0) {
      return { 
        success: true, 
        syncedCount: 0, 
        reason: "No other messages in group to sync" 
      };
    }

    // Update all other messages in the group with the same analyzed content
    // Always use 'completed' for the processing state
    const { error: updateError } = await supabase
      .from("messages")
      .update({
        analyzed_content: contentWithSync,
        processing_state: "completed",
        processing_completed_at: new Date().toISOString(),
        group_caption_synced: true
      })
      .eq("media_group_id", mediaGroupId)
      .neq("id", sourceMessageId);

    if (updateError) {
      return { 
        success: false, 
        error: `Failed to update media group: ${updateError.message}` 
      };
    }

    return { 
      success: true, 
      syncedCount: groupMessages.length,
      source_message_id: sourceMessageId,
      method: "manual-parser"
    };
  } catch (error) {
    console.error("Error syncing media group:", error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}
