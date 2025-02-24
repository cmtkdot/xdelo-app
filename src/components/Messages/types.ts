
import type { ProcessingState, Message, AnalyzedContent } from '@/types';

export type { Message, AnalyzedContent, ProcessingState };

// Re-export the database message type with a different name for components
export type MessageComponentData = Message;
