"use client";

import { useUserProfile, Profile, Company, CompanyMembership } from "@/components/user-profile-provider";
import { UserRole } from "@/utils/role-auth-base";

export function useUserRole() {
  const {
    profile,
    company,
    membership,
    memberships,
    activeCompanyId,
    setActiveCompanyId,
    isLoading,
    hasMinRole,
    isAdmin,
    canEdit,
    modules,
    systemRole,
    refresh,
  } = useUserProfile();

  return {
    role: membership?.role || ("viewer" as UserRole),
    profile,
    company,
    membership,
    companies: memberships, // For multi-tenant switcher in sidebar
    activeCompanyId,
    setActiveCompany: setActiveCompanyId,
    isLoading,
    hasMinRole,
    isAdmin,
    canEdit,
    modules: modules || [],
    systemRole: systemRole || "User",
    refresh,
  };
}
export type { Profile, Company, CompanyMembership };
