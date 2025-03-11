# Media Handling Utilities

This document outlines the consolidated media handling system in the Supabase Edge Functions.

## Architecture Overview

All media utilities are now centralized in the `_shared` directory with wrapper implementations in specific functions:

```
supabase/functions/
├── _shared/
│   ├── mediaUtils.ts      # MAIN UTILITY LIBRARY - Core media functions
│   ├── urls.ts            # URL generation utilities
│   ├── supabase.ts        # Supabase client initialization
│   └── cors.ts            # CORS headers
├── telegram-webhook/
│   ├── mediaUtils.ts      # Simple re-export wrapper (backward compatibility)
│   └── utils/
│       └── mediaUtils.ts  # Webhook-specific wrappers around shared utilities
├── media-management/
│   └── index.ts           # Uses shared utilities directly
└── redownload-missing-files/
    └── index.ts           # Uses shared utilities directly
```

## Implementation Details

### Core Principles

1. **Single Source of Truth**: All media utility functions are defined in `_shared/mediaUtils.ts`
2. **Always Redownload and Reupload**: Media is always redownloaded and reuploaded rather than checking for existence
3. **Consistent Content Disposition**: All uploads use `contentDisposition: 'inline'` for better browser viewing
4. **Standardized Paths**: File paths are consistently constructed from unique IDs and MIME types

### Key Components

#### 1. Media Utilities (`_shared/mediaUtils.ts`)

Core functions:
- `xdelo_getDefaultMimeType` - Get default MIME type for a media type
- `xdelo_detectMimeType` - Enhanced MIME type detection from Telegram objects
- `xdelo_constructStoragePath` - Standardized storage path construction
- `xdelo_getUploadOptions` - Consistent upload options with inline content disposition
- `xdelo_uploadMediaToStorage` - Upload media with proper settings and return public URL
- `xdelo_validateStoragePath` - Check if a file exists in storage
- `xdelo_checkFileExistsInStorage` - Storage existence check by file ID and MIME type
- `xdelo_repairContentDisposition` - Fix content disposition by re-uploading
- `xdelo_isViewableMimeType` - Check if a MIME type is viewable in browser
- `xdelo_getMediaInfoFromTelegram` - Get media info and download from Telegram
- `xdelo_redownloadMissingFile` - Redownload missing files from Telegram

#### 2. URL Utilities (`_shared/urls.ts`)

Helper functions:
- `getStoragePublicUrl` - Generate public URL for storage objects
- `getTelegramApiUrl` - Get Telegram API endpoint URL
- `getTelegramFileUrl` - Get Telegram file download URL
- `getSupabaseFunctionUrl` - Get URL for a Supabase function

## Usage Guidelines

### 1. Adding New Media Functionality

When adding new media-handling functionality:

1. First add the function to `_shared/mediaUtils.ts` with the `xdelo_` prefix
2. Import and use this function in other edge functions
3. If needed, create wrapper functions in function-specific utils for specialized behavior

### 2. Direct Usage Example

```typescript
import { 
  xdelo_detectMimeType,
  xdelo_uploadMediaToStorage 
} from "../_shared/mediaUtils.ts";

// Use the shared utilities directly
const mimeType = xdelo_detectMimeType(mediaObject);
const { success, publicUrl } = await xdelo_uploadMediaToStorage(
  fileData,
  storagePath,
  mimeType
);
```

### 3. Wrapper Usage Example

When you need function-specific behavior on top of the core utilities:

```typescript
import { xdelo_redownloadMissingFile } from "../_shared/mediaUtils.ts";

// Create a wrapper with additional behavior
export async function redownloadAndUpdateDatabase(message) {
  const result = await xdelo_redownloadMissingFile(message);
  
  if (result.success) {
    // Add function-specific behavior (e.g., database updates)
    await updateDatabase(message.id, result);
  }
  
  return result;
}
```

## Maintenance Notes

1. **Avoid Duplication**: Never duplicate media handling logic - always extend the shared utilities
2. **Consistent Naming**: Use the `xdelo_` prefix for shared utilities to clearly identify them
3. **Documentation**: Document any new utilities and update this file when making significant changes
4. **Content Disposition**: Always set `contentDisposition: 'inline'` for better browser viewing
5. **Backward Compatibility**: Maintain re-export wrappers for backward compatibility
