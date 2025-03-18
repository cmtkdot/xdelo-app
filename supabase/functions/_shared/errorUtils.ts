
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
    
    return {
      error: errorMessage,
      function_id: metadata.function_id || null,
      message: errorMessage.split('\n')[0], // Just the first line of the error
      timestamp: metadata.timestamp || logData.timestamp,
      path: errorPath,
      execution_id: metadata.execution_id || null,
      region: metadata.region || null,
      level: metadata.level || 'error'
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
