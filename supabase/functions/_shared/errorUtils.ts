
/**
 * Extract error information from a Supabase Function log entry
 * 
 * @param logData The log data JSON object
 * @returns An object containing extracted error details
 */
export function extractErrorDetails(logData: any) {
  try {
    if (!logData) {
      return {
        error: 'No log data provided',
        function_id: null,
        message: null,
        timestamp: null,
        path: null,
        execution_id: null
      };
    }
    
    // Extract the error message
    let errorMessage = logData.event_message || 'Unknown error';
    
    // Extract function path/location if available
    let errorPath = null;
    const pathMatch = errorMessage.match(/at\s+([^\s]+)\s+\(file:\/\/\/[^)]+\)/);
    if (pathMatch && pathMatch.length > 1) {
      errorPath = pathMatch[1];
    }
    
    // Extract function ID and execution details from metadata
    const metadata = Array.isArray(logData.metadata) && logData.metadata.length > 0 
      ? logData.metadata[0] 
      : {};
    
    // Check if this is a file_id error from Telegram
    const isFileIdError = errorMessage.includes('wrong file_id') || 
                          errorMessage.includes('file is temporarily unavailable');
    
    return {
      error: errorMessage,
      function_id: metadata.function_id || null,
      message: errorMessage.split('\n')[0], // Just the first line of the error
      timestamp: metadata.timestamp || logData.timestamp,
      path: errorPath,
      execution_id: metadata.execution_id || null,
      region: metadata.region || null,
      level: metadata.level || 'error',
      is_file_id_error: isFileIdError,
      file_id: isFileIdError ? extractFileIdFromError(errorMessage) : null
    };
  } catch (e) {
    console.error('Error extracting error details:', e);
    return {
      error: 'Error parsing log data',
      function_id: null,
      message: String(e),
      timestamp: null,
      path: null,
      execution_id: null
    };
  }
}

/**
 * Try to extract the file_id from an error message
 */
function extractFileIdFromError(errorMessage: string): string | null {
  try {
    // Look for patterns like "file_id=AgACAgEAA" in the error message
    const fileIdMatch = errorMessage.match(/file_id=([^&\s]+)/);
    if (fileIdMatch && fileIdMatch.length > 1) {
      return fileIdMatch[1];
    }
    return null;
  } catch (error) {
    console.error('Error extracting file_id from error message:', error);
    return null;
  }
}
