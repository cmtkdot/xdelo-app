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
