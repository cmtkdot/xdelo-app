# Make Automation System Edge Functions

This document provides detailed information about the Supabase Edge Functions that power the Make Automation System.

## Overview

The Make Automation System uses Supabase Edge Functions to provide API endpoints for managing automation rules, processing webhooks, and handling events. These functions are deployed as serverless functions that run at the edge, providing low-latency access to the database.

## make_automation_manager

The primary edge function for managing automation rules.

### Location
`supabase/functions/make_automation_manager/index.ts`

### Endpoint
`https://[YOUR_SUPABASE_URL]/functions/v1/make_automation_manager`

### Authentication
Requires a Supabase JWT token in the `Authorization` header.

### Parameters
The function expects a JSON object with an `action` parameter that determines the operation:

```json
{
  "action": "create|update|delete|list|get|toggle|reorder",
  // Additional parameters based on the action
}
```

### Actions

#### create
Creates a new automation rule.

**Parameters:**
```json
{
  "action": "create",
  "name": "Rule name",
  "description": "Rule description",
  "event_type": "message_received", // Must be a valid make_event_type
  "conditions": [
    {
      "field": "message.text",
      "operator": "contains",
      "value": "keyword"
    }
  ],
  "actions": [
    {
      "type": "forward_webhook",
      "config": {
        "url": "https://example.com/webhook"
      }
    }
  ],
  "is_active": true,
  "priority": 0
}
```

**Response:**
```json
{
  "success": true,
  "rule": {
    "id": "uuid",
    "name": "Rule name",
    // ... other fields
  }
}
```

#### update
Updates an existing automation rule.

**Parameters:**
```json
{
  "action": "update",
  "id": "rule-uuid",
  "name": "Updated name",
  // Any other fields to update
}
```

**Response:**
```json
{
  "success": true,
  "rule": {
    "id": "uuid",
    "name": "Updated name",
    // ... other fields
  }
}
```

#### delete
Deletes an automation rule.

**Parameters:**
```json
{
  "action": "delete",
  "id": "rule-uuid"
}
```

**Response:**
```json
{
  "success": true
}
```

#### list
Lists automation rules, optionally filtered by event type or active status.

**Parameters:**
```json
{
  "action": "list",
  "event_type": "message_received", // Optional
  "is_active": true // Optional
}
```

**Response:**
```json
{
  "success": true,
  "rules": [
    {
      "id": "uuid",
      "name": "Rule name",
      // ... other fields
    },
    // ... more rules
  ]
}
```

#### get
Gets a specific automation rule by ID.

**Parameters:**
```json
{
  "action": "get",
  "id": "rule-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "rule": {
    "id": "uuid",
    "name": "Rule name",
    // ... other fields
  }
}
```

#### toggle
Toggles the active state of an automation rule.

**Parameters:**
```json
{
  "action": "toggle",
  "id": "rule-uuid",
  "is_active": true
}
```

**Response:**
```json
{
  "success": true,
  "rule": {
    "id": "uuid",
    "is_active": true,
    // ... other fields
  }
}
```

#### reorder
Reorders automation rules by priority.

**Parameters:**
```json
{
  "action": "reorder",
  "rules": [
    { "id": "rule-uuid-1", "priority": 2 },
    { "id": "rule-uuid-2", "priority": 1 },
    { "id": "rule-uuid-3", "priority": 0 }
  ]
}
```

**Response:**
```json
{
  "success": true
}
```

### Error Handling

The function returns appropriate HTTP status codes for different error scenarios:

- `400 Bad Request`: Missing or invalid parameters
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Database or other server errors

Error responses include a detailed message:

```json
{
  "success": false,
  "error": "Error message"
}
```

### Implementation Details

The function uses the Supabase client to interact with the database:

```typescript
const supabase = createClient(supabaseUrl, supabaseKey);
```

It processes the request based on the action parameter:

```typescript
switch (action) {
  case "create":
    return await createRule(requestData);
  case "update":
    return await updateRule(requestData);
  // ... other actions
}
```

Each action is implemented as a separate function that validates input, performs database operations, and returns the appropriate response.

## make_webhook_processor

Processes webhook events for the Make Automation System.

### Location
`supabase/functions/make_webhook_processor/index.ts`

### Endpoint
`https://[YOUR_SUPABASE_URL]/functions/v1/make_webhook_processor`

### Authentication
Requires a Supabase JWT token or a webhook secret in the `X-Webhook-Secret` header.

### Parameters
The function expects a JSON object containing the event payload:

```json
{
  "event_type": "message_received",
  "data": {
    // Event-specific data
  }
}
```

### Processing Flow

1. Validate the incoming event payload
2. Find active webhooks that match the event type
3. For each matching webhook:
   - Apply field selection if configured
   - Apply payload template if configured
   - Apply transformation code if configured
   - Send the processed payload to the webhook URL
   - Record the result in the event log

### Response
```json
{
  "success": true,
  "processed": 3, // Number of webhooks processed
  "event_id": "uuid" // ID of the recorded event
}
```

### Error Handling
Similar to the `make_automation_manager` function, with additional logging for webhook delivery errors.

## make_rule_engine

Processes events through automation rules.

### Location
`supabase/functions/make_rule_engine/index.ts`

### Endpoint
`https://[YOUR_SUPABASE_URL]/functions/v1/make_rule_engine`

### Authentication
Requires a Supabase JWT token or a webhook secret in the `X-Webhook-Secret` header.

### Parameters
The function expects a JSON object containing the event payload:

```json
{
  "event_type": "message_received",
  "data": {
    // Event-specific data
  }
}
```

### Processing Flow

1. Validate the incoming event payload
2. Find active automation rules that match the event type, ordered by priority
3. For each matching rule:
   - Evaluate conditions against the payload
   - If conditions are met, execute the rule's actions
   - Record the result in the event log

### Response
```json
{
  "success": true,
  "rules_processed": 5, // Number of rules processed
  "actions_executed": 3, // Number of actions executed
  "event_id": "uuid" // ID of the recorded event
}
```

### Error Handling
Similar to other edge functions, with additional logging for rule execution errors.

## Development Guidelines

When extending or modifying the Make Automation System edge functions:

### Environment Variables

The functions use the following environment variables:
- `SUPABASE_URL`: The URL of your Supabase project
- `SUPABASE_SERVICE_ROLE_KEY`: The service role key for database access
- `WEBHOOK_SECRET`: A secret key for webhook authentication

### Adding New Actions

To add a new action type to the system:

1. Update the TypeScript types in `src/types/make.ts`
2. Add validation logic in the `make_rule_engine` function
3. Implement the action handler in the rule execution logic
4. Update client-side components to support the new action type
5. Add tests for the new action type

### Debugging

The edge functions include logging statements that can be viewed in the Supabase dashboard:

```typescript
console.error("Error handling automation rule request:", error);
```

For local development, use the Supabase CLI to run the functions locally:

```bash
supabase functions serve --env-file .env.local
```

## Deployment

Deploy the edge functions using the Supabase CLI:

```bash
supabase functions deploy make_automation_manager
supabase functions deploy make_webhook_processor
supabase functions deploy make_rule_engine
```

## Security Considerations

The Make Automation System edge functions implement several security measures:

1. **Authentication**: Requires valid JWT tokens or webhook secrets
2. **Input Validation**: Validates all input parameters before processing
3. **Error Handling**: Prevents leaking sensitive information in error messages
4. **Rate Limiting**: Uses Supabase's built-in rate limiting for edge functions
5. **CORS**: Configures appropriate CORS headers to prevent unauthorized access

## Performance Considerations

The edge functions are designed for optimal performance:

1. **Minimizing Database Queries**: Uses efficient queries with proper indexes
2. **Payload Size**: Limits the size of payloads to prevent performance issues
3. **Concurrent Processing**: Processes webhooks and rules concurrently where possible
4. **Caching**: Uses response caching for frequent operations where appropriate 