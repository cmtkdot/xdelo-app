
interface Logger {
  info: (message: string, data?: Record<string, any>) => void;
  error: (message: string, data?: Record<string, any>) => void;
  warn: (message: string, data?: Record<string, any>) => void;
}

export function getLogger(correlationId: string): Logger {
  return {
    info: (message: string, data?: Record<string, any>) => {
      console.log(`ℹ️ ${message}`, {
        correlation_id: correlationId,
        ...data
      });
    },
    error: (message: string, data?: Record<string, any>) => {
      console.error(`❌ ${message}`, {
        correlation_id: correlationId,
        ...data
      });
    },
    warn: (message: string, data?: Record<string, any>) => {
      console.warn(`⚠️ ${message}`, {
        correlation_id: correlationId,
        ...data
      });
    }
  };
}
