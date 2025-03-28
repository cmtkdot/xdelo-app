
 * Update message processing state
 */
export async function updateMessageState(
  messageId: string,
  state: 'pending' | 'processing' | 'completed' | 'error',
  errorMessage?: string
) {
  try {
    const updates: Record<string, unknown> = {
      processing_state: state,
      updated_at: new Date().toISOString()
    };

    if (state === 'processing') {
      updates.processing_started_at = new Date().toISOString();
    } else if (state === 'completed') {
      updates.processing_completed_at = new Date().toISOString();
      updates.error_message = null;
    } else if (state === 'error' && errorMessage) {
      updates.error_message = errorMessage;
      updates.last_error_at = new Date().toISOString();
    }

    const { error } = await supabaseClient
      .from('messages')
      .update(updates)
      .eq('id', messageId);

    if (error) {
      console.error(`Error updating message state: ${error.message}`);
      return false;
    }

    return true;
  } catch (error: unknown) { // Add type annotation
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error updating message state: ${errorMessage}`);
    return false;
  }
}

/**
 * Get message by ID
 */
export async function getMessageById(messageId: string) {
  try {
    const { data, error } = await supabaseClient // Uses imported client
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (error) {
      console.error(`Error getting message: ${error.message}`);
      return null;
    }

    return data;
  } catch (error: unknown) { // Add type annotation
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error getting message: ${errorMessage}`);
    return null;
  }
}
