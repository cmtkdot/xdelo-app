
// This file is maintained for backward compatibility
// New code should import directly from the database/ directory

import { 
  createMessage,
  createNonMediaMessage,
  updateMessage,
  updateMessageProcessingState,
  checkDuplicateFile,
  LoggerInterface,
  MessageResponse,
  BaseMessageRecord,
  MediaMessage, 
  NonMediaMessage,
  UpdateProcessingStateParams,
  MessageInput
} from './database/index.ts';

import { logMessageEvent } from './database/auditLogger.ts';

// Re-export all the imported functions and types for backward compatibility
export {
  createMessage,
  createNonMediaMessage,
  updateMessage,
  updateMessageProcessingState,
  checkDuplicateFile,
  logMessageEvent,
  LoggerInterface,
  MessageResponse,
  BaseMessageRecord,
  MediaMessage,
  NonMediaMessage,
  UpdateProcessingStateParams,
  MessageInput
};
