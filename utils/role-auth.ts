import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { apiUnauthorized, apiForbidden } from "@/utils/api-response";
import { User } from "@supabase/supabase-js";

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

export interface AuthenticatedRoleContext {
  params: Promise<any>;
  user: User;
  profile: Profile;
  membership: CompanyMembership;
  company: Company;
  memberships: CompanyMembership[];
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
  // 1. Get profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return { error: "Profile not found", status: 404 };
  }

  if (!profile.is_active) {
    return { error: "User profile is inactive", status: 403 };
  }

  // Time-based login restriction check
  if (profile.login_restriction_type === 'scheduled') {
    try {
      const tz = profile.timezone || 'Asia/Kuala_Lumpur';
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour12: false,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      
      const parts = formatter.formatToParts(new Date());
      const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
      
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

  // 2. Get memberships
  const { data: memberships, error: membershipsError } = await supabase
    .from("company_memberships")
    .select("*, company:companies(*)")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (membershipsError || !memberships || memberships.length === 0) {
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

  // Flatten and format memberships list for returning
  const formattedMemberships = memberships.map(({ company: _, ...m }: any) => m);

  // Fetch the user's role and modules from user_roles
  const { data: userRole } = await supabase
    .from("user_roles")
    .select("role, modules")
    .eq("user_id", userId)
    .maybeSingle();

  return {
    profile,
    membership: membershipDetails as CompanyMembership,
    company: company as Company,
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
      
      // 1. Check user authentication
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return apiUnauthorized("Authentication required");
      }

      // 2. Retrieve the active company ID from headers
      const companyId = request.headers.get("x-company-id");

      // 3. Retrieve user membership & profile details
      const result = await getUserMembership(supabase, user.id, companyId);
      if ("error" in result) {
        if (result.status === 404) {
          return apiForbidden(result.error);
        }
        return apiForbidden(result.error);
      }

      const { profile, membership, company, memberships } = result;

      // 4. Verify role authorization (hierarchy-aware)
      const userRoleIndex = ROLE_HIERARCHY.indexOf(membership.role);
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
      });
    } catch (error) {
      console.error("[withRole] Error:", error);
      return apiForbidden("Role verification failed");
    }
  };
}
