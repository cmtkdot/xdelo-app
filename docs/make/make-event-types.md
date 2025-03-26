# Make Automation System Event Types

This document provides detailed information about the event types and payloads in the Make Automation System.

## Event Type Overview

The Make Automation System processes various event types that trigger automation rules and webhooks. Each event type has a specific structure and payload format.

## Supported Event Types

### message_received

Triggered when a new message is received from a user or channel.

#### Payload Structure

```json
{
  "event_type": "message_received",
  "timestamp": "2024-03-21T12:34:56.789Z",
  "message": {
    "id": "123456789",
    "text": "Hello, world!",
    "chat": {
      "id": "987654321",
      "type": "private|group|channel",
      "title": "Chat Title"
    },
    "from": {
      "id": "12345",
      "username": "user123",
      "first_name": "John",
      "last_name": "Doe"
    },
    "date": 1616176896,
    "reply_to_message_id": null,
    "is_outgoing": false
  },
  "metadata": {
    "source": "telegram",
    "processing_id": "uuid"
  }
}
```

#### Common Use Cases

- Forward specific messages to external systems
- Send automated responses based on message content
- Log message statistics

### channel_joined

Triggered when a user joins a channel.

#### Payload Structure

```json
{
  "event_type": "channel_joined",
  "timestamp": "2024-03-21T12:34:56.789Z",
  "channel": {
    "id": "987654321",
    "title": "Channel Title",
    "type": "channel",
    "member_count": 123
  },
  "user": {
    "id": "12345",
    "username": "user123",
    "first_name": "John",
    "last_name": "Doe"
  },
  "metadata": {
    "source": "telegram",
    "invited_by": {
      "id": "54321",
      "username": "admin456"
    }
  }
}
```

#### Common Use Cases

- Send welcome messages to new members
- Update member statistics
- Trigger onboarding workflows

### channel_left

Triggered when a user leaves a channel.

#### Payload Structure

```json
{
  "event_type": "channel_left",
  "timestamp": "2024-03-21T12:34:56.789Z",
  "channel": {
    "id": "987654321",
    "title": "Channel Title",
    "type": "channel",
    "member_count": 122
  },
  "user": {
    "id": "12345",
    "username": "user123",
    "first_name": "John",
    "last_name": "Doe"
  },
  "metadata": {
    "source": "telegram",
    "reason": "left|kicked|banned",
    "kicked_by": {
      "id": "54321",
      "username": "admin456"
    }
  }
}
```

#### Common Use Cases

- Update member statistics
- Monitor channel activity
- Track user retention

### user_joined

Triggered when a new user joins the system.

#### Payload Structure

```json
{
  "event_type": "user_joined",
  "timestamp": "2024-03-21T12:34:56.789Z",
  "user": {
    "id": "12345",
    "username": "user123",
    "first_name": "John",
    "last_name": "Doe",
    "language_code": "en"
  },
  "metadata": {
    "source": "telegram",
    "registration_method": "direct|invitation|channel",
    "referring_user_id": "54321"
  }
}
```

#### Common Use Cases

- Send welcome messages
- Create user profiles in external systems
- Trigger user onboarding workflows

### user_left

Triggered when a user leaves the system.

#### Payload Structure

```json
{
  "event_type": "user_left",
  "timestamp": "2024-03-21T12:34:56.789Z",
  "user": {
    "id": "12345",
    "username": "user123",
    "first_name": "John",
    "last_name": "Doe"
  },
  "metadata": {
    "source": "telegram",
    "reason": "self_deleted|banned|inactive",
    "duration_days": 95
  }
}
```

#### Common Use Cases

- Clean up user data
- Update user statistics
- Track user churn

### media_received

Triggered when media content is received.

#### Payload Structure

```json
{
  "event_type": "media_received",
  "timestamp": "2024-03-21T12:34:56.789Z",
  "media": {
    "id": "media123456",
    "type": "photo|video|audio|document|sticker",
    "file_id": "ABCdef123456",
    "file_unique_id": "def123456",
    "file_size": 1024000,
    "width": 1280,
    "height": 720,
    "duration": 30,
    "mime_type": "image/jpeg",
    "thumbnail": {
      "file_id": "thumb123456",
      "width": 320,
      "height": 180,
      "file_size": 12400
    }
  },
  "message": {
    "id": "123456789",
    "chat": {
      "id": "987654321",
      "type": "private|group|channel"
    },
    "from": {
      "id": "12345",
      "username": "user123"
    },
    "caption": "Check out this photo!",
    "date": 1616176896
  },
  "metadata": {
    "source": "telegram",
    "processing_id": "uuid",
    "storage_path": "media/telegram/12345/photo123456.jpg"
  }
}
```

#### Common Use Cases

- Process and analyze media content
- Store media in external systems
- Generate thumbnails or transformations
- Extract metadata from images or videos

### command_received

Triggered when a command is received.

#### Payload Structure

```json
{
  "event_type": "command_received",
  "timestamp": "2024-03-21T12:34:56.789Z",
  "command": {
    "name": "start",
    "args": "param1 param2",
    "full_text": "/start param1 param2"
  },
  "message": {
    "id": "123456789",
    "chat": {
      "id": "987654321",
      "type": "private|group|channel"
    },
    "from": {
      "id": "12345",
      "username": "user123",
      "first_name": "John",
      "last_name": "Doe"
    },
    "date": 1616176896
  },
  "metadata": {
    "source": "telegram",
    "processing_id": "uuid"
  }
}
```

#### Common Use Cases

- Execute specific workflows based on commands
- Provide interactive help or documentation
- Control bot behavior dynamically

## Event Processing

### Condition Evaluation

When automations process events, they evaluate conditions against the event payload. The condition includes a field path, an operator, and a value to compare against.

Field paths use dot notation to access nested properties:

- `message.text`: Text content of a message
- `message.from.id`: User ID of the sender
- `media.type`: Type of media received
- `command.name`: Name of the command received

### Action Execution

Based on evaluated conditions, automation rules execute defined actions:

- `forward_webhook`: Forward the event to an external webhook URL
- `send_notification`: Send a notification message
- `modify_data`: Modify event data before further processing
- `store_media`: Store media in a specific location
- `transform_message`: Transform the message into a different format

## Custom Event Types

The Make Automation System can be extended with custom event types. To add a custom event type:

1. Define the event type in the database schema:
   ```sql
   ALTER TYPE make_event_type ADD VALUE 'custom_event_name';
   ```

2. Update the TypeScript types:
   ```typescript
   export enum MakeEventType {
     // Existing types...
     CustomEventName = 'custom_event_name'
   }
   ```

3. Document the payload structure and use cases
4. Implement event generation in the appropriate part of the application
5. Test the event processing with automation rules and webhooks

## Event Security Considerations

When working with events in the Make Automation System:

1. **Validate Payloads**: Always validate incoming event payloads against expected schemas
2. **Sanitize Data**: Sanitize user-provided data before processing
3. **Authentication**: Ensure proper authentication for event generation and processing
4. **Rate Limiting**: Implement rate limiting to prevent abuse
5. **Data Privacy**: Be mindful of personally identifiable information (PII) in event payloads

## Testing Event Processing

To test event processing:

1. Use the test payloads feature in the Make Automation System
2. Create sample payloads for different event types
3. Send test events to automation rules and webhooks
4. Monitor the event logs for processing results 