
export interface LogData {
  event: string;
  data?: any;
  error?: Error | string;
  metadata?: Record<string, any>;
}

export const logger = {
  info: async (logData: LogData) => {
    console.log(JSON.stringify({
      level: 'info',
      timestamp: new Date().toISOString(),
      ...logData,
      error: logData.error ? logData.error.toString() : undefined
    }));
  },
  
  error: async (logData: LogData) => {
    console.error(JSON.stringify({
      level: 'error',
      timestamp: new Date().toISOString(),
      ...logData,
      error: logData.error ? logData.error.toString() : undefined
    }));
  }
};
