# Make Automation System Components

This document provides detailed information about the React components used in the Make Automation System.

## Component Architecture

The Make Automation System frontend consists of several interconnected React components:

![Component Architecture](./make-component-architecture.png)

## MakeAutomations

The main page component that serves as the container for the Make automation system.

### Location
`src/pages/MakeAutomations.tsx`

### State
- `activeTab`: Manages the currently active tab (automations, webhooks, events)
- `isDialogOpen`: Controls the visibility of the create/edit dialog
- `currentRule`: Holds the automation rule being edited (null for new rules)

### Props
None (page component)

### Example Usage
```tsx
// Accessed via router at path "/make"
<Route path="/make" element={<MakeAutomations />} />
```

### Key Functions
- `handleCreateAutomation()`: Opens dialog for creating a new automation
- `handleEditAutomation(rule)`: Opens dialog for editing an existing automation
- `handleTabChange(value)`: Changes the active tab
- `handleCloseDialog()`: Closes the create/edit dialog

## AutomationList

Displays and manages the list of automation rules, with support for reordering, toggling, editing, and deleting.

### Location
`src/components/make/AutomationList.tsx`

### Props
```tsx
interface AutomationListProps {
  onEditRule?: (rule: MakeAutomationRule) => void;
}
```

### State
- `rules`: Local state for managing rules, used for optimistic updates during reordering
- `isLoading`: Loading state from the useAutomationRules hook

### Example Usage
```tsx
<AutomationList onEditRule={handleEditAutomation} />
```

### Key Functions
- `handleToggleRule(id, isActive)`: Toggles a rule's active state
- `handleDeleteRule(id)`: Deletes a rule after confirmation
- `handleEditRule(rule)`: Invokes the onEditRule callback with the rule to edit
- `handleMovePriority(id, direction)`: Moves a rule up or down in priority
- `handleDragEnd(result)`: Handles drag-and-drop reordering of rules

## AutomationForm

A form component for creating and editing automation rules, supporting conditions and actions.

### Location
`src/components/make/AutomationForm.tsx`

### Props
```tsx
interface AutomationFormProps {
  rule: MakeAutomationRule | null;
  onClose: () => void;
}
```

### State
- `formState`: Complex state object containing all form fields including conditions and actions

### Example Usage
```tsx
<AutomationForm 
  rule={currentRule} 
  onClose={handleCloseDialog} 
/>
```

### Key Functions
- `handleInputChange(field, value)`: Updates basic form fields
- `handleAddCondition()`: Adds a new condition to the rule
- `handleRemoveCondition(index)`: Removes a condition at the specified index
- `handleConditionChange(index, field, value)`: Updates a specific condition field
- `handleAddAction()`: Adds a new action to the rule
- `handleRemoveAction(index)`: Removes an action at the specified index
- `handleActionChange(index, field, value)`: Updates a specific action field
- `handleActionConfigChange(index, field, value)`: Updates configuration for a specific action
- `handleSubmit(e)`: Processes form submission for creating or updating a rule

### Form Constants
- `CONDITION_OPERATORS`: Supported condition operators (equals, contains, etc.)
- `ACTION_TYPES`: Supported action types (forward_webhook, send_notification, etc.)
- `FIELD_OPTIONS`: Available fields for conditions (message.text, message.chat.id, etc.)

## WebhookManager

Manages webhook configurations for receiving event data from the system.

### Location
`src/components/make/WebhookManager.tsx`

### Props
None

### State
- `formState`: State for the webhook creation/editing form
- `activeTab`: Manages the active tab in the webhook dialog
- `editingId`: ID of the webhook being edited (null for new webhooks)
- `isDialogOpen`: Controls the visibility of the create/edit dialog
- `isAdvancedDialogOpen`: Controls the visibility of the advanced settings dialog
- `selectedWebhook`: The webhook selected for advanced configuration

### Key Functions
- `handleCreateOrUpdate()`: Creates or updates a webhook configuration
- `handleEdit(webhook)`: Opens the edit dialog for a webhook
- `handleToggle(id, isActive)`: Toggles a webhook's active state
- `handleDelete(id)`: Deletes a webhook after confirmation
- `handleTest(id)`: Tests a webhook by sending a test payload
- `openAdvancedSettings(webhook)`: Opens the advanced settings dialog for a webhook
- `handleSaveAdvancedSettings()`: Saves advanced webhook settings

## EventMonitor

Displays and manages event logs for monitoring automation system activity.

### Location
`src/components/make/EventMonitor.tsx`

### Props
None

### State
- `selectedEventType`: Filters events by type
- `selectedStatus`: Filters events by status
- `currentEvent`: The event selected for detailed view
- `isDialogOpen`: Controls the visibility of the event details dialog

### Key Functions
- `handleViewEventDetails(event)`: Opens the details dialog for an event
- `handleClearLogs()`: Clears event logs after confirmation
- `handleRetryEvent(eventId)`: Retries a failed event
- `downloadEventAsJson(event)`: Downloads event data as a JSON file

## Shared UI Components

The Make Automation System uses several shared UI components from the application:

- `Card` components for content containers
- `Dialog` components for modals
- `Tabs` components for tabbed interfaces
- `Button` components for interactive elements
- `Switch` components for toggles
- `Badge` components for status indicators
- `Select` components for dropdown menus
- `Input` and `Textarea` components for form inputs
- `DropdownMenu` components for context menus

## Custom Hooks

### useMakeAutomations

Provides data fetching and mutation functions for automation rules.

#### Location
`src/hooks/useMakeAutomations.ts`

#### Returned Functions
- `useAutomationRules()`: Fetches all automation rules
- `useAutomationRulesByEventType(eventType)`: Fetches rules filtered by event type
- `createAutomationRule(rule)`: Creates a new automation rule
- `updateAutomationRule(rule)`: Updates an existing automation rule
- `toggleAutomationRule({ id, isActive })`: Toggles a rule's active state
- `deleteAutomationRule(id)`: Deletes an automation rule
- `reorderAutomationRules(ruleIds)`: Reorders automation rules by priority

### useMakeWebhooks

Provides data fetching and mutation functions for webhook configurations.

#### Location
`src/hooks/useMakeWebhooks.ts`

#### Returned Functions
- `useWebhooks()`: Fetches all webhook configurations
- `createWebhook(webhook)`: Creates a new webhook configuration
- `updateWebhook(webhook)`: Updates an existing webhook configuration
- `toggleWebhook({ id, isActive })`: Toggles a webhook's active state
- `deleteWebhook(id)`: Deletes a webhook configuration
- `testWebhook({ id })`: Tests a webhook by sending a test payload

### useMakeEventLogs

Provides data fetching and mutation functions for event logs.

#### Location
`src/hooks/useMakeEventLogs.ts`

#### Returned Functions
- `useEventLogs(params)`: Fetches event logs with optional filtering
- `useEventStatusSummary()`: Fetches a summary of event statuses
- `retryFailedEvent(eventId)`: Retries a failed event
- `clearEventLogs(params)`: Clears event logs with optional filtering

## Type Definitions

The Make Automation System uses TypeScript interfaces for type safety:

### Location
`src/types/make.ts`

### Key Types
- `MakeEventType`: Enum of supported event types
- `MakeCondition`: Interface for condition objects
- `MakeAction`: Interface for action objects
- `MakeAutomationRule`: Interface for automation rule objects
- `MakeWebhookConfig`: Interface for webhook configuration objects
- `MakeWebhookLog`: Interface for event log objects
- `MakeDebugSession` and `MakeDebugEvent`: Interfaces for debugging objects
- `MakeTestPayload`: Interface for test payload objects

## Styling

The Make Automation System uses Tailwind CSS for styling, with consistent design patterns:

- Cards for content containers
- Responsive grid layouts
- Consistent spacing with `space-y-4` utility
- Badge colors that reflect status (active, inactive, success, error)
- Consistent button variants (primary, outline, ghost)
- Responsive design with mobile-first approach

## Component Extension

When extending the Make Automation System with new components:

1. Follow the existing component patterns and naming conventions
2. Use the shared UI components for consistency
3. Implement proper TypeScript types
4. Add appropriate documentation
5. Ensure responsive design with Tailwind CSS
6. Test on multiple screen sizes

## Component Flow

1. User navigates to `/make` which loads the `MakeAutomations` page
2. `MakeAutomations` renders tabs for Automations, Webhooks, and Event Log
3. Based on the active tab, it displays `AutomationList`, `WebhookManager`, or `EventMonitor`
4. When creating or editing a rule, it opens a dialog with `AutomationForm`
5. `AutomationForm` handles form submission using the `useMakeAutomations` hook
6. On successful submission, the list is refreshed to show the updated data 