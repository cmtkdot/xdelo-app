// Define a type for log data that covers common values
type LogData = Record<string, string | number | boolean | null | undefined | string[] | number[] | Record<string, unknown>>;

interface Logger {
  info: (message: string, data?: LogData) => void;
  error: (message: string, data?: LogData) => void;
  warn: (message: string, data?: LogData) => void;
}

export function getLogger(correlationId: string): Logger {
  return {
    info: (message: string, data?: LogData) => {
      console.log(`ℹ️ ${message}`, {
        correlation_id: correlationId,
        ...data
      });
    },
    error: (message: string, data?: LogData) => {
      console.error(`❌ ${message}`, {
        correlation_id: correlationId,
        ...data
      });
    },
    warn: (message: string, data?: LogData) => {
      console.warn(`⚠️ ${message}`, {
        correlation_id: correlationId,
        ...data
      });
    }
  };
}

export const logEditOperation = async (supabase: any, messageId: string, chatId: number, previousState: string, newState: string) => {
  try {
    await supabase.from('webhook_logs').insert({
      event_type: 'message_edit',
      message_id: messageId,
      chat_id: chatId,
      metadata: {
        previous_state: previousState,
        new_state: newState,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Failed to log edit operation:', error);
  }
};
