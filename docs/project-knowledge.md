# Project Knowledge & Edge Function Development Guide

This document outlines key shared utilities and provides a guide for developing new Supabase Edge Functions within this project, ensuring consistency and leveraging standardized patterns.

## Core Shared Utilities (`supabase/functions/_shared/`)

These utilities centralize common functionality:

1.  **`unifiedHandler.ts`**:

    - **Purpose**: Provides a standardized way to create HTTP request handlers for edge functions. It automatically handles CORS (preflight and response headers), basic request validation (allowed methods), correlation ID generation/propagation, standardized success/error response formatting, top-level error catching, and basic logging/metrics.
    - **Usage**:
      - Import `createHandler`, `createSuccessResponse`, `RequestMetadata`, and `SecurityLevel`.
      - Define your core logic in an `async function yourHandlerLogic(req: Request, metadata: RequestMetadata): Promise<Response>`.
      - `metadata` provides `correlationId`, `method`, `path`, etc.
      - Inside your logic, perform necessary checks (e.g., environment variables, request body parsing/validation). Throw `Error` objects for failures; `createHandler` will catch them, log them (using `logProcessingEvent`), and return a standardized JSON error response.
      - On success, use `createSuccessResponse(data, metadata.correlationId)` to return a standardized JSON success response. If you need to return a non-JSON response or a specific status code/headers (like a proxy), create and return a standard `Response` object directly.
      - Instantiate the handler: `const handler = createHandler(yourHandlerLogic)`.
      - Configure using builder methods:
        - `.withMethods(['POST', 'GET', ...])`: Specify allowed HTTP methods.
        - `.withSecurity(SecurityLevel.AUTHENTICATED | SecurityLevel.PUBLIC | SecurityLevel.SERVICE_ROLE)`: Define access level. `AUTHENTICATED` checks for a valid Supabase JWT (implementation might need verification/refinement in `unifiedHandler`). `SERVICE_ROLE` might imply a check for the service key if needed. `PUBLIC` performs no auth check.
        - `.withCors(true/false)`, `.withLogging(true/false)`, `.withMetrics(true/false)`: Toggle default behaviors (usually keep defaults).
      - Build and serve: `serve(handler.build());`.

2.  **`supabase.ts`**:

    - **Purpose**: Exports a singleton `supabaseClient` instance, pre-configured with the necessary Supabase URL and Service Role Key from environment variables.
    - **Usage**: Import `{ supabaseClient } from "../_shared/supabase.ts";` and use this client directly for all Supabase interactions (database, storage, functions invocation) within your edge functions. Do _not_ create new client instances within individual functions.

3.  **`consolidatedMessageUtils.ts`**:

    - **Purpose**: Contains various utility functions, notably `logProcessingEvent`.
    - **`logProcessingEvent` Usage**:
      - Import `{ logProcessingEvent } from "../_shared/consolidatedMessageUtils.ts";`.
      - Call it to log significant events or errors to the `unified_audit_logs` table:
        ```typescript
        await logProcessingEvent(
          'event_type_name', // e.g., 'user_login_success', 'file_upload_failed'
          entityId,         // ID of the relevant entity (e.g., messageId, userId, fileId) or 'system'
          correlationId,    // The correlation ID from handler metadata or generated for the operation
          { key: 'value', ... }, // Optional metadata object (JSONB)
          errorMessage      // Optional error message string
        );
        ```
    - Also contains helpers like `isMessageForwarded` and `constructTelegramMessageUrl`.

4.  **`cors.ts`**: Exports default CORS headers used by `unifiedHandler`.
5.  **`mediaUtils.ts` / `captionParsers.ts` / etc.**: Contain domain-specific reusable logic.

## Creating a New Request-Response Edge Function

1.  **Create Directory**: Create a new directory under `supabase/functions/`, e.g., `supabase/functions/my-new-function/`.
2.  **Create `index.ts`**: Inside the new directory, create `index.ts`.
3.  **Basic Template**:

    ```typescript
    import { serve } from "https://deno.land/std@0.168.0/http/server.ts"; // Or use mapped import "std/http/server.ts" if import_map is configured
    import {
      createHandler,
      createSuccessResponse,
      RequestMetadata,
      SecurityLevel,
    } from "../_shared/unifiedHandler.ts";
    import { supabaseClient } from "../_shared/supabase.ts";
    import { logProcessingEvent } from "../_shared/consolidatedMessageUtils.ts";

    // Define expected request body if applicable
    interface MyRequestBody {
      parameter1: string;
      // ... other parameters
    }

    // Core logic for the function
    async function handleMyNewFunction(
      req: Request,
      metadata: RequestMetadata
    ): Promise<Response> {
      const { correlationId } = metadata;
      console.log(`[${correlationId}] Processing my-new-function request`);

      // 1. Check Environment Variables (if needed)
      const MY_API_KEY = Deno.env.get("MY_API_KEY");
      if (!MY_API_KEY) {
        console.error(`[${correlationId}] MY_API_KEY not set`);
        // Log critical config error before throwing
        await logProcessingEvent(
          "config_error",
          "system",
          correlationId,
          { missing: "MY_API_KEY" },
          "MY_API_KEY not configured"
        );
        throw new Error("Configuration error: MY_API_KEY is missing.");
      }

      // 2. Parse and Validate Request Body (if applicable)
      let requestBody: MyRequestBody;
      try {
        requestBody = await req.json();
      } catch (parseError: unknown) {
        const errorMessage =
          parseError instanceof Error
            ? parseError.message
            : "Invalid JSON body";
        console.error(
          `[${correlationId}] Failed to parse request body: ${errorMessage}`
        );
        // No need to log here, unifiedHandler will catch and log the thrown error
        throw new Error(`Invalid request: ${errorMessage}`);
      }

      const { parameter1 } = requestBody;
      if (!parameter1) {
        console.error(
          `[${correlationId}] Missing required parameter 'parameter1'`
        );
        // No need to log here, unifiedHandler will catch and log the thrown error
        throw new Error("Invalid request: 'parameter1' is required.");
      }

      await logProcessingEvent(
        "my_function_started",
        parameter1,
        correlationId,
        { param1: parameter1 }
      );

      try {
        // 3. Perform Core Logic (e.g., DB operations, API calls)
        console.log(
          `[${correlationId}] Performing action with param: ${parameter1}`
        );

        // Example DB query
        const { data, error: dbError } = await supabaseClient
          .from("your_table")
          .select("*")
          .eq("some_column", parameter1)
          .limit(1);

        if (dbError) {
          // Log specific DB error before throwing
          await logProcessingEvent(
            "my_function_db_error",
            parameter1,
            correlationId,
            { stage: "fetch_data" },
            dbError.message
          );
          throw new Error(`Database error: ${dbError.message}`);
        }

        // Example external API call
        // const apiResponse = await fetch(...);
        // if (!apiResponse.ok) { ... throw new Error(...) }
        // const apiData = await apiResponse.json();

        // 4. Prepare Success Data
        const resultData = {
          message: "Action completed successfully",
          details: data, // Or apiData, etc.
        };

        await logProcessingEvent(
          "my_function_completed",
          parameter1,
          correlationId,
          { resultCount: data?.length ?? 0 }
        );

        // 5. Return Success Response
        return createSuccessResponse(resultData, correlationId);
      } catch (error: unknown) {
        // Catch errors thrown during core logic
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Unknown error during processing";
        // Log if not already logged (e.g., if it wasn't a DB error logged above)
        if (!errorMessage.startsWith("Database error:")) {
          console.error(
            `[${correlationId}] Error during my-new-function processing: ${errorMessage}`
          );
          await logProcessingEvent(
            "my_function_failed",
            parameter1 || "unknown",
            correlationId,
            {},
            errorMessage
          );
        }
        throw error; // Re-throw for unifiedHandler to format the final response
      }
    }

    // --- Server Setup ---
    const handler = createHandler(handleMyNewFunction)
      .withMethods(["POST"]) // Or ['GET'], ['POST', 'GET'], etc.
      .withSecurity(SecurityLevel.AUTHENTICATED) // Or .PUBLIC, .SERVICE_ROLE
      .build();

    serve(handler);

    console.log("my-new-function deployed and listening.");
    ```

4.  **Add `deno.json` / `config.toml`**: If the function needs specific Deno permissions or environment variables mapped, add `deno.json` and/or `config.toml` files to the function's directory, similar to other functions.
5.  **Deploy**: Use the Supabase CLI to deploy the new function (`supabase functions deploy my-new-function`).

## Key Principles

- **Use Shared Client**: Always import and use `supabaseClient` from `_shared/supabase.ts`.
- **Use Unified Handler**: Wrap your core logic with `createHandler` for request-response functions.
- **Use Standard Logging**: Use `logProcessingEvent` for important events and errors.
- **Throw Errors**: Let `unifiedHandler` catch errors by throwing `Error` objects. Log specific details using `logProcessingEvent` _before_ throwing if extra context is needed.
- **Standard Responses**: Use `createSuccessResponse` for standard JSON success responses. Return `Response` directly for proxying or custom responses. `unifiedHandler` creates error responses automatically.
- **Configuration**: Use `Deno.env.get()` to access environment variables. Check for required variables early.
