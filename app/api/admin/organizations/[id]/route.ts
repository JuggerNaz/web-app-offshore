import { NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import { withRole } from "@/utils/role-auth";
import {
  apiSuccess,
  apiError,
  apiNotFound,
  apiBadRequest,
  apiNoContent,
} from "@/utils/api-response";

/**
 * GET /api/admin/organizations/[id]
 * Get a single organization with member details. Super admin only.
 */
export const GET = withRole(["super_admin"], async (request, { params }) => {
  try {
    const { id } = await params;
    const adminClient = createAdminClient();

    const { data, error } = await (adminClient as any)
      .from("companies")
      .select(
        `
        *,
        company_memberships(
          id,
          user_id,
          role,
          is_active,
          created_at,
          user:profiles!user_id(id, email, full_name, designation)
        )
      `
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      return apiNotFound("Organization not found");
    }

    return apiSuccess(data);
  } catch (error) {
    console.error("[GET /api/admin/organizations/[id]] Error:", error);
    return apiError("Internal server error", 500);
  }
});

/**
 * PATCH /api/admin/organizations/[id]
 * Update an organization. Super admin only.
 */
export const PATCH = withRole(
  ["super_admin"],
  async (request, { params }) => {
    try {
      const { id } = await params;
      const json = await request.json();
      const adminClient = createAdminClient();

      const updates: Record<string, any> = {};
      const allowedFields = [
        "name",
        "slug",
        "description",
        "logo_url",
        "is_active",
        "max_users",
        "subscription_plan",
        "settings",
      ];

      for (const field of allowedFields) {
        if (json[field] !== undefined) {
          updates[field] = json[field];
        }
      }

      if (Object.keys(updates).length === 0) {
        return apiBadRequest("No valid fields to update");
      }

      updates.updated_at = new Date().toISOString();

      const { data, error } = await (adminClient as any)
        .from("companies")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error(
          "[PATCH /api/admin/organizations/[id]] DB Error:",
          error
        );
        if (error.code === "23505") {
          return apiBadRequest("An organization with this slug already exists");
        }
        return apiError("Failed to update organization", 500);
      }

      if (!data) {
        return apiNotFound("Organization not found");
      }

      return apiSuccess(data);
    } catch (error) {
      console.error("[PATCH /api/admin/organizations/[id]] Error:", error);
      return apiError("Internal server error", 500);
    }
  }
);

/**
 * DELETE /api/admin/organizations/[id]
 * Deactivate (soft-delete) an organization. Super admin only.
 */
export const DELETE = withRole(
  ["super_admin"],
  async (request, { params }) => {
    try {
      const { id } = await params;
      const adminClient = createAdminClient();

      const { data: org } = await (adminClient as any)
        .from("companies")
        .select("id, is_active")
        .eq("id", id)
        .single();

      if (!org) {
        return apiNotFound("Organization not found");
      }

      const { error } = await (adminClient as any)
        .from("companies")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) {
        console.error(
          "[DELETE /api/admin/organizations/[id]] DB Error:",
          error
        );
        return apiError("Failed to deactivate organization", 500);
      }

      return apiNoContent();
    } catch (error) {
      console.error("[DELETE /api/admin/organizations/[id]] Error:", error);
      return apiError("Internal server error", 500);
    }
  }
);
