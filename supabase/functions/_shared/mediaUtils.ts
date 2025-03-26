// This file is now just a re-export from the modular implementation
// to maintain backward compatibility

export * from './mediaUtils/mimeTypes.ts';
export * from './mediaUtils/storagePaths.ts';
export * from './mediaUtils/uploadUtils.ts';
export * from './mediaUtils/fetchUtils.ts';
export * from './mediaUtils/telegramDownloader.ts';
export * from './mediaUtils/duplicateDetection.ts';
export * from './mediaUtils/messageProcessor.ts';

// Deprecated: The functions below are kept only for backward compatibility
// and will be removed in future versions
import { 
  xdelo_isViewableMimeType,
  xdelo_getExtensionFromMimeType,
  xdelo_detectMimeType,
  xdelo_generateStoragePath,
  xdelo_validateAndFixStoragePath,
  xdelo_getUploadOptions
} from './mediaUtils/mimeTypes.ts';

import {
  xdelo_downloadMediaFromTelegram
} from './mediaUtils/telegramDownloader.ts';

import {
  xdelo_uploadMediaToStorage
} from './mediaUtils/uploadUtils.ts';

import {
  xdelo_processMessageMedia
} from './mediaUtils/messageProcessor.ts';

// Re-export for backward compatibility
export {
  xdelo_isViewableMimeType,
  xdelo_getExtensionFromMimeType,
  xdelo_detectMimeType,
  xdelo_generateStoragePath,
  xdelo_validateAndFixStoragePath,
  xdelo_getUploadOptions,
  xdelo_downloadMediaFromTelegram,
  xdelo_uploadMediaToStorage,
  xdelo_processMessageMedia
};
