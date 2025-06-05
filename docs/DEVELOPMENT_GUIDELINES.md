# Xdelo Development Guidelines

This document provides development guidelines that complement the [naming conventions](./NAMING_CONVENTIONS.md).

## Database Functions and Triggers

- **Database Functions**: Name using `snake_case` without any prefix for standard functions
- **Legacy/Migration Functions**: Use the `xdelo_` prefix ONLY for temporary or transitional functions that will eventually be removed
- **Triggers**: Name using `snake_case` describing the action and timing, e.g., `before_insert_message`

```sql
-- Standard function (preferred)
CREATE FUNCTION process_message() RETURNS void AS $$
-- Function body
$$ LANGUAGE plpgsql;

-- Legacy/transitional function (only when needed)
CREATE FUNCTION xdelo_migrate_old_data() RETURNS void AS $$
-- Function body
$$ LANGUAGE plpgsql;
```

## Edge Functions (Supabase)

- **Shared Utilities**: Always check the `_shared/` folder before creating new utility functions
- **Code Reuse**: Import utilities from `_shared/` rather than duplicating logic
- **New Shared Utilities**: Place common logic in `_shared/` with appropriate naming

```typescript
// Good practice
import { mediaUtils } from '../_shared/mediaUtils';

// Avoid recreating utilities that exist in _shared
// Don't do this:
// function resizeImage() { ... } // If this already exists in _shared
```

## Frontend Components

- **Page-Specific Components**: Create a directory within the page folder for components specific to that page

```
pages/
├── ProductGallery/               
│   ├── index.tsx                 # Main page component
│   └── components/               # Page-specific components
│       ├── ProductFilters.tsx
│       └── ProductGrid.tsx
```

- **Shared Components**: Place reusable components in the main `components/` directory
- **Component-Specific Hooks**: Create hooks specific to components when logic is not reused elsewhere

```typescript
// Component-specific hook in the same directory as the component
// pages/ProductGallery/hooks/useProductFilters.ts

export function useProductFilters() {
  // Hook implementation
}
```

## Types

- **Type Reuse**: Always check `types/` directories for existing types before creating new ones
- **Type Consistency**: Ensure new types match the naming and structure of existing types
- **Type Location**: Place general types in the main `types/` directory and component-specific types alongside components

## Code Organization

- **Shared Resources**: Create `_shared/` folders for:
  - Edge function utilities
  - Common component utilities
  - Shared hooks
  - Shared types

```
components/
├── _shared/              # Shared component utilities
│   └── mediaHelpers.tsx
└── [component folders]

hooks/
├── _shared/              # Shared hooks
│   └── useCommonState.ts
└── [specific hooks]
```

## UI Development

- **Component Library**: Use shadcn/ui components as the foundation
- **Styling**: Use Tailwind CSS for styling
- **Responsive Design**: Ensure all components work on mobile, tablet, and desktop
- **Accessibility**: Follow accessibility best practices (WCAG guidelines)

## Performance Considerations

- **Bundle Size**: Keep component dependencies minimal
- **Rendering Optimization**: Use React.memo and useMemo where appropriate
- **Data Fetching**: Use efficient data fetching patterns with proper loading states

Following these guidelines will help maintain a consistent, maintainable, and high-quality codebase. 