
// Re-export handlers with proper handling for circular dependencies
// Using the smart dispatcher pattern for unified message handling
export { handleMediaMessage } from './mediaMessageHandler.ts';
export { handleOtherMessage } from './textMessageHandler.ts';
// handleEditedMessage has been consolidated into the smart dispatcher in mediaMessageHandler.ts
