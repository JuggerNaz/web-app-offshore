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

  const sysRoleLower = (systemRole || "").toLowerCase().trim();
  const isSysSuper = sysRoleLower === "super admin" || sysRoleLower === "super_admin" || sysRoleLower === "superadmin";
  const isSysCompanyAdmin = isSysSuper || sysRoleLower === "company admin" || sysRoleLower === "company_admin" || sysRoleLower === "companyadmin" || sysRoleLower === "admin" || sysRoleLower === "administrator";
  const effectiveRole: UserRole = isSysSuper ? "super_admin" : (isSysCompanyAdmin ? "company_admin" : (membership?.role || "viewer"));

  return {
    role: effectiveRole,
    rawRole: membership?.role || ("viewer" as UserRole),
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
