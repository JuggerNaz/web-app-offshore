# Memory — Cryptographic Device Registration System

This file serves as a permanent memory reference for the **Device Registration** security feature implemented in this application.

---

## 1. Core Objectives & Constraints

*   **Goal**: Restrict application access to only approved and registered devices for specific users.
*   **Role Permissions**: Users with roles of **`super_admin`** or **`company_admin`** are allowed to manage (register, view, and revoke) devices.
*   **Multi-User Shared Devices**: Devices are registered at the organization level (mapped to a company). Once registered, any approved user within that company can log in using their credentials on that device.
*   **Granular User Enforcements**:
    *   **`device_restriction_type = 'none'`**: User bypasses the device check (can log in from any hardware).
    *   **`device_restriction_type = 'enforced'`**: User is strictly validated against the registered device registry (must use an approved device).

---

## 2. Relational Schema (`registered_devices`)

The registry is maintained in a dedicated PostgreSQL table:

```sql
CREATE TABLE public.registered_devices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  device_name     VARCHAR(100) NOT NULL,
  device_token    VARCHAR(255) NOT NULL UNIQUE,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  registered_by   UUID NOT NULL REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.registered_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage devices"
  ON public.registered_devices FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.company_memberships cm
      WHERE cm.user_id = auth.uid()
      AND cm.role IN ('super_admin', 'company_admin')
      AND cm.is_active = true
    )
  );
```

---

## 3. Workflow Diagrams

### A. Enrollment Flow
```mermaid
sequenceDiagram
    actor Admin
    participant Browser
    participant Server as Backend API

    Admin->>Browser: Logs in as super_admin / company_admin
    Admin->>Browser: Opens /dashboard/admin/devices
    Admin->>Browser: Enters label & clicks "Register Device"
    Browser->>Server: POST /api/admin/devices { device_name }
    Server->>Server: Generates cryptographically secure token & inserts to DB
    Server-->>Browser: Returns 201 Created { device_token }
    Browser->>Browser: Stores token in browser cookies or IndexedDB
    Admin->>Admin: Logs out
```

### B. Validation Flow (During Login/Session Check)
```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant Middleware as Next.js Middleware

    User->>Browser: Navigates to Dashboard
    Browser->>Browser: Extracts stored device token
    Browser->>Middleware: Sends Request + Device Token (via cookie/header)
    Middleware->>Middleware: 1. Fetch user profile
    alt profile.device_restriction_type == 'none'
        Middleware-->>Browser: Allow Access (Bypassed)
    else profile.device_restriction_type == 'enforced'
        Middleware->>Middleware: 2. Query registered_devices table for token
        alt Valid Token & is_active == true
            Middleware-->>Browser: Allow Access
        else Token Missing or Inactive
            Middleware->>Middleware: 3. Sign out session
            Middleware-->>Browser: Redirect to /?error=unauthorized_device
        end
    end
```

---

## 4. API Definition

*   `GET /api/admin/devices`: Returns a list of all enrolled devices for the active company.
*   `POST /api/admin/devices`: Registers a new device. Returns the generated secret token.
*   `PATCH /api/admin/devices/[id]`: Toggles `is_active` status.
*   `DELETE /api/admin/devices/[id]`: Revokes and deletes a device registration.
