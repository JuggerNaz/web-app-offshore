# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is a Next.js offshore web application built on Supabase, managing offshore structures (platforms, pipelines, etc.), job packs, components, and system planning. The application is based on the Next.js + Supabase starter template with extensive customization.

## Development Commands

### Running the Application
```bash
yarn dev                # Start development server with Turbopack
yarn build              # Build for production
yarn start              # Start production server
```

### Code Quality
```bash
yarn lint               # Check for lint errors
yarn lint:fix           # Fix lint errors automatically
yarn typecheck          # Run TypeScript type checking
yarn format             # Format code with Prettier
yarn format:check       # Check code formatting
```

### Testing
```bash
yarn test               # Run tests in watch mode
yarn test:run           # Run tests once
yarn test:ui            # Run tests with UI
yarn test:coverage      # Run tests with coverage
```

### Supabase Type Generation
Generate TypeScript types from the Supabase database schema:
```bash
npx supabase gen types typescript --db-url postgresql://postgres.zpsmxtdqlpbdwfzctqzd:yourpassword@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres > ./supabase/schema.ts
```
Replace `yourpassword` with the actual database password from `.env.local`.

### Storage Setup
```bash
npm run setup-storage    # Initialize Supabase storage buckets
npm run test-storage     # Test storage URL generation
```

## Architecture

### Technology Stack
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript (strict mode)
- **Backend**: Supabase (auth, database, storage)
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS
- **Forms**: react-hook-form + Zod validation
- **State**: Jotai for client state
- **Data Fetching**: SWR for client-side, Server Components for server-side

### Supabase Client Patterns

The application uses three different Supabase client patterns depending on the context:

1. **Client Components** (`utils/supabase/client.ts`):
   ```typescript
   import { createClient } from "@/utils/supabase/client";
   ```

2. **Server Components & Route Handlers** (`utils/supabase/server.ts`):
   ```typescript
   import { createClient } from "@/utils/supabase/server";
   ```

3. **Middleware** (`utils/supabase/middleware.ts`):
   - Used in `middleware.ts` for session management
   - Handles auth state across all requests

### Directory Structure

- **`app/`**: Next.js App Router routes
  - `(auth-pages)/`: Authentication routes (sign-in, sign-up, forgot-password)
  - `(main)/`: Public routes
  - `dashboard/`: Protected dashboard routes with nested layouts
    - `structure/`: Platform/pipeline structure management
    - `jobpack/`: Job package management
    - `planning/`: Planning features
    - `system-updates/`: Changelog display
  - `api/`: API route handlers (platform, pipeline, attachment, comment, etc.)
  - `actions.ts`: Server actions for authentication

- **`components/`**: Reusable React components
  - `ui/`: shadcn/ui components
  - `forms/`: Form components with Zod validation
  - `data-table/`: Table components using TanStack Table
  - `dialogs/`: Modal/dialog components
  - `charts/`: Chart components using Recharts

- **`utils/`**: Utility modules
  - `supabase/`: Supabase client creation utilities
  - `schemas/zod.ts`: Zod validation schemas
  - `types/`: TypeScript type definitions
  - `conversion/`: Data conversion utilities (legacy)
  - `hooks/`: Custom React hooks
  - `storage.ts`: File storage utilities
  - `changelog.ts` & `changelog-server.ts`: Changelog utilities

- **`supabase/`**: Supabase configuration
  - `schema.ts`: Generated TypeScript types from database
  - `config.toml`: Supabase CLI configuration

- **`scripts/`**: Utility scripts
  - `setup-storage.js`: Storage bucket setup
  - `test-storage-url.js`: Storage URL testing

### Import Paths

The project uses `@/*` path alias for absolute imports:
```typescript
import { createClient } from "@/utils/supabase/server";
import { Button } from "@/components/ui/button";
```

### Authentication Flow

1. **Middleware**: All routes pass through `middleware.ts`, which calls `updateSession()` to maintain auth state
2. **Protected Routes**: Dashboard layout (`app/dashboard/layout.tsx`) checks for authenticated user and redirects to home if not logged in
3. **Server Actions**: Authentication actions in `app/actions.ts`:
   - `signUpAction`: User registration
   - `signInAction`: User login
   - `signOutAction`: User logout
   - `forgotPasswordAction`: Password reset
   - `resetPasswordAction`: Password update

### API Route Pattern

API routes follow a consistent pattern using Next.js Route Handlers:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  const supabase = createClient();
  const { data, error } = await supabase.from("table_name").select("*");
  
  if (error) {
    return NextResponse.json({ error: "Error message" }, { status: 500 });
  }
  
  return NextResponse.json({ data });
}
```

### Form Validation

Forms use react-hook-form with Zod schemas:

1. Define Zod schema in `utils/schemas/zod.ts`
2. Use `@hookform/resolvers/zod` for form validation
3. Form components in `components/forms/` follow this pattern
4. shadcn/ui Form components wrap react-hook-form

### Database Schema

- **TypeScript types** are auto-generated in `supabase/schema.ts`
- **Key tables**: platform, pipeline, component, jobpack, attachment, comment, structure
- **Type usage**: Import `Database` type from `@/supabase/schema`

### Storage Handling

File uploads use the `utils/storage.ts` utilities:

- `getStoragePublicUrl()`: Generate public URLs for storage objects
- `processAttachmentUrl()`: Process attachment metadata to get correct URLs
- **Bucket**: `attachments` bucket for file storage
- **FileUpload component**: `components/forms/FileUpload.tsx` handles file uploads

## Development Patterns

### Adding New API Routes

1. Create route handler in `app/api/[resource]/route.ts`
2. Use the `withAuth` middleware for protected routes
3. Use centralized error handling with `handleSupabaseError`
4. Use standardized responses with `apiSuccess`, `apiCreated`, etc.

**Example**:
```typescript
import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { apiSuccess, apiCreated } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";
import { withAuth } from "@/utils/with-auth";

export const GET = withAuth(async (request: NextRequest, { user }) => {
  const supabase = createClient();
  const { data, error } = await supabase.from("table").select("*");
  
  if (error) {
    return handleSupabaseError(error, "Failed to fetch data");
  }
  
  return apiSuccess(data);
});

export const POST = withAuth(async (request: NextRequest, { user }) => {
  const supabase = createClient();
  const body = await request.json();
  
  const { data, error } = await supabase.from("table").insert(body).select().single();
  
  if (error) {
    return handleSupabaseError(error, "Failed to create resource");
  }
  
  return apiCreated(data);
});
```

### Adding Protected Pages

1. Create page under `app/dashboard/`
2. User authentication is handled by parent layout
3. Access user via Supabase client:
   ```typescript
   const supabase = createClient();
   const { data: { user } } = await supabase.auth.getUser();
   ```

### Working with Forms

1. Define Zod schema in `utils/schemas/zod.ts`
2. Use `react-hook-form` with `zodResolver`
3. Use shadcn/ui Form components for consistent UI
4. Handle submission via Server Actions or API routes

### Database Type Regeneration

After database schema changes:
1. Update schema in Supabase dashboard
2. Run the type generation command (see Development Commands)
3. Types in `supabase/schema.ts` will be updated
4. Update any affected Zod schemas or type definitions

## Environment Variables

Required variables in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Package Manager

This project uses **Yarn 1.22.22** as specified in `package.json`. Use `yarn` instead of `npm` for installing dependencies.
