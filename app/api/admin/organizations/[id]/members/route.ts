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

function getClient() {
  try {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return createAdminClient();
    }
  } catch {
    // fallback
  }
  return createClient();
}

/**
 * GET /api/admin/organizations/[id]/members
 * Returns members of the organization. If ?available=true, also returns all active profiles.
 */
export const GET = withRole(
  ["super_admin"],
  async (request, { params }) => {
    try {
      const { id } = await params;
      const client = getClient() as any;
      const url = new URL(request.url);
      const includeAvailable = url.searchParams.get("available") === "true";

      const { data, error } = await client
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
        return apiError("Failed to fetch members: " + error.message, 500);
      }

      let availableProfiles: any[] = [];
      if (includeAvailable) {
        const { data: profiles } = await client
          .from("profiles")
          .select("id, email, full_name, designation, avatar_url")
          .order("full_name", { ascending: true });
        availableProfiles = profiles || [];
      }

      return apiSuccess({
        members: data || [],
        available_profiles: availableProfiles,
      });
    } catch (error: any) {
      console.error(
        "[GET /api/admin/organizations/[id]/members] Error:",
        error
      );
      return apiError("Internal server error: " + (error?.message || "unknown"), 500);
    }
  }
);

/**
 * POST /api/admin/organizations/[id]/members
 * 1. If { sync_all: true } -> connects all system profiles to this company.
 * 2. If { user_id, role } -> adds/updates a single member.
 */
export const POST = withRole(
  ["super_admin"],
  async (request, { params, user }) => {
    try {
      const { id } = await params;
      let json: any;
      try {
        json = await request.json();
      } catch {
        return apiBadRequest("Invalid JSON body");
      }

      const client = getClient() as any;

      // Verify org exists
      const { data: org, error: orgErr } = await client
        .from("companies")
        .select("id, name")
        .eq("id", id)
        .single();

      if (orgErr || !org) {
        return apiNotFound("Organization not found");
      }

      // Option A: Batch sync all profiles to this organization
      if (json.sync_all === true) {
        const { data: allProfiles, error: pErr } = await client
          .from("profiles")
          .select("id, email");

        if (pErr) {
          return apiError("Failed to load profiles: " + pErr.message, 500);
        }

        if (!allProfiles || allProfiles.length === 0) {
          return apiSuccess({ message: "No profiles found to sync", count: 0 });
        }

        const defaultRole = json.default_role || "viewer";
        const upsertPayload = allProfiles.map((p: any) => ({
          user_id: p.id,
          company_id: id,
          role: p.id === user.id ? "super_admin" : defaultRole,
          is_active: true,
          invited_by: user.id,
          updated_at: new Date().toISOString(),
        }));

        const { error: batchErr } = await client
          .from("company_memberships")
          .upsert(upsertPayload, { onConflict: "user_id,company_id" });

        if (batchErr) {
          console.error("[POST /api/admin/organizations/[id]/members] Sync all error:", batchErr);
          return apiError("Failed to sync users: " + batchErr.message, 500);
        }

        return apiSuccess({
          message: `Successfully connected ${upsertPayload.length} users to ${org.name}`,
          count: upsertPayload.length,
        });
      }

      // Option B: Add single user
      const { user_id, role } = json;
      if (!user_id) {
        return apiBadRequest("User ID is required");
      }

      const { data, error } = await client
        .from("company_memberships")
        .upsert(
          {
            user_id,
            company_id: id,
            role: role || "viewer",
            is_active: true,
            invited_by: user.id,
            updated_at: new Date().toISOString(),
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
        return apiError("Failed to add member: " + error.message, 500);
      }

      return apiCreated(data);
    } catch (error: any) {
      console.error(
        "[POST /api/admin/organizations/[id]/members] Error:",
        error
      );
      return apiError("Internal server error: " + (error?.message || "unknown"), 500);
    }
  }
);
