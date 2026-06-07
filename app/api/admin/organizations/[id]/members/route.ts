import { NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import { withRole } from "@/utils/role-auth";
import {
  apiSuccess,
  apiCreated,
  apiError,
  apiNotFound,
  apiBadRequest,
} from "@/utils/api-response";

export const GET = withRole(
  ["super_admin"],
  async (request, { params }) => {
    try {
      const { id } = await params;
      const adminClient = createAdminClient() as any;

      const { data, error } = await adminClient
        .from("company_memberships")
        .select(
          `
          id,
          user_id,
          company_id,
          role,
          is_active,
          invited_by,
          created_at,
          updated_at,
          user:profiles!user_id(id, email, full_name, designation, avatar_url)
        `
        )
        .eq("company_id", id)
        .order("created_at", { ascending: true });

      if (error) {
        console.error(
          "[GET /api/admin/organizations/[id]/members] DB Error:",
          error
        );
        return apiError("Failed to fetch members", 500);
      }

      return apiSuccess(data || []);
    } catch (error) {
      console.error(
        "[GET /api/admin/organizations/[id]/members] Error:",
        error
      );
      return apiError("Internal server error", 500);
    }
  }
);

export const POST = withRole(
  ["super_admin"],
  async (request, { params, user }) => {
    try {
      const { id } = await params;
      const json = await request.json();
      const { user_id, role } = json;

      if (!user_id) {
        return apiBadRequest("User ID is required");
      }

      const adminClient = createAdminClient() as any;

      const { data: org } = await adminClient
        .from("companies")
        .select("id")
        .eq("id", id)
        .single();

      if (!org) {
        return apiNotFound("Organization not found");
      }

      const { data, error } = await adminClient
        .from("company_memberships")
        .upsert(
          {
            user_id,
            company_id: id,
            role: role || "viewer",
            is_active: true,
            invited_by: user.id,
          },
          { onConflict: "user_id,company_id" }
        )
        .select(
          `
          id,
          user_id,
          company_id,
          role,
          is_active,
          created_at,
          user:profiles!user_id(id, email, full_name, designation)
        `
        )
        .single();

      if (error) {
        console.error(
          "[POST /api/admin/organizations/[id]/members] DB Error:",
          error
        );
        return apiError("Failed to add member", 500);
      }

      return apiCreated(data);
    } catch (error) {
      console.error(
        "[POST /api/admin/organizations/[id]/members] Error:",
        error
      );
      return apiError("Internal server error", 500);
    }
  }
);
