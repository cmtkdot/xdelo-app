# Make Automation System

The Make Automation System is a powerful, flexible framework for creating and managing automation workflows within the application. It allows users to define triggers, conditions, and actions that respond to various events in the system.

## Table of Contents

1. [System Overview](#system-overview)
2. [Database Schema](#database-schema)
3. [Components](#components)
4. [Event Types](#event-types)
5. [Integration Points](#integration-points)
6. [Edge Functions](#edge-functions)
7. [Development Guidelines](#development-guidelines)
8. [Troubleshooting](#troubleshooting)

## System Overview

The Make Automation System consists of several key components:

- **Automation Rules**: Define triggers, conditions, and actions to automate responses to events
- **Webhooks**: Configure external endpoints to receive event data
- **Event Logs**: Track and monitor event processing history
- **Test Payloads**: Create sample data for testing automation rules
- **Debug Tools**: Monitor and troubleshoot the automation system

![Make System Architecture](./make-system-architecture.png)

## Database Schema

The system uses several tables in the Supabase database:

- `make_automation_rules`: Stores automation rule definitions
- `make_webhook_configs`: Contains webhook endpoint configurations
- `make_event_logs`: Records event processing history
- `make_test_payloads`: Stores test event data
- `make_debug_sessions` and `make_debug_events`: Track debugging information

For detailed schema information, see [Make Database Schema](./make-database-schema.md).

## Components

The frontend implementation consists of several React components:

- **MakeAutomations**: Main page for the automation system
- **AutomationList**: Displays and manages automation rules
- **AutomationForm**: Creates and edits automation rules
- **WebhookManager**: Configures and manages webhooks
- **EventMonitor**: Monitors event processing history

For component details, see [Make Components Documentation](./make-components-documentation.md).

## Event Types

The system supports the following event types:

- `message_received`: Triggered when a new message is received
- `channel_joined`: Triggered when a user joins a channel
- `channel_left`: Triggered when a user leaves a channel
- `user_joined`: Triggered when a new user joins
- `user_left`: Triggered when a user leaves
- `media_received`: Triggered when media is received
- `command_received`: Triggered when a command is received

For details on event types and payloads, see [Make Event Types](./make-event-types.md).

## Integration Points

The Make Automation System integrates with several parts of the application:

- **Telegram Bot**: Processes incoming messages and media
- **Media Storage**: Manages and processes media files
- **User System**: Handles user-related events
- **External Services**: Communicates with third-party APIs

For integration details, see [Make Integration Points](./make-integration-points.md).

## Edge Functions

The system uses Supabase Edge Functions to process and manage automations:

- `make_automation_manager`: Manages automation rules
- `make_webhook_processor`: Processes webhook events
- `make_event_scheduler`: Schedules delayed events

For edge function details, see [Make Edge Functions](./make-edge-functions.md).

## Development Guidelines

When extending or modifying the Make Automation System:

1. Always follow the established patterns for creating new event types
2. Add appropriate validation for new conditions and actions
3. Document all changes to the database schema
4. Include test cases for new automation features
5. Update typings when adding new fields or capabilities

For detailed development guidelines, see [Make Development Guidelines](./make-development-guidelines.md).

## Troubleshooting

Common issues and their solutions:

- **Rules not triggering**: Check event types and conditions
- **Webhook errors**: Verify endpoint URL and connectivity
- **Performance issues**: Review automation complexity and database indexes
- **Data validation errors**: Check payload structure against expected schema

For a comprehensive troubleshooting guide, see [Make Troubleshooting](./make-troubleshooting.md). 