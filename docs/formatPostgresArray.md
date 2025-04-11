# formatPostgresArray Function

```typescript
function formatPostgresArray(arr: any[] | null | undefined | string): string
```

## Description

Utility function that properly formats JavaScript arrays for PostgreSQL compatibility, specifically for use with `JSONB` type parameters. This function handles the conversion from JavaScript array representation to PostgreSQL array literal syntax.

## Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| arr | any[] \| null \| undefined \| string | The array or array-like value to be formatted for PostgreSQL |

## Returns

A string formatted as a PostgreSQL array literal (e.g., `'{}'` for empty arrays, or `'{"json_obj1","json_obj2"}'` for populated arrays).

## Key Behaviors

1. **Null/Undefined Handling**:
   - Returns `NULL` (as a string) when input is null or undefined
   - Ensures safe handling of missing values

2. **Empty Array Handling**:
   - Converts JavaScript `[]` to PostgreSQL's empty array syntax `'{}'`
   - Prevents the "malformed array literal" error

3. **String Input Handling**:
   - If input is already a string, validates it's properly formatted
   - Wraps with single quotes if not already wrapped

4. **Array Conversion**:
   - Converts JavaScript array objects to PostgreSQL array format
   - Properly stringifies and escapes JSONB elements
   - Maintains proper nesting for complex data structures

## Example

```typescript
// Empty array handling
const emptyArray = formatPostgresArray([]);
// Result: '{}'

// Populated array handling
const jsonArray = formatPostgresArray([{ id: 1, text: "test" }, { id: 2, text: "sample" }]);
// Result: '{"{"id":1,"text":"test"}","{"id":2,"text":"sample"}"}'

// Using with upsertMediaMessageRecord
await upsertMediaMessageRecord({
  // ... other parameters
  oldAnalyzedContent: formatPostgresArray(oldAnalyzedContent),
  // ... other parameters
});
```

## Integration with PostgreSQL Functions

This function is used primarily when passing data to the PostgreSQL function `upsert_media_message`, specifically for the `p_old_analyzed_content` parameter which expects a `JSONB` type. Without proper formatting, you may encounter the error:

```
malformed array literal: "[]"
```

The function ensures that:
1. Empty arrays are formatted as `'{}'` not `'[]'`
2. JSONB objects in arrays are properly stringified and escaped
3. Null values are handled appropriately

## Implementation Notes

- Located in the `dbOperations.ts` file in the Telegram webhook utilities
- Used by the `upsertMediaMessageRecord` function before sending data to the database
- Critical for caption change history tracking and media message updates
