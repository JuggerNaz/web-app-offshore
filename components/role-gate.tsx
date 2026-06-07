"use client";

import React from "react";
import { useUserRole } from "@/utils/hooks/use-user-role";
import { UserRole } from "@/utils/role-auth-base";

interface RoleGateProps {
  children: React.ReactNode;
  minRole?: UserRole;
  allowedRoles?: UserRole[];
  fallback?: React.ReactNode;
  hide?: boolean;
}

/**
 * RoleGate client component to conditionally render children based on role access.
 *
 * Usage:
 * ```tsx
 * <RoleGate minRole="manager" fallback={<ReadOnlyMessage />}>
 *   <button>Edit Resource</button>
 * </RoleGate>
 * ```
 */
export function RoleGate({
  children,
  minRole,
  allowedRoles,
  fallback = null,
  hide = false,
}: RoleGateProps) {
  const { role, hasMinRole, isLoading } = useUserRole();

  if (isLoading) {
    // During loading, we can optionally show nothing or a subtle spinner.
    // For gating UI, returning null by default prevents layouts shifting.
    return null;
  }

  let hasAccess = false;

  if (minRole) {
    hasAccess = hasMinRole(minRole);
  } else if (allowedRoles) {
    hasAccess = allowedRoles.includes(role);
  } else {
    // If no roles specified, allow access by default
    hasAccess = true;
  }

  if (!hasAccess) {
    if (hide) return null;
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
