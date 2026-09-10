import { NextRequest } from "next/server";
import { createAdminClient, createClient } from "@/utils/supabase/server";
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
      
      let clientToUse: any;
      try {
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
          clientToUse = createAdminClient();
        } else {
          clientToUse = createClient();
        }
      } catch {
        clientToUse = createClient();
      }

      const updates: Record<string, any> = {};
      const allowedFields = [
        "name",
        "slug",
        "serial_no",
        "registration_no",
        "tax_id",
        "company_email",
        "contact_person",
        "contact_phone",
        "address",
        "country",
        "start_date",
        "end_date",
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

      let { data, error } = await clientToUse
        .from("companies")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error && error.message?.includes("row-level security")) {
        const sessionClient = createClient() as any;
        const fallback = await sessionClient
          .from("companies")
          .update(updates)
          .eq("id", id)
          .select()
          .single();
        data = fallback.data;
        error = fallback.error;
      }

      if (error) {
        console.error(
          "[PATCH /api/admin/organizations/[id]] DB Error:",
          error
        );
        if (error.code === "23505") {
          return apiBadRequest("An organization with this slug already exists");
        }
        return apiError("Failed to update organization: " + error.message, 500);
      }

      if (!data) {
        return apiNotFound("Organization not found");
      }

      return apiSuccess(data);
    } catch (error: any) {
      console.error("[PATCH /api/admin/organizations/[id]] Error:", error);
      return apiError("Internal server error: " + (error?.message || "unknown"), 500);
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
