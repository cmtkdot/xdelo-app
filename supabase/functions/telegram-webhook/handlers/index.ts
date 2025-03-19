
// Re-export handlers with proper handling for circular dependencies
export { handleMediaMessage } from './mediaMessageHandler.ts';
export { handleOtherMessage } from './textMessageHandler.ts';
export { handleEditedMessage } from './editedMessageHandler.ts';
