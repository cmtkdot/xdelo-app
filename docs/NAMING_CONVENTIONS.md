# Project Naming Conventions

This document outlines the standard naming conventions for the Xdelo project to ensure consistency across the codebase.

## Directory Structure

```
src/
├── components/    # Reusable UI components only
├── hooks/         # React hooks and business logic
├── integrations/  # External service integrations
├── lib/           # Configs and constants
├── pages/         # Route components only
├── types/         # Type definitions
└── utils/         # Helper functions

supabase/
└── functions/     # Edge functions
    ├── _shared/   # Shared utilities
    └── [function-name]/  # Individual function directories
```

## Frontend Naming Rules

### Components

- **File Names**: `PascalCase.tsx`
- **Directory Names**: `camelCase/`
- **Component Names**: PascalCase

```
components/
├── Layout/
│   ├── Header.tsx
│   └── AppSidebar.tsx
├── EnhancedMessages/
│   ├── MessageGridView.tsx
│   └── Filters/
│       ├── DateRangeFilter.tsx
│       └── SearchFilter.tsx
└── ui/
    ├── button.tsx
    └── dialog.tsx
```

### Hooks

- **File Names**: `useSnakeCase.ts`
- **Rule**: Must start with 'use' prefix
- **Pattern**: One hook per file

```
hooks/
├── useAuth.ts
├── useMessageAnalytics.ts
└── useVendors.ts
```

### Integrations

- **File Names**: `camelCase.ts`
- **Directory Names**: `camelCase/`
- **Type Files**: `types.ts` (within integration directory)

```
integrations/
└── supabase/
    ├── client.ts
    └── types.ts
```

### Pages

- **File Names**: `PascalCase.tsx`
- **Component Names**: PascalCase

```
pages/
├── Dashboard.tsx
├── Messages.tsx
└── Settings.tsx
```

### Types

- **File Names**: `PascalCase.ts`
- **Interfaces**: `IPascalCase` or `PascalCase`
- **Type Aliases**: `PascalCase`

```
types/
├── api/
│   ├── ProcessingState.ts
│   └── SyncStatus.ts
└── entities/
    ├── Message.ts
    └── Product.ts
```

### Utils & Lib

- **File Names**: `camelCase.ts`
- **Function Names**: camelCase

```
lib/
├── api.ts
├── mediaUtils.ts
└── utils.ts
```

## Backend Naming Rules (Supabase Functions)

### Edge Functions

- **Directory Names**: `kebab-case/`
- **Main File**: `index.ts`
- **Config File**: `config.toml`

```
functions/
├── media-management/
│   ├── config.toml
│   └── index.ts
└── telegram-webhook/
    ├── handlers/
    │   └── mediaMessageHandler.ts
    ├── config.toml
    └── index.ts
```

### Legacy Functions

- **Directory Names**: `xdelo_kebab-case/`
- **Prefix**: Use `xdelo_` for deprecated functions

```
functions/
└── xdelo_file_repair/
    ├── config.toml
    └── index.ts
```

### Shared Code

- **Directory Name**: `_shared/`
- **Utility Files**: `camelCase.ts`
- **Type Files**: `types.ts`

```
functions/
└── _shared/
    ├── mediaUtils.ts
    ├── captionParser.ts
    └── types.ts
```

## Database Naming Conventions

### Tables

- **Format**: `snake_case`
- **Glide Integration**: `gl_snake_case` (for Supabase linked Glide tables)
- **Maintenance Tables**: `glide_snake_case` (for sync/logging)

### Columns

- **Format**: `snake_case`
- **Relationships (Supabase)**: `sb_entity_id`
- **Core Fields**: `main_field_name`
- **Purchase Orders**: `po_field_name`
- **Relationships (Glide)**: `rowid_entity`
- **Invoices**: `invoice_field_name`

## Quick Reference

| Type | Pattern | Example |
|------|---------|---------|
| **Component Files** | PascalCase.tsx | `MessageCard.tsx` |
| **Component Directories** | camelCase/ | `mediaViewer/` |
| **Hook Files** | useSnakeCase.ts | `useAuth.ts` |
| **Utility Files** | camelCase.ts | `mediaUtils.ts` |
| **Page Components** | PascalCase.tsx | `Dashboard.tsx` |
| **Type Files** | PascalCase.ts | `Message.ts` |
| **Edge Function Directories** | kebab-case/ | `media-management/` |
| **Legacy Function Directories** | xdelo_kebab-case/ | `xdelo_file_repair/` |
| **Database Tables** | snake_case | `messages`, `gl_products` |

## Key Rules

1. **React Components**: Always PascalCase for component names and files
2. **Hooks**: Always start with `use` prefix and use camelCase
3. **Edge Functions**: Always use kebab-case for directories
4. **Legacy Code**: Prefix with `xdelo_` for functions targeted for removal
5. **Database**: Always use snake_case with appropriate prefixes

Following these conventions consistently will ensure the codebase remains organized and maintainable as it grows. 