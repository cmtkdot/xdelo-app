import { SupabaseClient, ExistingMessage, ProcessingState, MessageData } from "./types.ts";

export async function findExistingMessage(
  supabase: SupabaseClient,
  fileUniqueId: string
): Promise<ExistingMessage | null> {
  try {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("file_unique_id", fileUniqueId)
      .single();

    if (error) {
      if (error.code === "PGRST116") { // Not found error
        return null;
      }
      console.error("❌ Error checking for existing message:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("❌ Error in findExistingMessage:", error);
    throw error;
  }
}

export async function updateExistingMessage(
  supabase: SupabaseClient,
  messageId: string,
  updateData: Partial<MessageData>
) {
  try {
    // Validate processing state if it's being updated
    if (updateData.processing_state) {
      const validStates: ProcessingState[] = [
        'initialized',
        'pending',
        'processing',
        'completed',
        'error'
      ];
      if (!validStates.includes(updateData.processing_state)) {
        throw new Error(`Invalid processing_state: ${updateData.processing_state}`);
      }
    }

    const { data: updatedMessage, error } = await supabase
      .from("messages")
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq("id", messageId)
      .select()
      .single();

    if (error) {
      console.error("❌ Failed to update existing message:", error);
      throw error;
    }

    if (!updatedMessage) {
      throw new Error(`No message found with id ${messageId}`);
    }

    return updatedMessage;
  } catch (error) {
    console.error("❌ Error in updateExistingMessage:", error);
    throw error;
  }
}

export async function createNewMessage(
  supabase: SupabaseClient,
  messageData: MessageData
) {
  try {
    // Validate processing state
    if (messageData.processing_state) {
      const validStates: ProcessingState[] = [
        'initialized',
        'pending',
        'processing',
        'completed',
        'error'
      ];
      if (!validStates.includes(messageData.processing_state)) {
        throw new Error(`Invalid processing_state: ${messageData.processing_state}`);
      }
    }

    const { data: newMessage, error: messageError } = await supabase
      .from("messages")
      .insert({
        ...messageData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (messageError) {
      console.error("❌ Failed to store message:", messageError);
      throw messageError;
    }

    return newMessage;
  } catch (error) {
    console.error("❌ Error in createNewMessage:", error);
    throw error;
  }
}

export async function triggerCaptionParsing(
  supabase: SupabaseClient,
  messageId: string,
  mediaGroupId: string | undefined,
  caption: string
) {
  try {
    console.log("🔄 Triggering caption parsing for message:", messageId);
    
    // Update message state to processing
    await updateExistingMessage(supabase, messageId, {
      processing_state: 'processing'
    });

    // Call parse-caption-with-ai edge function
    const { error } = await supabase.functions.invoke('parse-caption-with-ai', {
      body: {
        message_id: messageId,
        media_group_id: mediaGroupId,
        caption,
        correlation_id: crypto.randomUUID()
      }
    });

    if (error) {
      console.error("❌ Caption parsing failed:", error);
      
      // Update message state to error
      await updateExistingMessage(supabase, messageId, {
        processing_state: 'error',
        error_message: error.message
      });
      
      throw error;
    }

    console.log("✅ Caption parsing triggered successfully");
  } catch (error) {
    console.error("❌ Error triggering caption parsing:", error);
    
    // Update message state to error if not already done
    try {
      await updateExistingMessage(supabase, messageId, {
        processing_state: 'error',
        error_message: error.message
      });
    } catch (updateError) {
      console.error("❌ Failed to update error state:", updateError);
    }
    
    throw error;
  }
}

export async function syncMediaGroupAnalysis(
  supabase: SupabaseClient,
  mediaGroupId: string,
  analyzedContent: any,
  originalMessageId: string
) {
  try {
    console.log("🔄 Syncing media group analysis:", { mediaGroupId, originalMessageId });
    
    const { error } = await supabase.rpc('process_media_group_analysis', {
      p_message_id: originalMessageId,
      p_media_group_id: mediaGroupId,
      p_analyzed_content: analyzedContent,
      p_processing_completed_at: new Date().toISOString()
    });

    if (error) {
      console.error("❌ Failed to sync media group analysis:", error);
      throw error;
    }

    console.log("✅ Media group analysis synced successfully");
  } catch (error) {
    console.error("❌ Error in syncMediaGroupAnalysis:", error);
    throw error;
  }
}