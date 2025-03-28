import { corsHeaders } from "./cors.ts";
// Export RequestMetadata
import { FunctionOptions, RequestMetadata, ApiResponse, ErrorResponse, SuccessResponse } from "./types.ts";
import { logProcessingEvent } from "./auditLogger.ts"; // Import logging function from dedicated module
export type { RequestMetadata }; // Re-export the type

export enum SecurityLevel {
  PUBLIC = "public",
  AUTHENTICATED = "authenticated",
  SERVICE_ROLE = "service_role"
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS';
type HandlerFunction = (req: Request, metadata: RequestMetadata) => Promise<Response>;

export class HandlerBuilder {
  private options: FunctionOptions = {
    securityLevel: SecurityLevel.PUBLIC,
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    enableCors: true,
    enableMetrics: true,
    enableLogging: true,
    requireAuth: false
  };

  constructor(private handlerFn: HandlerFunction) {}

  withSecurity(level: SecurityLevel): this {
    this.options.securityLevel = level;
    this.options.requireAuth = level !== SecurityLevel.PUBLIC;
    return this;
  }

  withMethods(methods: HttpMethod[]): this {
    this.options.allowedMethods = methods;
    return this;
  }

  withCors(enabled: boolean): this {
    this.options.enableCors = enabled;
    return this;
  }

  withMetrics(enabled: boolean): this {
    this.options.enableMetrics = enabled;
    return this;
  }

  withLogging(enabled: boolean): this {
    this.options.enableLogging = enabled;
    return this;
  }

  build(): (req: Request) => Promise<Response> {
    return async (req: Request): Promise<Response> => {
      const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();
      const startTime = performance.now();

      const metadata: RequestMetadata = {
        correlationId,
        method: req.method,
        path: new URL(req.url).pathname,
        processingTime: 0,
        status: 0,
        userAgent: req.headers.get('user-agent') || undefined,
        ipAddress: req.headers.get('x-forwarded-for') || undefined
      };

      // Handle CORS preflight
      if (this.options.enableCors && req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }

      // Validate allowed methods
      if (this.options.allowedMethods && !this.options.allowedMethods.includes(req.method as HttpMethod)) {
        return this.createErrorResponse(
          `Method ${req.method} not allowed`,
          405,
          metadata
        );
      }

      try {
        // Authentication check
        if (this.options.requireAuth) {
          const token = req.headers.get('Authorization')?.replace('Bearer ', '');
          if (!token) {
            return this.createErrorResponse(
              'Missing authorization token',
              401,
              metadata
            );
          }
          // TODO: Implement actual JWT verification using supabase client
          // const { data: { user }, error } = await supabaseClient.auth.getUser(token);
          // if (error || !user) { ... }
        }

        // Log request start
        if (this.options.enableLogging) {
          console.log(`[${metadata.correlationId}] ${metadata.method} ${metadata.path} - Request received`);
        }

        // Call the handler function
        const response = await this.handlerFn(req, metadata);

        // Update metadata with response status
        metadata.status = response.status;
        metadata.processingTime = performance.now() - startTime;

        // Log response completion
        if (this.options.enableLogging) {
          console.log(`[${metadata.correlationId}] ${metadata.method} ${metadata.path} - Completed in ${metadata.processingTime.toFixed(2)}ms with status ${metadata.status}`);
        }

        // Add CORS and metrics headers
        const finalHeaders = new Headers(response.headers);
        if (this.options.enableCors) {
          Object.entries(corsHeaders).forEach(([key, value]) => {
            finalHeaders.set(key, value);
          });
        }
        if (this.options.enableMetrics) {
          finalHeaders.set('X-Correlation-ID', metadata.correlationId);
          finalHeaders.set('X-Processing-Time', `${metadata.processingTime.toFixed(2)}ms`);
        }

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: finalHeaders
        });

      } catch (error) {
        metadata.status = 500;
        metadata.processingTime = performance.now() - startTime;

        console.error(`[${metadata.correlationId}] Error in ${metadata.method} ${metadata.path}:`, error);

        // Log error to database
        await logProcessingEvent(
          `${metadata.path.substring(1).replace(/\//g, '_')}_error`, // Event type from path
          metadata.correlationId, // Use correlationId as entityId for errors
          metadata.correlationId,
          {
            error_message: error instanceof Error ? error.message : String(error),
            error_stack: error instanceof Error ? error.stack : undefined,
            request_method: metadata.method,
            request_path: metadata.path,
            user_agent: metadata.userAgent,
            ip_address: metadata.ipAddress
          },
          error instanceof Error ? error.message : 'Unknown server error'
        );

        return this.createErrorResponse(
          error instanceof Error ? error.message : 'Unknown server error',
          500,
          metadata,
          error instanceof Error ? error.stack : undefined
        );
      }
    };
  }

  private createErrorResponse(
    message: string,
    status: number,
    metadata: RequestMetadata,
    stack?: string
  ): Response {
    const errorResponse: ErrorResponse = {
      success: false,
      error: message,
      errorCode: `HTTP_${status}`,
      correlationId: metadata.correlationId,
      timestamp: new Date().toISOString(),
      stack: stack // Include stack trace in development?
    };

    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (this.options.enableCors) {
      Object.entries(corsHeaders).forEach(([key, value]) => {
        headers.set(key, value);
      });
    }
    if (this.options.enableMetrics) {
      headers.set('X-Correlation-ID', metadata.correlationId);
    }

    return new Response(JSON.stringify(errorResponse), { status, headers });
  }
}

// Helper function to create a handler instance
export function createHandler(handlerFn: HandlerFunction): HandlerBuilder {
  return new HandlerBuilder(handlerFn);
}

// Helper to create a standard success response
export function createSuccessResponse<T>(data: T, correlationId: string, status = 200): Response {
  const response: SuccessResponse<T> = {
    success: true,
    data,
    correlationId,
    timestamp: new Date().toISOString()
  };
  return new Response(JSON.stringify(response), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
