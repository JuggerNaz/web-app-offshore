# Code Improvements Implementation Guide

This document outlines the improvements made to the codebase and how to install/use them.

## Installation

First, install the new development dependencies:

```bash
yarn add -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom jsdom
yarn add -D eslint eslint-config-next
```

## Improvements Implemented

### 1. ✅ Centralized Error Handling

**Location**: `utils/api-error-handler.ts`

**Usage**:

```typescript
import { handleSupabaseError } from "@/utils/api-error-handler";

const { data, error } = await supabase.from("table").select();
if (error) {
  return handleSupabaseError(error, "Failed to fetch data");
}
```

**Benefits**:

- Consistent error responses across all API routes
- Automatic HTTP status code mapping
- Reduced code duplication

### 2. ✅ Standardized API Responses

**Location**: `utils/api-response.ts`

**Usage**:

```typescript
import { apiSuccess, apiCreated, apiError } from "@/utils/api-response";

// Success response
return apiSuccess(data);

// Created response (201)
return apiCreated(newResource);

// Error response
return apiError("Not found", 404);
```

**Benefits**:

- Consistent response structure
- Type-safe responses
- Semantic helper functions

### 3. ✅ API Authentication Middleware

**Location**: `utils/with-auth.ts`

**Usage**:

```typescript
import { withAuth } from "@/utils/with-auth";

export const GET = withAuth(async (request, { user, params }) => {
  // user is guaranteed to exist here
  return apiSuccess({ userId: user.id });
});
```

**Benefits**:

- Protected API routes with single line
- Automatic authentication checking
- Type-safe user context

### 4. ✅ Testing Infrastructure

**Location**: `vitest.config.ts`, `vitest.setup.ts`

**Run tests**:

```bash
yarn test          # Run tests in watch mode
yarn test:run      # Run tests once
yarn test:ui       # Run tests with UI
yarn test:coverage # Run with coverage
```

**Example tests**: See `utils/storage.test.ts` and `utils/api-error-handler.test.ts`

### 5. ✅ Linting and Formatting

**Configuration**: `.eslintrc.json`, `.prettierrc`

**Run commands**:

```bash
yarn lint          # Check for lint errors
yarn lint:fix      # Fix lint errors automatically
yarn format        # Format code with Prettier
yarn typecheck     # Check TypeScript types
```

### 6. ✅ Environment Variable Template

**Location**: `.env.local.example`

**Usage**: Copy this file to `.env.local` and fill in your credentials.

## Refactored Examples

### Before (Old Pattern):

```typescript
export async function GET() {
  const supabase = createClient();
  const { data, error } = await supabase.from("platform").select("*");

  if (error) {
    console.error(error.message);
    return NextResponse.json({ error: "Failed to fetch" });
  }

  return NextResponse.json({ data });
}
```

### After (New Pattern):

```typescript
export const GET = withAuth(async (request, { user }) => {
  const supabase = createClient();
  const { data, error } = await supabase.from("platform").select("*");

  if (error) {
    return handleSupabaseError(error, "Failed to fetch platforms");
  }

  return apiSuccess(data);
});
```

## Migration Guide

### Step 1: Update API Routes

Migrate your API routes one by one using the new utilities. Examples:

- ✅ `app/api/platform/route.ts` (already updated)
- ✅ `app/api/pipeline/route.ts` (already updated)
- ⏳ Remaining routes to update

### Step 2: Add Tests

Start adding tests for:

1. Utility functions (high priority)
2. API routes (medium priority)
3. Components (as needed)

### Step 3: Run Linting

Fix linting issues gradually:

```bash
yarn lint:fix
```

## Best Practices Going Forward

### 1. All New API Routes Should:

- Use `withAuth` for protected routes
- Use `handleSupabaseError` for error handling
- Use `apiSuccess`/`apiCreated` for responses
- Include JSDoc comments

### 2. All New Code Should:

- Pass TypeScript checks
- Pass ESLint checks
- Be formatted with Prettier
- Include tests for business logic

### 3. Before Committing:

```bash
yarn typecheck && yarn lint && yarn test:run
```

## Recommended Next Steps

1. **Install dependencies** (see Installation section above)
2. **Add pre-commit hooks** (optional but recommended):
   ```bash
   yarn add -D husky lint-staged
   npx husky install
   ```
3. **Gradually migrate remaining API routes** to use new utilities
4. **Add more tests** as you work on features
5. **Set up CI/CD** to run tests and linting

## Questions?

Refer to:

- WARP.md for project architecture
- Individual utility files for detailed documentation
- Test files for usage examples
