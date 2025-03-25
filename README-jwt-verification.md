# JWT Verification Update Guide

This guide provides instructions for implementing the standardized JWT verification approach across edge functions.

## Overview

The JWT verification update:

1. Standardizes security handling across edge functions
2. Makes JWT verification explicit for each function
3. Improves webhook endpoints by removing JWT verification
4. Adds security documentation
5. Removes deprecated edge functions

## Deployment Steps

### 1. Update telegram-webhook Function

The telegram-webhook function has been updated to:
- Explicitly use the cors.ts module
- Set SecurityLevel.PUBLIC to disable JWT verification
- Use consistent CORS handling
- Ensure proper request/response formatting

Deploy the updated function:

```bash
cd supabase/functions
supabase functions deploy telegram-webhook
```

### 2. Update config.toml

We've updated the config.toml file to:
- Group functions by security requirements
- Set verify_jwt=false for public webhook functions
- Set verify_jwt=true for user-authenticated functions
- Standardize JWT verification settings
- Remove deprecated functions

Deploy the updated config:

```bash
supabase functions deploy
```

### 3. Apply Standard JWT Verification to Other Functions

For each edge function, implement one of the standardized approaches:

#### For public-facing webhook functions:

```typescript
import { SecurityLevel } from '../_shared/jwt-verification.ts';

// Explicitly mark as public
const securityLevel = SecurityLevel.PUBLIC;
```

#### For authenticated functions:

```typescript
import { withSecureErrorHandling, SecurityLevel } from '../_shared/jwt-verification.ts';

// Implementation with JWT verification
serve(withSecureErrorHandling('function-name', handler, {
  securityLevel: SecurityLevel.AUTHENTICATED
}));
```

### 4. Test the Updates

1. Test the telegram-webhook endpoint with Telegram:
   - Make sure it receives messages
   - Verify responses are properly formatted
   - Check that CORS headers are applied

2. Test user-authenticated functions:
   - Verify they reject unauthenticated requests
   - Confirm they accept valid JWT tokens

### 5. Review Documentation

The following documentation has been updated:

- `docs/edge-function-security.md` - New guide for JWT verification standards
- `docs/deprecated-edge-functions.md` - List of deprecated functions removed
- Updated function comments with security requirements

## Removed Deprecated Functions

The following deprecated functions have been removed from config.toml:

- Caption processing functions: `analyze-with-ai`, `parse-caption-with-ai`
- External integration functions: `make-webhook-sender`, `make-webhook-tester`, `make-webhook-retry`, etc.
- Duplicate functionality: `delete-telegram-message`, `redownload-missing-files`

See `docs/deprecated-edge-functions.md` for the complete list and details.

## Rollback Plan

If issues occur:

1. Revert the telegram-webhook function to the previous version
2. Restore the original config.toml
3. Deploy both changes to restore original functionality

## Security Considerations

- Public webhook endpoints are still protected by Supabase project settings
- The telegram-webhook is secured by Telegram's authentication mechanism
- Sensitive operations require proper JWT verification 