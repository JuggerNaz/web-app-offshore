# Mission: Auth & RBAC System (Multi-Tenant Ready)

## Objective
Add role-based access control (RBAC) to the offshore web app with a multi-tenant-ready foundation. Single company operating now, but the schema supports multiple companies and cross-company user access from day one.

## Architecture Decision
- **`companies`** table — tenant registry
- **`profiles`** table — user identity (name, avatar, etc.)
- **`company_memberships`** table — links users to companies with per-company roles
- **Operational tables** (`platform`, `jobpack`, `insp_*`) — NOT changed now; `company_id` added incrementally later

## Scope (Phased)

### Phase 1 — Foundation (ship first)
- `companies` table + seed default company
- `profiles` table (identity only — no role column)
- `company_memberships` table with `role` enum: `super_admin`, `company_admin`, `manager`, `inspector`, `viewer`
- Auto-create profile + default company membership on sign-up (DB trigger)
- `useUserRole()` client hook + `getUserProfile()` server helper
- `withRole()` API middleware extending existing `withAuth()`
- `<RoleGate>` component for client-side UI gating
- Page-level restrictions via layout guards
- Modernise sign-in / sign-up page styling (keep layout)

### Phase 2 — Admin Panel
- Full user management page at `/dashboard/admin/users`
- Invite users via email (Supabase invite API)
- Assign/change roles, toggle active/inactive
- View last sign-in activity
- Only visible to `company_admin+` roles

### Phase 3 — Multi-Tenant Activation (future)
- Add `company_id` to operational tables incrementally
- Company switcher in sidebar (when user belongs to multiple companies)
- RLS policies per operational table scoped to active company
- Microsoft SSO

## Roles & Permissions Matrix

| Feature | super_admin | company_admin | manager | inspector | viewer |
|---|:---:|:---:|:---:|:---:|:---:|
| Dashboard Home | ✅ | ✅ | ✅ | ✅ | ✅ |
| Field Assets | ✅ | ✅ | ✅ | ✅ | 👁️ |
| Work Packages | ✅ | ✅ | ✅ | ✅ | 👁️ |
| Inspection | ✅ | ✅ | ✅ | ✅ | 👁️ |
| Reports | ✅ | ✅ | ✅ | 👁️ | 👁️ |
| Manager Overview | ✅ | ✅ | ✅ | ❌ | ❌ |
| Settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| User Management | ✅ | ✅ | ❌ | ❌ | ❌ |
| Migration Tools | ✅ | ❌ | ❌ | ❌ | ❌ |

✅ = full access, 👁️ = read-only, ❌ = hidden

## Constraints
- Operational tables NOT changed — no `company_id` yet
- Use Supabase `company_memberships` + RLS (not JWT custom claims)
- Keep existing `withAuth()` working — extend, don't replace
- Yarn 1.22, Next.js 16, TypeScript strict
- One user can belong to multiple companies with different roles per company
