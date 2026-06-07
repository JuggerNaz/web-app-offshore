import { NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { withRole } from "@/utils/role-auth";
import {
  apiSuccess,
  apiCreated,
  apiError,
  apiNotFound,
  apiBadRequest,
} from "@/utils/api-response";

/**
 * GET /api/admin/organizations
 * List all organizations. Super admin only.
 */
export const GET = withRole(["super_admin"], async (request) => {
  try {
    const adminClient = createAdminClient();

    const { data, error } = await (adminClient as any)
      .from("companies")
      .select(`*, company_memberships(count)`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[GET /api/admin/organizations] DB Error:", error);
      return apiError("Failed to fetch organizations", 500);
    }

    const organizations = (data || []).map((org: any) => ({
      ...org,
      member_count: org.company_memberships?.[0]?.count || 0,
      company_memberships: undefined,
    }));

    return apiSuccess(organizations);
  } catch (error) {
    console.error("[GET /api/admin/organizations] Error:", error);
    return apiError("Internal server error", 500);
  }
});

/**
 * POST /api/admin/organizations
 * Create a new organization. Super admin only.
 */
export const POST = withRole(["super_admin"], async (request, { user }) => {
  try {
    let json: any;
    try {
      json = await request.json();
    } catch {
      return apiBadRequest("Invalid request body");
    }
    const { name, slug, description, max_users, subscription_plan } = json;

    if (!name || !slug) {
      return apiBadRequest("Name and slug are required");
    }

    const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugPattern.test(slug)) {
      return apiBadRequest(
        "Slug must be lowercase, alphanumeric, separated by hyphens"
      );
    }

    let adminClient;
    try {
      adminClient = createAdminClient();
    } catch (err) {
      console.error("[POST /api/admin/organizations] Admin client error:", err);
      return apiError("Server configuration error", 500);
    }

    const insertData: Record<string, any> = {
      name,
      slug,
    };
    if (description) insertData.description = description;
    if (max_users) insertData.max_users = max_users;
    if (subscription_plan) insertData.subscription_plan = subscription_plan;

    const { data, error } = await (adminClient as any)
      .from("companies")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("[POST /api/admin/organizations] DB Error:", error);
      if (error.code === "23505") {
        return apiBadRequest("An organization with this slug already exists");
      }
      return apiError(`Failed to create organization: ${error.message}`, 500);
    }

    return apiCreated(data);
  } catch (error: any) {
    console.error("[POST /api/admin/organizations] Error:", error);
    return apiError(`Internal server error: ${error.message || "unknown"}`, 500);
  }
});
