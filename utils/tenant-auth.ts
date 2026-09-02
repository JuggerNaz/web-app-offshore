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
import { getUserMembership } from "./role-auth";

export interface TenantContext {
  params: Promise<any>;
  user: AuthUser;
  profile: Profile;
  membership: CompanyMembership;
  company: Company;
  memberships: CompanyMembership[];
  companyId: string;
}

type TenantHandler = (
  request: NextRequest,
  context: TenantContext
) => Promise<NextResponse> | NextResponse;

export interface TenantContextPartial {
  params: Promise<any>;
  user: AuthUser;
  companyId: string;
}

type TenantPartialHandler = (
  request: NextRequest,
  context: TenantContextPartial
) => Promise<NextResponse> | NextResponse;

/**
 * Full tenant-aware HOF: authenticates user, resolves active company,
 * and provides companyId for data filtering.
 * Super admins get their active company context. Regular users are scoped to their company.
 */
export function withTenant(handler: TenantHandler) {
  return async (request: NextRequest, context: { params: Promise<any> }) => {
    try {
      const supabase = createClient();

      const user = await getAuthUser(supabase);
      if (!user) {
        return apiUnauthorized("Authentication required");
      }

      const companyId = request.headers.get("x-company-id");

      const result = await getUserMembership(supabase, user.id, companyId);
      if ("error" in result) {
        return apiForbidden(result.error);
      }

      const { profile, membership, company, memberships } = result;

      return await handler(request, {
        params: context.params,
        user,
        profile,
        membership,
        company,
        memberships,
        companyId: company.id,
      });
    } catch (error) {
      console.error("[withTenant] Error:", error);
      return apiForbidden("Tenant resolution failed");
    }
  };
}

/**
 * Lightweight tenant HOF: authenticates user and resolves companyId only.
 * Use when you don't need full profile/membership data.
 */
export function withTenantLight(handler: TenantPartialHandler) {
  return async (request: NextRequest, context: { params: Promise<any> }) => {
    try {
      const supabase = createClient();

      const user = await getAuthUser(supabase);
      if (!user) {
        return apiUnauthorized("Authentication required");
      }

      const companyId = request.headers.get("x-company-id");

      let resolvedCompanyId = companyId;

      if (!resolvedCompanyId) {
        const { data: membership } = await (supabase as any)
          .from("company_memberships")
          .select("company_id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        resolvedCompanyId = membership?.company_id || undefined;
      }

      if (!resolvedCompanyId) {
        return apiForbidden("No active company membership found");
      }

      return await handler(request, {
        params: context.params,
        user,
        companyId: resolvedCompanyId,
      });
    } catch (error) {
      console.error("[withTenantLight] Error:", error);
      return apiForbidden("Tenant resolution failed");
    }
  };
}
