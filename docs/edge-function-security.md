# Edge Function Security Standards

This document categorizes all edge functions by their security requirements and standardizes JWT verification across the application.

## Security Categories

Edge functions are categorized by their security requirements:

1. **Public** - No JWT verification required, accessible without authentication
2. **Authenticated** - Requires a valid user JWT token
3. **Service Role** - Requires a service role JWT token

## Function Category Reference

### Public Functions (No JWT Verification)

These functions are public-facing and do not require JWT verification:

- `telegram-webhook` - Receives updates from Telegram
- `log-operation` - Records operation events in audit logs
- `manual-caption-parser` - Processes captions without authentication
- `update-telegram-caption` - Allows updates to captions from Telegram

### Authenticated Functions (User JWT Required)

These functions require a valid user JWT token:

- `user-data` - Accesses user-specific data
- `create-ayd-session` - Creates authenticated sessions
- `validate-storage-files` - Validates user's storage files

### Service Role Functions (Service JWT Required)

These functions require a service role JWT token or can only be called internally:

- `xdelo_delete_message` - Administrative message deletion
- `product-matching` - Matches products in the database
- `process-audio-upload` - Processes audio files

## JWT Verification Implementation

All edge functions should use one of the following standardized approaches for JWT verification:

### 1. Using Security Level Enum

```typescript
import { SecurityLevel } from '../_shared/jwt-verification.ts';

// Explicitly declare security level at the top of the file
const securityLevel = SecurityLevel.PUBLIC; // or AUTHENTICATED or SERVICE_ROLE
```

### 2. Using withSecureErrorHandling

```typescript
import { withSecureErrorHandling, SecurityLevel } from '../_shared/jwt-verification.ts';

// Implementation with JWT verification
serve(withSecureErrorHandling('function-name', handler, {
  securityLevel: SecurityLevel.AUTHENTICATED
}));
```

### 3. Using createSecureHandler

```typescript
import { createSecureHandler, SecurityLevel } from '../_shared/jwt-verification.ts';

// Create a handler with JWT verification
const handler = createSecureHandler(async (req, userId) => {
  // Function implementation
}, { securityLevel: SecurityLevel.AUTHENTICATED });

serve(handler);
```

## Config.toml Settings

All public-facing webhooks must explicitly set `verify_jwt = false` in the config.toml file:

```toml
[functions.telegram-webhook]
verify_jwt = false
```

Service role functions should use the JWT verification in code rather than relying on config.toml settings.

## Migration Path

When updating existing functions:

1. Add explicit security level declaration
2. Use consistent error handling with the shared JWT verification module
3. Update config.toml to match the security requirements
4. Add proper documentation in function comments

## Note on Deprecated Functions

Some functions have been deprecated and removed from the codebase. See `docs/deprecated-edge-functions.md` for a complete list of removed functions and their replacements. 