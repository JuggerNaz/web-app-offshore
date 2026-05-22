# Web App Offshore — Style Guide & Agent Rules

> This file instructs AI agents (Antigravity, Gemini, Cursor) on how to write code in this project.

---

## 1. Language & Framework

| Setting | Value |
|---|---|
| Language | TypeScript (strict mode, `es5` target) |
| Framework | Next.js 16 — App Router |
| React | 19.x |
| Package manager | Yarn 1.22 (`yarn add`, never `npm install`) |

### TypeScript Rules
- Use `interface` for component props, `type` for unions/intersections
- Avoid `any` — use `unknown` + type narrowing, or explicit casts with comments
- Exception: Supabase tables not in auto-generated types may use `(supabase.from as any)()`
- Use `Array.from(map.entries())` instead of `for...of` on Maps (tsconfig target `es5`)
- Path alias: always use `@/` — never relative imports crossing more than one `../`

---

## 2. File Organisation

```
app/
  (auth-pages)/     # Public auth pages
  (main)/           # Public marketing pages
  dashboard/        # Protected — all feature modules
    [feature]/      # Feature folders (jobpack, inspection, etc.)
      page.tsx      # Route page
      layout.tsx    # Optional nested layout
  api/
    [resource]/     # REST-style route handlers
      route.ts
components/
  ui/               # shadcn/ui primitives (do NOT edit directly)
  forms/            # Form components
  dialogs/          # Modal/dialog components
  [feature]/        # Feature-specific components
utils/
  supabase/         # Supabase client factories
  schemas/          # Zod schemas
  hooks/            # Custom React hooks
  types/            # Shared TS types
types/              # Top-level type definitions
stores/             # Zustand / Jotai stores
```

### Naming Conventions
- **Files**: kebab-case (`user-profile-card.tsx`)
- **Components**: PascalCase (`UserProfileCard`)
- **Hooks**: camelCase with `use` prefix (`useInspectionData`)
- **API routes**: kebab-case folders (`/api/company-settings/route.ts`)
- **Types**: PascalCase, suffixed with purpose (`InspectionRecord`, `JobpackFormSchema`)

---

## 3. Component Patterns

### Server Components (default)
```tsx
// app/dashboard/feature/page.tsx
import { createClient } from "@/utils/supabase/server";

export default async function FeaturePage() {
  const supabase = createClient();
  const { data } = await supabase.from("table").select("*");
  return <div>{/* render data */}</div>;
}
```

### Client Components
```tsx
"use client";
import { createClient } from "@/utils/supabase/client";
// Use SWR, React Query, or useState for data
```

### Forms
- Always use `react-hook-form` + `zodResolver`
- Define Zod schema in `utils/schemas/` or co-locate with form
- Use shadcn/ui `<Form>` wrapper components

---

## 4. API Route Handlers

### Preferred Pattern (with auth + error handling)
```tsx
import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { apiSuccess, apiCreated } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";
import { withAuth } from "@/utils/with-auth";

export const GET = withAuth(async (request: NextRequest, { user }) => {
  const supabase = createClient();
  const { data, error } = await supabase.from("table").select("*");
  if (error) return handleSupabaseError(error, "Failed to fetch");
  return apiSuccess(data);
});
```

### Legacy Pattern (acceptable for simple endpoints)
```tsx
export async function GET() {
  const supabase = createClient();
  const { data, error } = await supabase.from("table").select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
```

---

## 5. Styling

- Use **Tailwind CSS** utility classes
- Use **shadcn/ui** CSS variables for theming (`hsl(var(--primary))`)
- Dark mode via `next-themes` + Tailwind `dark:` variant
- Custom utilities in `app/globals.css` under `@layer utilities`
- Never use inline `style` unless computing dynamic values
- Prefer `cn()` from `@/lib/utils` for conditional classes

---

## 6. State Management

| Scope | Tool |
|---|---|
| Server data cache | TanStack React Query (via `Providers`) |
| Client-side atoms | Jotai |
| Complex client stores | Zustand |
| URL state | Next.js `searchParams` |
| Form state | react-hook-form |

---

## 7. Database & Supabase

- **Types**: Auto-generated via `supabase gen types` → `supabase/schema.ts`
- **Client selection**:
  - Server Components / Route Handlers → `utils/supabase/server.ts`
  - Client Components → `utils/supabase/client.ts`
  - Middleware → `utils/supabase/middleware.ts`
- **RLS**: All tables have Row Level Security; queries run as authenticated user
- **JSONB fields**: Common pattern — `metadata` or `inspection_data` columns store flexible data
- **Oracle DB**: Legacy connection via `oracledb` for migration tools only (`utils/oracle-db.ts`)

---

## 8. Error Handling & Logging

- Use `console.error()` and `console.warn()` only (lint rule blocks `console.log`)
- API routes: use `handleSupabaseError()` for Supabase errors
- Client components: use `sonner` toast for user-facing errors
- Never expose raw database errors to the client

---

## 9. Testing

- Framework: **Vitest** + `@testing-library/react`
- Config: `vitest.config.ts` (jsdom environment, `@/` alias)
- Run: `yarn test:run` (CI), `yarn test` (watch)
- Place test files adjacent to source: `utils/storage.test.ts`

---

## 10. Agent-Specific Rules

1. **No full-repository scans** — read only what's needed
2. **Concise edits** — provide only the changed code block
3. **Respect existing patterns** — follow the patterns in surrounding code
4. **Don't refactor unsolicited** — fix only what's asked
5. **Prefer Server Components** — use `"use client"` only when necessary
6. **Always verify** — run `yarn typecheck` or `yarn build` after significant changes
