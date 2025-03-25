
/**
 * Result type for repair operations
 */
export interface RepairResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
  successful?: number;
  failed?: number;
}

/**
 * Type definition for the useMediaUtils hook return value
 */
export interface UseMediaUtilsType {
  // Loading/error states
  isLoading: boolean;
  error: string | null;
  
  // Caption processing
  processCaption: (messageId: string, force?: boolean) => Promise<any>;
  
  // Media group operations
  syncMediaGroup: (sourceMessageId: string, mediaGroupId: string, force?: boolean) => Promise<any>;
  scheduleDelayedSync: (messageId: string, mediaGroupId: string) => Promise<any>;
  
  // File operations (from useMediaStorage)
  uploadMedia?: (file: File, options?: any) => Promise<any>;
  downloadMedia?: (url: string, filename?: string) => Promise<any>;
  deleteMedia?: (path: string) => Promise<any>;
  
  // Query operations (from useMediaQueries)
  getMessages?: (options?: any) => Promise<any>;
  getMessageById?: (id: string) => Promise<any>;
  updateMessage?: (id: string, data: any) => Promise<any>;
}

/**
 * Type for the context provider (not used yet but required by import)
 */
export interface MediaUtilsProvider {
  children: React.ReactNode;
}
