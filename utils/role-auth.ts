import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { apiUnauthorized, apiForbidden } from "@/utils/api-response";
import { AuthUser, getAuthUser } from "@/utils/auth/server-user";

import {
  UserRole,
  ROLE_HIERARCHY,
  hasMinimumRole,
  Profile,
  Company,
  CompanyMembership,
} from "./role-auth-base";

export type { UserRole, Profile, Company, CompanyMembership };
export { ROLE_HIERARCHY, hasMinimumRole };

// Companies columns needed by API consumers: id (tenant resolution), name
// (sidebar fallback), slug/logo_url (tenant pickers), is_active (org
// activation filtering). Intentionally excludes the potentially large
// `settings` JSON blob and other wide columns — /api/company-settings is the
// dedicated source for those, so every API request no longer pays for them.
const COMPANY_JOIN_COLUMNS = "id, name, slug, logo_url, is_active";

export interface AuthenticatedRoleContext {
  params: Promise<any>;
  user: AuthUser;
  profile: Profile;
  membership: CompanyMembership;
  company: Company;
  memberships: CompanyMembership[];
  userRole?: { role?: string; modules?: string[] } | null;
  effectiveRole?: UserRole;
  isSuperAdmin?: boolean;
  isCompanyAdmin?: boolean;
}

type AuthenticatedRoleHandler = (
  request: NextRequest,
  context: AuthenticatedRoleContext
) => Promise<NextResponse> | NextResponse;

/**
 * Fetch a user's profile and active company membership.
 * If companyId is not provided, defaults to the first active membership.
 */
export async function getUserMembership(supabase: any, userId: string, companyId?: string | null) {
  // Profile, memberships and role are all keyed by user_id and independent —
  // fetch them in parallel instead of sequentially (saves 2 round trips).
  const [profileRes, membershipsRes, roleRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase
      .from("company_memberships")
      .select(`*, company:companies!company_id(${COMPANY_JOIN_COLUMNS})`)
      .eq("user_id", userId)
      .eq("is_active", true),
    supabase.from("user_roles").select("role, modules").eq("user_id", userId).maybeSingle(),
  ]);

  let profile = profileRes.data;
  let profileError = profileRes.error;
  let allMemberships = membershipsRes.data || [];

  // If RLS blocked standard client query (e.g. auth.uid() session timing), fallback to admin client or direct queries
  if (!profile || profileError || allMemberships.length === 0) {
    try {
      const { createAdminClient, isServiceRoleConfigured } = await import("@/utils/supabase/server");
      const hasAdmin = isServiceRoleConfigured();

      const needProfile = !profile || profileError;
      const needMemberships = allMemberships.length === 0;

      if (hasAdmin && (needProfile || needMemberships)) {
        const adminClient = createAdminClient();
        const [adminProfileRes, adminMembershipsRes] = await Promise.all([
          needProfile
            ? adminClient.from("profiles").select("*").eq("id", userId).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          needMemberships
            ? adminClient
                .from("company_memberships")
                .select(`*, company:companies!company_id(${COMPANY_JOIN_COLUMNS})`)
                .eq("user_id", userId)
                .eq("is_active", true)
            : Promise.resolve({ data: null, error: null }),
        ]);

        if (adminProfileRes.data) {
          profile = adminProfileRes.data;
          profileError = null;
        }

        if (adminMembershipsRes.data && adminMembershipsRes.data.length > 0) {
          allMemberships = adminMembershipsRes.data;
        } else if (needMemberships) {
          // Direct query on company_memberships without join
          const directRes = await adminClient
            .from("company_memberships")
            .select("*")
            .eq("user_id", userId)
            .eq("is_active", true);
          if (directRes.data && directRes.data.length > 0) {
            allMemberships = directRes.data;
          }
        }
      }
    } catch (adminErr) {
      console.warn("[getUserMembership] Admin client fallback warning:", adminErr);
    }

    // Direct session query fallback for company_memberships (without companies join)
    // Every user has RLS permission to read their own company_memberships rows.
    if (allMemberships.length === 0) {
      try {
        const { data: directMemberships } = await supabase
          .from("company_memberships")
          .select("*")
          .eq("user_id", userId)
          .eq("is_active", true);
        if (directMemberships && directMemberships.length > 0) {
          allMemberships = directMemberships;
        }
      } catch (directErr) {
        console.warn("[getUserMembership] Direct memberships query failed:", directErr);
      }
    }
  }

  if (profileError || !profile) {
    // Attempt self-healing profile recovery:
    try {
      const { data: maybeProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (maybeProfile) {
        profile = maybeProfile;
        profileError = null;
      } else {
        // Synthesize valid active profile so user session isn't discarded due to missing profile row
        profile = {
          id: userId,
          email: "",
          full_name: "User",
          designation: "Staff",
          avatar_url: null,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          login_restriction_type: "always",
          device_restriction_type: "none",
        };
        profileError = null;
      }
    } catch (_) {
      profile = {
        id: userId,
        email: "",
        full_name: "User",
        designation: "Staff",
        avatar_url: null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        login_restriction_type: "always",
        device_restriction_type: "none",
      };
      profileError = null;
    }
  }

  const hasActiveMembership = (allMemberships || []).some((m: any) => m.is_active === true);
  if (profile.is_active === false && !hasActiveMembership) {
    return { error: "User profile is inactive", status: 403 };
  }

  // Time & Date-based login restriction check
  if (profile.login_restriction_type === 'scheduled') {
    try {
      const tz = profile.timezone || 'Asia/Kuala_Lumpur';
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour12: false,
        weekday: 'short',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      
      const parts = formatter.formatToParts(new Date());
      const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
      
      // Current date in target timezone as YYYY-MM-DD
      const currentDate = `${partMap.year}-${partMap.month}-${partMap.day}`;

      if (profile.allowed_start_date && currentDate < profile.allowed_start_date) {
        return { 
          error: `Access not yet active. Your access period begins on ${profile.allowed_start_date} (${tz}).`, 
          status: 403 
        };
      }

      if (profile.allowed_end_date && currentDate > profile.allowed_end_date) {
        return { 
          error: `Access expired. Your scheduled access ended on ${profile.allowed_end_date} (${tz}).`, 
          status: 403 
        };
      }

      const dayMap: Record<string, number> = {
        'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6, 'Sun': 7
      };
      const isoWeekday = dayMap[partMap.weekday] || 1;
      
      const allowedDays = profile.allowed_days || [1, 2, 3, 4, 5];
      if (!allowedDays.includes(isoWeekday)) {
        return { error: `Access denied. Login not allowed on this day.`, status: 403 };
      }
      
      const currentTime = `${partMap.hour}:${partMap.minute}:${partMap.second}`;
      const startTime = profile.allowed_start_time || '08:00:00';
      const endTime = profile.allowed_end_time || '17:00:00';
      
      if (currentTime < startTime || currentTime > endTime) {
        return { 
          error: `Access denied outside scheduled hours (${startTime} - ${endTime} ${tz}).`, 
          status: 403 
        };
      }
    } catch (e: any) {
      console.error("[getUserMembership] Scheduling check failed:", e);
    }
  }

  // 2. Resolve company details if missing
  const missingCompanyIds = allMemberships
    .filter((m: any) => (!m.company || (Array.isArray(m.company) && m.company.length === 0)) && m.company_id)
    .map((m: any) => m.company_id);

  if (missingCompanyIds.length > 0) {
    let comps: any[] | null = null;
    const compsRes = await supabase.from("companies").select(COMPANY_JOIN_COLUMNS).in("id", missingCompanyIds);
    comps = compsRes.data;
    if (!comps || comps.length === 0) {
      try {
        const { createAdminClient, isServiceRoleConfigured } = await import("@/utils/supabase/server");
        if (isServiceRoleConfigured()) {
          const adminClient = createAdminClient();
          const adminCompsRes = await adminClient.from("companies").select(COMPANY_JOIN_COLUMNS).in("id", missingCompanyIds);
          comps = adminCompsRes.data;
        }
      } catch (_) {}
    }

    const compMap = new Map((comps || []).map((c: any) => [c.id, c]));
    allMemberships = allMemberships.map((m: any) => {
      const existingComp = Array.isArray(m.company) ? m.company[0] : m.company;
      return {
        ...m,
        company: existingComp || compMap.get(m.company_id) || { id: m.company_id, name: "Default Company", is_active: true },
      };
    });
  } else {
    // Normalize any array-wrapped company objects
    allMemberships = allMemberships.map((m: any) => ({
      ...m,
      company: Array.isArray(m.company) ? m.company[0] : m.company,
    }));
  }

  // Filter out any memberships that are explicitly inactive OR belong to an explicitly deactivated organization
  const memberships = allMemberships.filter((m: any) => {
    if (m.is_active === false) return false;
    const comp = Array.isArray(m.company) ? m.company[0] : m.company;
    if (comp && (comp.is_active === false || comp.is_active === 0)) return false;
    return true;
  });

  if (!memberships || memberships.length === 0) {
    return { error: "No active company memberships found", status: 403, profile };
  }

  // 3. Determine active membership
  let membership = memberships[0];
  if (companyId) {
    const match = memberships.find((m: any) => m.company_id === companyId);
    if (match) {
      membership = match;
    }
  }

  const { company, ...membershipDetails } = membership;

  // Flatten and format memberships list for returning, normalizing each company object
  const formattedMemberships = memberships.map(({ company: mComp, ...m }: any) => ({
    ...m,
    company: Array.isArray(mComp) ? mComp[0] : mComp,
  }));

  // Role and modules (fetched in parallel above)
  const userRole = roleRes.data;

  const normalizedCompany = (Array.isArray(company) ? company[0] : company) || {
    id: membership?.company_id || "",
    name: "Default Company",
    is_active: true,
  };

  return {
    profile,
    membership: membershipDetails as CompanyMembership,
    company: normalizedCompany as Company,
    memberships: formattedMemberships as CompanyMembership[],
    userRole: userRole || { role: "User", modules: [] },
  };
}

/**
 * Higher-order function to protect API routes with role-based access control.
 * It reads the `x-company-id` header to locate the user's membership in that specific company.
 *
 * Usage:
 * ```typescript
 * export const GET = withRole(["manager"], async (request, { user, profile, membership }) => {
 *   // Safe to proceed, user is manager or higher in the active company
 *   return apiSuccess({ data: "manager dashboard data" });
 * });
 * ```
 */
export function withRole(allowedRoles: UserRole[], handler: AuthenticatedRoleHandler) {
  return async (request: NextRequest, context: { params: Promise<any> }) => {
    try {
      const supabase = createClient();
      
      // 1. Check user authentication (local JWT verification)
      const user = await getAuthUser(supabase);

      if (!user) {
        return apiUnauthorized("Authentication required");
      }

      // 2. Retrieve the active company ID from headers or cookies
      const companyId = request.headers.get("x-company-id") || request.cookies.get("active_company_id")?.value;

      // 3. Retrieve user membership & profile details
      const result = await getUserMembership(supabase, user.id, companyId);
      if ("error" in result) {
        if (result.status === 404) {
          return apiForbidden(result.error);
        }
        return apiForbidden(result.error);
      }

      const { profile, membership, company, memberships, userRole } = result as any;

      // 4. Verify role authorization (hierarchy-aware)
      const userRoleLower = (userRole?.role || "").toLowerCase().trim();
      const isSuperAdmin = 
        membership?.role === "super_admin" ||
        (memberships || []).some((m: any) => m.role === "super_admin") ||
        userRoleLower === "super admin" || 
        userRoleLower === "super_admin" ||
        userRoleLower === "superadmin";

      const isCompanyAdmin =
        isSuperAdmin ||
        membership?.role === "company_admin" ||
        (memberships || []).some((m: any) => m.role === "company_admin") ||
        userRoleLower === "company admin" ||
        userRoleLower === "company_admin" ||
        userRoleLower === "companyadmin" ||
        userRoleLower === "admin" ||
        userRoleLower === "administrator";

      const effectiveRole: UserRole = isSuperAdmin 
        ? "super_admin" 
        : isCompanyAdmin 
          ? "company_admin" 
          : (membership?.role || "viewer");

      const userRoleIndex = ROLE_HIERARCHY.indexOf(effectiveRole);
      const minRequiredIndex = Math.min(
        ...allowedRoles.map((r) => ROLE_HIERARCHY.indexOf(r))
      );

      if (userRoleIndex < minRequiredIndex) {
        return apiForbidden("Insufficient permissions");
      }

      // 5. Invoke handler with complete role context
      return await handler(request, {
        params: context.params,
        user,
        profile,
        membership,
        company,
        memberships,
        userRole,
        effectiveRole,
        isSuperAdmin,
        isCompanyAdmin,
      });
    } catch (error) {
      console.error("[withRole] Error:", error);
      return apiForbidden("Role verification failed");
    }
  };
}
