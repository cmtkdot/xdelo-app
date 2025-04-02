# Make Automation System Integration Points

This document describes how the Make Automation System integrates with other components of the application.

## Overview

The Make Automation System is designed to be a central hub for automation, connecting various parts of the application through event processing, webhooks, and custom actions.

## Integration Architecture

![Integration Architecture](./make-integration-architecture.png)

The Make Automation System interacts with various application components:

1. **Event Sources**: Generate events that trigger automations
2. **Processing Layer**: Evaluates conditions and executes actions
3. **Action Targets**: Receive actions and perform operations
4. **Storage & Logging**: Persists data and records activity

## Event Sources

### Telegram Bot

The Telegram Bot integration is a primary source of events for the Make Automation System.

#### Integration Points

- **Event Generation**: The Telegram bot generates events like `message_received`, `channel_joined`, etc.
- **Event Format**: Events include standardized metadata with Telegram-specific information
- **Connection Method**: Events are sent to the Make Automation System through direct function calls or webhooks

#### Implementation Details

```typescript
// In the Telegram bot message handler
async function handleTelegramMessage(message) {
  // Process message
  
  // Generate Make event
  const makeEvent = {
    event_type: 'message_received',
    timestamp: new Date().toISOString(),
    message: {
      id: message.message_id.toString(),
      text: message.text,
      chat: {
        id: message.chat.id.toString(),
        type: message.chat.type,
        title: message.chat.title
      },
      from: {
        id: message.from.id.toString(),
        username: message.from.username,
        first_name: message.from.first_name,
        last_name: message.from.last_name
      },
      date: message.date
    },
    metadata: {
      source: 'telegram',
      processing_id: uuidv4()
    }
  };
  
  // Send to Make system
  await processAutomationEvent(makeEvent);
}

// Function to process events through Make system
async function processAutomationEvent(event) {
  return await supabase.functions.invoke('make_rule_engine', {
    body: event
  });
}
```

### Media Processor

The Media Processor integration handles media files in the system and generates media-related events.

#### Integration Points

- **Event Generation**: The Media Processor generates events like `media_received`, `media_processed`, etc.
- **Event Format**: Events include media metadata, file information, and processing results
- **Connection Method**: Events are sent to the Make Automation System through direct function calls

#### Implementation Details

```typescript
// In the Media Processor
async function processMedia(mediaFile) {
  // Process media file
  const processedMedia = await performMediaProcessing(mediaFile);
  
  // Generate Make event
  const makeEvent = {
    event_type: 'media_processed',
    timestamp: new Date().toISOString(),
    media: {
      id: processedMedia.id,
      type: processedMedia.type,
      file_id: processedMedia.file_id,
      file_size: processedMedia.file_size,
      width: processedMedia.width,
      height: processedMedia.height,
      duration: processedMedia.duration,
      mime_type: processedMedia.mime_type
    },
    processing: {
      status: 'success',
      duration_ms: processedMedia.processing_time,
      features: processedMedia.detected_features
    },
    metadata: {
      source: 'media_processor',
      processing_id: uuidv4()
    }
  };
  
  // Send to Make system
  await processAutomationEvent(makeEvent);
}
```

### User Management System

The User Management System integration handles user-related events.

#### Integration Points

- **Event Generation**: The User Management System generates events like `user_joined`, `user_left`, etc.
- **Event Format**: Events include user information and relevant metadata
- **Connection Method**: Events are sent to the Make Automation System through database triggers or direct function calls

#### Implementation Details

```typescript
// In the User Management System
async function handleUserSignup(user) {
  // Create user in the system
  
  // Generate Make event
  const makeEvent = {
    event_type: 'user_joined',
    timestamp: new Date().toISOString(),
    user: {
      id: user.id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      language_code: user.language_code
    },
    metadata: {
      source: 'user_management',
      registration_method: user.registration_method
    }
  };
  
  // Send to Make system
  await processAutomationEvent(makeEvent);
}
```

## Action Targets

### Webhook Endpoints

The Make Automation System can send data to external webhook endpoints.

#### Integration Points

- **Action Type**: `forward_webhook` action type
- **Configuration**: URL, headers, payload transformation
- **Implementation**: HTTP requests to configured endpoints

#### Implementation Details

```typescript
// In the make_rule_engine edge function
async function executeForwardWebhookAction(action, payload) {
  const { url, headers = {}, method = 'POST' } = action.config;
  
  // Transform payload if needed
  let finalPayload = payload;
  if (action.config.transform) {
    finalPayload = transformPayload(payload, action.config.transform);
  }
  
  // Send to webhook endpoint
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(finalPayload)
    });
    
    return {
      success: response.ok,
      status: response.status,
      response: await response.text()
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
```

### Notification System

The Make Automation System can send notifications through the application's notification system.

#### Integration Points

- **Action Type**: `send_notification` action type
- **Configuration**: Message template, recipients, notification type
- **Implementation**: Integration with the application's notification service

#### Implementation Details

```typescript
// In the make_rule_engine edge function
async function executeSendNotificationAction(action, payload) {
  const { message, recipients, type = 'info' } = action.config;
  
  // Process message template
  const finalMessage = processTemplate(message, payload);
  
  // Determine recipients
  let finalRecipients = recipients;
  if (!finalRecipients) {
    // Default to message sender if available
    finalRecipients = payload.message?.from?.id ? [payload.message.from.id] : [];
  }
  
  // Send notification
  try {
    const { data, error } = await supabase.rpc('send_notification', {
      message: finalMessage,
      recipients: finalRecipients,
      notification_type: type
    });
    
    if (error) throw error;
    
    return {
      success: true,
      notification_id: data.id
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
```

### Storage System

The Make Automation System can store and manage files using the application's storage system.

#### Integration Points

- **Action Type**: `store_media` action type
- **Configuration**: Storage path, file transformations
- **Implementation**: Integration with Supabase Storage

#### Implementation Details

```typescript
// In the make_rule_engine edge function
async function executeStoreMediaAction(action, payload) {
  const { path, transformations } = action.config;
  
  // Get media URL from payload
  const mediaUrl = payload.media?.file_id
    ? `https://api.telegram.org/file/bot${botToken}/${payload.media.file_id}`
    : null;
  
  if (!mediaUrl) {
    return {
      success: false,
      error: 'No media URL found in payload'
    };
  }
  
  // Process path template
  const finalPath = processTemplate(path, payload);
  
  // Fetch media
  const mediaResponse = await fetch(mediaUrl);
  const mediaBuffer = await mediaResponse.arrayBuffer();
  
  // Apply transformations if needed
  let finalMedia = mediaBuffer;
  if (transformations) {
    finalMedia = await applyTransformations(mediaBuffer, transformations);
  }
  
  // Store in Supabase Storage
  try {
    const { data, error } = await supabase.storage
      .from('media')
      .upload(finalPath, finalMedia, {
        contentType: payload.media.mime_type
      });
    
    if (error) throw error;
    
    return {
      success: true,
      storage_path: data.path,
      url: data.publicUrl
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
```

## Database Integration

### Tables and Relations

The Make Automation System interacts with several database tables:

1. **make_automation_rules**: Stores automation rule definitions
2. **make_webhook_configs**: Contains webhook endpoint configurations
3. **make_event_logs**: Records event processing history
4. **make_test_payloads**: Stores test event data
5. **make_debug_sessions** and **make_debug_events**: Track debugging information

### Database Triggers

The system uses database triggers for certain operations:

1. **Updated Timestamp**: Updates `updated_at` columns automatically
2. **Event Logging**: Logs rule execution and webhook delivery results
3. **Real-time Events**: Notifies clients of changes via Supabase's real-time features

## REST API Integration

The Make Automation System exposes functionality through REST APIs implemented as Supabase Edge Functions:

### make_automation_manager

Manages automation rules with the following endpoints:

- **POST**: `/functions/v1/make_automation_manager`
- **Actions**: create, update, delete, list, get, toggle, reorder

### make_webhook_processor

Processes webhook events:

- **POST**: `/functions/v1/make_webhook_processor`
- **Purpose**: Receives events and forwards them to configured webhooks

### make_rule_engine

Processes events through automation rules:

- **POST**: `/functions/v1/make_rule_engine`
- **Purpose**: Evaluates conditions and executes actions based on events

## Frontend Integration

### React Components

The Make Automation System integrates with the frontend through React components:

1. **MakeAutomations**: Main page for the automation system
2. **AutomationList**: Lists and manages automation rules
3. **AutomationForm**: Creates and edits automation rules
4. **WebhookManager**: Configures webhook endpoints
5. **EventMonitor**: Monitors event processing history

### React Hooks

Custom React hooks provide data access and operations:

1. **useMakeAutomations**: Manages automation rules
2. **useMakeWebhooks**: Manages webhook configurations
3. **useMakeEventLogs**: Manages event logs

## Authentication and Authorization

### User Authentication

The Make Automation System relies on Supabase Authentication:

- **JWT Tokens**: Used for authenticating API requests
- **Role-Based Access**: Different permissions based on user roles

### API Authorization

The system uses row-level security (RLS) policies:

- **Read Access**: Authenticated users can view automation rules
- **Write Access**: Authenticated users can create and modify automation rules
- **Admin Access**: Admin users have additional privileges

## Extension Points

The Make Automation System provides several extension points:

### Custom Event Types

Add new event types by:

1. Updating the database schema (adding to the `make_event_type` enum)
2. Updating TypeScript types in `src/types/make.ts`
3. Implementing event generation in the relevant system component

### Custom Action Types

Add new action types by:

1. Updating TypeScript types in `src/types/make.ts`
2. Implementing action execution logic in the `make_rule_engine` edge function
3. Adding UI components for configuring the action

### Custom Condition Operators

Add new condition operators by:

1. Updating TypeScript types in `src/types/make.ts`
2. Implementing condition evaluation logic in the `make_rule_engine` edge function
3. Adding UI components for configuring the condition

## Integration Best Practices

When integrating with the Make Automation System:

1. **Standardized Events**: Follow established event format patterns
2. **Error Handling**: Implement proper error handling for all integrations
3. **Logging**: Include detailed logging for debugging purposes
4. **Performance**: Optimize for performance, especially for high-volume events
5. **Security**: Validate and sanitize all input data
6. **Testing**: Test integrations thoroughly with different scenarios
7. **Documentation**: Document all integration points and examples 