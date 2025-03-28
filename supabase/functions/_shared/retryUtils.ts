import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logProcessingEvent } from "../../_shared/auditLogger.ts";

interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export class RetryHandler {
  private attempts = 0;
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;

  constructor(options: RetryOptions = {}) {
    this.maxAttempts = options.maxAttempts || 3;
    this.baseDelayMs = options.baseDelayMs || 1000;
    this.maxDelayMs = options.maxDelayMs || 10000;
  }

  async execute<T>(
    operation: () => Promise<T>,
    shouldRetry: (error: any) => boolean
  ): Promise<T> {
    while (this.attempts < this.maxAttempts) {
      try {
        return await operation();
      } catch (error) {
        this.attempts++;

        if (!shouldRetry(error) || this.attempts >= this.maxAttempts) {
          throw error;
        }

        const delay = this.calculateBackoff();
        logProcessingEvent('retry_attempt', {
          attempt: this.attempts,
          delay_ms: delay,
          error: error.message
        });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Max retry attempts exceeded');
  }

  private calculateBackoff(): number {
    const jitter = Math.random() * 0.2 - 0.1; // ±10% jitter
    const delay = Math.min(
      this.baseDelayMs * Math.pow(2, this.attempts - 1),
      this.maxDelayMs
    );
    return delay * (1 + jitter);
  }
}

export const shouldRetryOperation = (error: any): boolean => {
  // Retry on network errors, timeouts, and rate limits
  if (error.code === 'ETIMEDOUT' ||
      error.code === 'ECONNRESET' ||
      error.code === '429') {
    return true;
  }

  // Don't retry on client errors (4xx) except 429
  if (error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
    return false;
  }

  // Default to retry for server errors (5xx)
  return error.statusCode >= 500;
};
