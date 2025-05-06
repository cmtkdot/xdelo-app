/**
 * HTTP utilities for edge functions
 */
import { logError } from './logging.ts';

export interface HttpResponse<T> {
  success: boolean;
  status: number;
  statusText: string;
  data?: T;
  error?: string;
  retries?: number;
}

export interface HttpClientOptions {
  baseUrl?: string;
  headers?: Record<string, string>;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  retryBackoffFactor?: number;
}

const defaultOptions: HttpClientOptions = {
  timeout: 10000,      // 10 seconds default timeout
  maxRetries: 3,       // Default max retries
  retryDelay: 1000,    // Start with 1s delay
  retryBackoffFactor: 2, // Double the delay each retry
};

/**
 * Create an HTTP client with standardized error handling and retries
 * @param options Configuration options for the HTTP client
 * @returns HTTP client object with fetch methods
 */
export function createHttpClient(options: HttpClientOptions = {}) {
  const config = { ...defaultOptions, ...options };

  /**
   * Perform an HTTP request with timeout and retry logic
   */
  async function request<T>(
    url: string,
    method = 'GET',
    body?: unknown,
    headers: Record<string, string> = {},
    correlationId?: string
  ): Promise<HttpResponse<T>> {
    // Build full URL if baseUrl is provided
    const fullUrl = config.baseUrl ? `${config.baseUrl}${url}` : url;

    // Combine default headers with passed headers
    const requestHeaders = {
      ...config.headers,
      ...headers,
    };

    // Add correlation ID as a header if provided
    if (correlationId) {
      requestHeaders['X-Correlation-ID'] = correlationId;
    }

    // Prepare request options
    const requestOptions: RequestInit = {
      method,
      headers: requestHeaders,
    };

    // Add body for non-GET requests
    if (body && method !== 'GET') {
      if (typeof body === 'object') {
        requestOptions.body = JSON.stringify(body);
        // Add Content-Type if not specified
        if (!requestHeaders['Content-Type']) {
          requestHeaders['Content-Type'] = 'application/json';
        }
      } else {
        requestOptions.body = body as BodyInit;
      }
    }

    let retries = 0;
    let lastError: Error | null = null;

    while (retries <= config.maxRetries!) {
      try {
        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout);

        // Add signal to request options
        requestOptions.signal = controller.signal;

        // Make the request
        const response = await fetch(fullUrl, requestOptions);

        // Clear timeout
        clearTimeout(timeoutId);

        // Check if response is ok
        if (!response.ok) {
          // Try to parse error response
          let errorData;
          try {
            errorData = await response.json();
          } catch {
            errorData = { message: response.statusText };
          }

          const errorMessage = errorData?.message || errorData?.error || response.statusText;

          // Log the error if correlation ID is provided
          if (correlationId) {
            await logError(
              'http_request',
              url,
              `HTTP ${response.status}: ${errorMessage}`,
              correlationId,
              {
                method,
                url: fullUrl,
                status: response.status,
                error_data: errorData
              }
            );
          }

          return {
            success: false,
            status: response.status,
            statusText: response.statusText,
            error: errorMessage,
            retries
          };
        }

        // Parse response data
        let data;
        const contentType = response.headers.get('Content-Type') || '';

        if (contentType.includes('application/json')) {
          data = await response.json();
        } else if (contentType.includes('text/')) {
          data = await response.text();
        } else {
          // Binary data or other types
          data = await response.blob();
        }

        // Success response
        return {
          success: true,
          status: response.status,
          statusText: response.statusText,
          data: data as T,
          retries
        };
      } catch (error) {
        lastError = error as Error;
        retries++;

        // Log the error if correlation ID is provided and it's the last retry
        if (correlationId && retries > config.maxRetries!) {
          await logError(
            'http_request',
            url,
            lastError.message,
            correlationId,
            {
              method,
              url: fullUrl,
              retries
            }
          );
        }

        // Check if we've reached max retries
        if (retries <= config.maxRetries!) {
          // Calculate backoff with exponential factor
          const delay = config.retryDelay! * Math.pow(config.retryBackoffFactor!, retries - 1);
          console.log(`Request failed, retrying in ${delay}ms: ${lastError.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    return {
      success: false,
      status: 0,
      statusText: 'Request failed after retries',
      error: lastError?.message || 'Unknown error',
      retries
    };
  }

  return {
    get: <T>(url: string, headers = {}, correlationId?: string) =>
      request<T>(url, 'GET', undefined, headers, correlationId),

    post: <T>(url: string, body: unknown, headers = {}, correlationId?: string) =>
      request<T>(url, 'POST', body, headers, correlationId),

    put: <T>(url: string, body: unknown, headers = {}, correlationId?: string) =>
      request<T>(url, 'PUT', body, headers, correlationId),

    patch: <T>(url: string, body: unknown, headers = {}, correlationId?: string) =>
      request<T>(url, 'PATCH', body, headers, correlationId),

    delete: <T>(url: string, headers = {}, correlationId?: string) =>
      request<T>(url, 'DELETE', undefined, headers, correlationId),
  };
}

/**
 * Create a Telegram API client
 * @param token Telegram bot token
 * @returns HTTP client for Telegram API
 */
export function createTelegramClient(token: string) {
  const baseUrl = `https://api.telegram.org/bot${token}/`;

  return createHttpClient({
    baseUrl,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Make a request to the Telegram API
 * @param method Telegram API method
 * @param token Telegram bot token
 * @param params Parameters for the API call
 * @param correlationId Optional correlation ID for tracking
 * @returns Response from the Telegram API
 */
export async function callTelegramApi<T>(
  method: string,
  token: string,
  params: Record<string, unknown>,
  correlationId?: string
): Promise<HttpResponse<T>> {
  const client = createTelegramClient(token);
  return await client.post<T>(method, params, {}, correlationId);
}
