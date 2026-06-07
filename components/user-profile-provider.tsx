"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { UserRole, ROLE_HIERARCHY, hasMinimumRole } from "@/utils/role-auth-base";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string;
  designation: string;
  is_active: boolean;
  last_sign_in: string | null;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  settings: any;
  created_at: string;
  updated_at: string;
}

export interface CompanyMembership {
  id: string;
  user_id: string;
  company_id: string;
  role: UserRole;
  is_active: boolean;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
}

interface UserProfileContextType {
  profile: Profile | null;
  company: Company | null;
  membership: CompanyMembership | null;
  memberships: CompanyMembership[];
  activeCompanyId: string | null;
  setActiveCompanyId: (companyId: string) => Promise<void>;
  isLoading: boolean;
  hasMinRole: (role: UserRole) => boolean;
  isAdmin: boolean;
  canEdit: boolean;
  modules: string[];
  systemRole: string | null;
  refresh: () => Promise<void>;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export function UserProfileProvider({
  children,
  initialData,
}: {
  children: React.ReactNode;
  initialData?: {
    profile: Profile;
    membership: CompanyMembership;
    company: Company;
    memberships: CompanyMembership[];
  };
}) {
  const [data, setData] = useState(initialData || null);
  const [activeCompanyId, setActiveCompanyIdState] = useState<string | null>(
    initialData?.company.id || null
  );
  const [isLoading, setIsLoading] = useState(!initialData);

  const fetchProfileSilent = async () => {
    try {
      const headers: HeadersInit = {};
      const stored = typeof window !== "undefined" ? localStorage.getItem("active_company_id") : null;
      if (stored) {
        headers["x-company-id"] = stored;
      }

      const res = await fetch("/api/auth/profile", { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setData(json.data);
        }
      } else if (res.status === 403 || res.status === 401) {
        if (typeof window !== "undefined") {
          const errorMsg = "Your account has been deactivated. Please contact your administrator.";
          window.location.href = `/sign-in?error=${encodeURIComponent(errorMsg)}`;
        }
      }
    } catch (err) {
      console.error("[UserProfileProvider] Error in silent profile check:", err);
    }
  };

  const fetchProfile = async (targetCompanyId?: string | null) => {
    try {
      setIsLoading(true);
      const headers: HeadersInit = {};
      if (targetCompanyId) {
        headers["x-company-id"] = targetCompanyId;
      } else {
        const stored = typeof window !== "undefined" ? localStorage.getItem("active_company_id") : null;
        if (stored) {
          headers["x-company-id"] = stored;
        }
      }

      const res = await fetch("/api/auth/profile", { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const profileData = json.data;
          setData(profileData);
          if (profileData.company) {
            setActiveCompanyIdState(profileData.company.id);
            if (typeof window !== "undefined") {
              localStorage.setItem("active_company_id", profileData.company.id);
            }
          }
        }
      } else if (res.status === 403 || res.status === 401) {
        if (typeof window !== "undefined") {
          const errorMsg = "Your account has been deactivated. Please contact your administrator.";
          window.location.href = `/sign-in?error=${encodeURIComponent(errorMsg)}`;
        }
      }
    } catch (err) {
      console.error("[UserProfileProvider] Error fetching profile:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!initialData) {
      fetchProfile();
    } else {
      // If we have initial data, ensure local storage matches
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("active_company_id");
        if (stored && stored !== initialData.company.id) {
          // If stored active company differs from server initial company, refetch to sync
          fetchProfile(stored);
        } else {
          localStorage.setItem("active_company_id", initialData.company.id);
        }
      }
    }

    // Set up silent polling for real-time deactivation check (every 15 seconds)
    const interval = setInterval(() => {
      fetchProfileSilent();
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const setActiveCompanyId = async (companyId: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("active_company_id", companyId);
    }
    await fetchProfile(companyId);
  };

  const hasMinRole = (requiredRole: UserRole): boolean => {
    if (!data?.membership?.role) return false;
    return hasMinimumRole(data.membership.role, requiredRole);
  };

  const role = data?.membership?.role;
  const isAdmin = role ? hasMinimumRole(role, "company_admin") : false;
  const canEdit = role ? hasMinimumRole(role, "inspector") : false;

  const value: UserProfileContextType = {
    profile: data?.profile || null,
    company: data?.company || null,
    membership: data?.membership || null,
    memberships: data?.memberships || [],
    activeCompanyId,
    setActiveCompanyId,
    isLoading,
    hasMinRole,
    isAdmin,
    canEdit,
    modules: (data as any)?.userRole?.modules || [],
    systemRole: (data as any)?.userRole?.role || "User",
    refresh: () => fetchProfile(activeCompanyId),
  };

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  const context = useContext(UserProfileContext);
  if (context === undefined) {
    throw new Error("useUserProfile must be used within a UserProfileProvider");
  }
  return context;
}
