# System Patterns: xdelo-app

## Code Organization Patterns

### Feature-Based Architecture
The codebase is organized by feature rather than by technical layer. Each feature folder contains all related components, hooks, types, and utilities.

```
src/
├── features/
│   ├── messages/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── types/
│   │   └── utils/
│   ├── media/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── types/
│   │   └── utils/
│   └── ...
├── shared/
│   ├── components/
│   ├── hooks/
│   ├── types/
│   └── utils/
└── ...
```

### Naming Conventions
- **React Components**: PascalCase (e.g., `MessageCard.tsx`)
- **Classes**: PascalCase
- **Variables, Functions, Methods**: camelCase
- **Files and Directories**: kebab-case
- **Environment Variables**: UPPERCASE
- **Constants**: UPPERCASE_SNAKE_CASE
- **Types and Interfaces**: PascalCase with prefix (e.g., `IMessage`, `TProcessingState`)

## Database Access Patterns

### Row Level Security (RLS)
All tables are protected with RLS policies to ensure data security.

```sql
-- Example RLS policy
CREATE POLICY "Users can only view their own messages"
ON messages
FOR SELECT
USING (auth.uid() = user_id);
```

### Database Functions
Complex database operations are encapsulated in PostgreSQL functions to ensure consistency and reusability.

```sql
-- Example database function
CREATE OR REPLACE FUNCTION sync_media_group_content(
  p_media_group_id TEXT,
  p_analyzed_content JSONB
)
RETURNS VOID AS $$
BEGIN
  UPDATE messages
  SET analyzed_content = p_analyzed_content,
      processing_state = 'completed',
      updated_at = NOW()
  WHERE media_group_id = p_media_group_id;
END;
$$ LANGUAGE plpgsql;
```

### Typed Database Access
Database access is typed using generated TypeScript types from the database schema.

```typescript
// Example typed database access
import { Database } from '@/types/supabase';
type Message = Database['public']['Tables']['messages']['Row'];

const { data, error } = await supabase
  .from('messages')
  .select('*')
  .eq('processing_state', 'pending')
  .returns<Message[]>();
```

## Error Handling Patterns

### Try-Catch with Typed Errors
Error handling uses try-catch blocks with typed errors for better error management.

```typescript
// Example error handling pattern
try {
  const result = await processMedia(message);
  return result;
} catch (error) {
  if (error instanceof DownloadError) {
    // Handle download errors
    await logError('download_error', error, message.id);
  } else if (error instanceof StorageError) {
    // Handle storage errors
    await logError('storage_error', error, message.id);
  } else {
    // Handle unknown errors
    await logError('unknown_error', error, message.id);
  }
  throw error;
}
```

### Error Recovery with Retries
Automatic retry mechanism with exponential backoff for transient errors.

```typescript
// Example retry pattern
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}
```

## State Management Patterns

### React Query for Server State
TanStack Query (React Query) is used for server state management.

```typescript
// Example React Query pattern
const useMessages = (filter: MessageFilter) => {
  return useQuery({
    queryKey: ['messages', filter],
    queryFn: () => fetchMessages(filter),
    staleTime: 1000 * 60, // 1 minute
  });
};
```

### React Context for UI State
React Context is used for UI state management.

```typescript
// Example React Context pattern
const MessageContext = createContext<MessageContextType | undefined>(undefined);

export const MessageProvider: React.FC = ({ children }) => {
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  
  return (
    <MessageContext.Provider value={{ selectedMessage, setSelectedMessage }}>
      {children}
    </MessageContext.Provider>
  );
};
```

## Testing Patterns

### Unit Testing with Vitest
Unit tests are written using Vitest for individual functions and components.

```typescript
// Example unit test pattern
import { describe, it, expect } from 'vitest';
import { parseCaption } from './captionParser';

describe('parseCaption', () => {
  it('should extract product name from caption', () => {
    const caption = 'Gelato Cake #GC123456 x 2';
    const result = parseCaption(caption);
    expect(result.productName).toBe('Gelato Cake');
  });
});
```

### Integration Testing with Playwright
Integration tests are written using Playwright for end-to-end testing.

```typescript
// Example integration test pattern
import { test, expect } from '@playwright/test';

test('user can view message details', async ({ page }) => {
  await page.goto('/messages');
  await page.click('[data-testid="message-card"]');
  await expect(page.locator('[data-testid="message-details"]')).toBeVisible();
});
```

## Documentation Patterns

### JSDoc for Code Documentation
JSDoc is used for documenting functions, classes, and interfaces.

```typescript
/**
 * Processes media from a Telegram message.
 * 
 * @param message - The Telegram message containing media
 * @returns A promise that resolves to a ProcessingResult
 * @throws DownloadError if media download fails
 * @throws StorageError if media storage fails
 */
async function processMedia(message: TelegramMessage): Promise<ProcessingResult> {
  // Implementation
}
```

### Markdown for Project Documentation
Markdown is used for project documentation, with a focus on clarity and completeness.

```markdown
# Media Processing

## Overview
The media processing pipeline handles the download, storage, and analysis of media files from Telegram messages.

## Flow
1. Telegram sends a webhook update
2. System downloads the media file
3. System stores the file in Supabase Storage
4. System analyzes the caption
5. System updates the database record
```

## UI Patterns

### Component Composition
UI components are composed from smaller, reusable components.

```tsx
// Example component composition pattern
const MessageCard: React.FC<MessageCardProps> = ({ message }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{message.id}</CardTitle>
        <CardDescription>{message.processing_state}</CardDescription>
      </CardHeader>
      <CardContent>
        <MediaPreview url={message.public_url} type={message.mime_type} />
        <Caption text={message.caption} />
      </CardContent>
      <CardFooter>
        <MessageActions message={message} />
      </CardFooter>
    </Card>
  );
};
```

### Responsive Design with Tailwind CSS
Tailwind CSS is used for responsive design.

```tsx
// Example responsive design pattern
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {messages.map(message => (
    <MessageCard key={message.id} message={message} />
  ))}
</div>
```

### Data Visualization with Tremor
Tremor is used for data visualization.

```tsx
// Example data visualization pattern
<Card>
  <CardHeader>
    <CardTitle>Processing States</CardTitle>
  </CardHeader>
  <CardContent>
    <DonutChart
      data={[
        { name: 'Pending', value: stats.pending },
        { name: 'Completed', value: stats.completed },
        { name: 'Error', value: stats.error },
      ]}
      category="value"
      index="name"
      colors={['blue', 'green', 'red']}
    />
  </CardContent>
</Card>
```
