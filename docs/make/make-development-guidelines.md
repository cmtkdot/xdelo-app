# Make Automation System Development Guidelines

This document provides guidelines and best practices for developing and extending the Make Automation System.

## Table of Contents

1. [Development Environment Setup](#development-environment-setup)
2. [Code Organization](#code-organization)
3. [TypeScript Best Practices](#typescript-best-practices)
4. [Adding New Event Types](#adding-new-event-types)
5. [Adding New Condition Operators](#adding-new-condition-operators)
6. [Adding New Action Types](#adding-new-action-types)
7. [Frontend Component Development](#frontend-component-development)
8. [Edge Function Development](#edge-function-development)
9. [Database Schema Changes](#database-schema-changes)
10. [Testing Strategy](#testing-strategy)
11. [Security Guidelines](#security-guidelines)
12. [Performance Considerations](#performance-considerations)

## Development Environment Setup

### Prerequisites

- Node.js 18 or higher
- Supabase CLI
- PostgreSQL (for local development)
- TypeScript 5.0 or higher

### Local Development Setup

1. Clone the repository
   ```bash
   git clone https://github.com/your-organization/xdelo-app.git
   cd xdelo-app
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Set up local Supabase
   ```bash
   supabase init
   supabase start
   ```

4. Apply migrations
   ```bash
   supabase db reset
   ```

5. Start the development server
   ```bash
   npm run dev
   ```

## Code Organization

The Make Automation System code is organized as follows:

### Frontend Structure

- `src/pages/MakeAutomations.tsx`: Main page component
- `src/components/make/`: Make-specific components
  - `AutomationList.tsx`: List of automation rules
  - `AutomationForm.tsx`: Form for creating/editing rules
  - `WebhookManager.tsx`: Webhook configuration manager
  - `EventMonitor.tsx`: Event log viewer
- `src/hooks/`: Custom React hooks
  - `useMakeAutomations.ts`: Automation rule operations
  - `useMakeWebhooks.ts`: Webhook operations
  - `useMakeEventLogs.ts`: Event log operations
- `src/types/make.ts`: TypeScript definitions

### Backend Structure

- `supabase/functions/`: Edge functions
  - `make_automation_manager/`: Automation rule management
  - `make_webhook_processor/`: Webhook processing
  - `make_rule_engine/`: Rule execution engine
- `supabase/migrations/`: Database migrations
  - `20240320_make_automation_schema.sql`: Initial schema

## TypeScript Best Practices

### Type Definitions

Always define and use TypeScript interfaces for all data structures:

```typescript
// Good
interface MakeCondition {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith';
  value: string | number | boolean;
}

// Avoid
const condition = {
  field: "message.text",
  operator: "contains",
  value: "hello"
};
```

### Enum Usage

Use TypeScript enums for fixed sets of values:

```typescript
export enum MakeEventType {
  MessageReceived = 'message_received',
  ChannelJoined = 'channel_joined',
  // ...
}

// Use with type safety
function handleEvent(type: MakeEventType) {
  // ...
}
```

### Discriminated Unions

Use discriminated unions for complex type hierarchies:

```typescript
type MakeActionBase = {
  type: string;
};

type ForwardWebhookAction = MakeActionBase & {
  type: 'forward_webhook';
  config: {
    url: string;
    headers?: Record<string, string>;
  };
};

type SendNotificationAction = MakeActionBase & {
  type: 'send_notification';
  config: {
    message: string;
  };
};

type MakeAction = ForwardWebhookAction | SendNotificationAction;

// Type-safe usage
function executeAction(action: MakeAction) {
  switch (action.type) {
    case 'forward_webhook':
      // TypeScript knows action.config has url
      fetch(action.config.url, { headers: action.config.headers });
      break;
    case 'send_notification':
      // TypeScript knows action.config has message
      sendNotification(action.config.message);
      break;
  }
}
```

## Adding New Event Types

To add a new event type to the system:

1. Update the database enum type in a new migration:
   ```sql
   ALTER TYPE make_event_type ADD VALUE 'new_event_type';
   ```

2. Update the TypeScript enum in `src/types/make.ts`:
   ```typescript
   export enum MakeEventType {
     // Existing types...
     NewEventType = 'new_event_type'
   }
   ```

3. Document the new event type and its payload structure in `docs/make-event-types.md`

4. Update relevant UI components to support the new event type

5. Implement event generation and processing logic

6. Add tests for the new event type

## Adding New Condition Operators

To add a new condition operator:

1. Update the TypeScript interface in `src/types/make.ts`:
   ```typescript
   export interface MakeCondition {
     field: string;
     operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'newOperator';
     value: string | number | boolean;
   }
   ```

2. Add the operator to the `CONDITION_OPERATORS` array in `AutomationForm.tsx`:
   ```typescript
   const CONDITION_OPERATORS = [
     // Existing operators...
     { value: 'newOperator', label: 'New Operator' }
   ];
   ```

3. Implement the operator evaluation logic in the edge function:
   ```typescript
   function evaluateCondition(condition, payload) {
     const fieldValue = getFieldValue(payload, condition.field);
     
     switch (condition.operator) {
       // Existing operators...
       case 'newOperator':
         return evaluateNewOperator(fieldValue, condition.value);
       default:
         return false;
     }
   }
   ```

4. Document the new operator in the appropriate documentation files

5. Add tests for the new operator

## Adding New Action Types

To add a new action type:

1. Update the TypeScript types in `src/types/make.ts`:
   ```typescript
   // Add a new action type interface
   export interface NewAction {
     type: 'new_action';
     config: {
       // Action-specific configuration
       param1: string;
       param2: number;
     };
   }
   
   // Update the MakeAction type union
   export type MakeAction = ForwardWebhookAction | SendNotificationAction | NewAction;
   ```

2. Add the action type to the UI components:
   ```typescript
   // In AutomationForm.tsx
   const ACTION_TYPES = [
     // Existing action types...
     { value: 'new_action', label: 'New Action' }
   ];
   
   // Add action-specific configuration UI
   {action.type === 'new_action' && (
     <div className="space-y-2">
       <Label htmlFor={`action-${index}-param1`}>Parameter 1</Label>
       <Input
         id={`action-${index}-param1`}
         value={action.config?.param1 || ''}
         onChange={(e) => handleActionConfigChange(index, 'param1', e.target.value)}
         placeholder="Enter parameter 1"
       />
       {/* Additional fields */}
     </div>
   )}
   ```

3. Implement the action execution logic in the edge function:
   ```typescript
   async function executeAction(action, payload) {
     switch (action.type) {
       // Existing action types...
       case 'new_action':
         return await executeNewAction(action.config, payload);
       default:
         throw new Error(`Unknown action type: ${action.type}`);
     }
   }
   
   async function executeNewAction(config, payload) {
     // Implementation of the new action
   }
   ```

4. Document the new action type in the appropriate documentation files

5. Add tests for the new action type

## Frontend Component Development

When developing frontend components for the Make Automation System:

### Component Structure

- Use functional components with React hooks
- Keep components focused on a single responsibility
- Use TypeScript props interfaces for type safety

```typescript
interface MyComponentProps {
  data: SomeType;
  onAction: (id: string) => void;
}

const MyComponent = ({ data, onAction }: MyComponentProps) => {
  // Component implementation
};
```

### State Management

- Use React Query for data fetching and mutations
- Use local state for UI-specific state
- Consider using context for shared state

### UI Guidelines

- Use the shared UI components from `@/components/ui/`
- Follow the established design patterns
- Ensure responsive design with Tailwind CSS
- Implement proper loading and error states

## Edge Function Development

When developing edge functions for the Make Automation System:

### Function Structure

- Keep functions focused on a single responsibility
- Use TypeScript for type safety
- Implement proper error handling
- Add detailed logging for debugging

### Database Interactions

- Use parameterized queries to prevent SQL injection
- Minimize the number of database queries
- Use transactions for operations that modify multiple records
- Implement proper error handling for database operations

### Authentication and Authorization

- Validate authentication tokens
- Implement proper authorization checks
- Use row-level security (RLS) policies where appropriate

### CORS and Security

- Configure appropriate CORS headers
- Validate and sanitize all input data
- Implement rate limiting for public endpoints

## Database Schema Changes

When making changes to the database schema:

1. Create a new migration file with a timestamp prefix:
   ```bash
   touch supabase/migrations/$(date +%Y%m%d%H%M%S)_make_schema_update.sql
   ```

2. Add the schema changes to the migration file:
   ```sql
   -- Add a new column
   ALTER TABLE make_automation_rules ADD COLUMN new_column TEXT;
   
   -- Add an index
   CREATE INDEX idx_make_automation_rules_new_column ON make_automation_rules(new_column);
   
   -- Update triggers
   CREATE OR REPLACE FUNCTION update_updated_at_column()
   RETURNS TRIGGER AS $$
   BEGIN
       NEW.updated_at = timezone('utc'::text, now());
       RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;
   ```

3. Apply the migration locally:
   ```bash
   supabase db reset
   ```

4. Update TypeScript interfaces to reflect the schema changes

5. Update affected queries and mutations

6. Document the schema changes in the appropriate documentation files

## Testing Strategy

### Component Testing

- Use React Testing Library for component tests
- Test component rendering, interactions, and state changes
- Mock API calls using MSW or similar tools

```tsx
test('renders automation list', async () => {
  // Setup
  render(<AutomationList />);
  
  // Assertions
  expect(screen.getByText('Active Automations')).toBeInTheDocument();
  
  // Interaction
  await userEvent.click(screen.getByText('New Automation'));
  
  // Assertions after interaction
  expect(screen.getByText('Create Automation Rule')).toBeInTheDocument();
});
```

### Hook Testing

- Test custom hooks using `renderHook` from React Testing Library
- Verify hook behavior, state updates, and side effects

```tsx
test('useMakeAutomations provides automation rules', async () => {
  // Setup
  const { result, waitForNextUpdate } = renderHook(() => useMakeAutomations());
  
  // Wait for query to resolve
  await waitForNextUpdate();
  
  // Assertions
  expect(result.current.useAutomationRules().data).toHaveLength(3);
});
```

### Edge Function Testing

- Write unit tests for edge functions
- Use mocks for database and external services
- Test both success and error paths

```typescript
test('createRule creates a new automation rule', async () => {
  // Setup
  const request = new Request('http://localhost:8000/make_automation_manager', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'create',
      name: 'Test Rule',
      // ... other fields
    }),
  });
  
  // Mock database response
  supabase.from = jest.fn().mockReturnValue({
    insert: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { id: 'test-id', name: 'Test Rule' },
          error: null,
        }),
      }),
    }),
  });
  
  // Execute
  const response = await serve(request);
  const data = await response.json();
  
  // Assertions
  expect(response.status).toBe(200);
  expect(data.success).toBe(true);
  expect(data.rule.name).toBe('Test Rule');
});
```

### End-to-End Testing

- Use Playwright or Cypress for end-to-end tests
- Test critical user flows
- Verify integration between frontend and backend

## Security Guidelines

When developing for the Make Automation System, follow these security guidelines:

### Input Validation

- Validate all input data on both frontend and backend
- Use TypeScript types and Zod schemas for validation
- Sanitize user-provided data before using it in queries or templates

### Authentication and Authorization

- Use Supabase authentication for user management
- Implement proper authorization checks for all operations
- Use row-level security (RLS) policies in the database

### Sensitive Data

- Never expose sensitive data in logs or error messages
- Use environment variables for secrets
- Implement proper data encryption for sensitive information

### CORS and XSS

- Configure appropriate CORS headers
- Use content security policy (CSP) headers
- Sanitize user-provided HTML or markdown

## Performance Considerations

To ensure optimal performance of the Make Automation System:

### Database Optimization

- Use appropriate indexes for frequently queried fields
- Minimize the number of database queries
- Use efficient query patterns (e.g., avoid N+1 queries)

### Frontend Optimization

- Implement pagination for large data sets
- Use React Query for efficient data fetching and caching
- Optimize component re-renders with memoization

### Edge Function Optimization

- Minimize cold start times by keeping functions small
- Use efficient algorithms and data structures
- Implement caching where appropriate

### Monitoring and Profiling

- Implement proper logging for performance metrics
- Monitor database query performance
- Profile and optimize slow operations 