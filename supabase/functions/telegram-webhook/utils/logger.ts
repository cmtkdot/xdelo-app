
/**
 * Logger utility for consistent logging format
 */
export class Logger {
  private prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  info(message: string, data?: any): void {
    if (data) {
      console.log(`[${this.prefix}] ${message}`, data);
    } else {
      console.log(`[${this.prefix}] ${message}`);
    }
  }

  warn(message: string, data?: any): void {
    if (data) {
      console.warn(`[${this.prefix}] WARNING: ${message}`, data);
    } else {
      console.warn(`[${this.prefix}] WARNING: ${message}`);
    }
  }

  error(message: string, error?: any): void {
    if (error) {
      console.error(`[${this.prefix}] ERROR: ${message}`, error);
    } else {
      console.error(`[${this.prefix}] ERROR: ${message}`);
    }
  }

  debug(message: string, data?: any): void {
    if (Deno.env.get('DEBUG') === 'true') {
      if (data) {
        console.log(`[${this.prefix}] DEBUG: ${message}`, data);
      } else {
        console.log(`[${this.prefix}] DEBUG: ${message}`);
      }
    }
  }

  track(correlationId: string, message: string, data?: any): void {
    if (data) {
      console.log(`[${this.prefix}] [${correlationId}] ${message}`, data);
    } else {
      console.log(`[${this.prefix}] [${correlationId}] ${message}`);
    }
  }
}
