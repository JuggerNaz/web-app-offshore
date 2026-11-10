// Touch to trigger Next.js route compilation
import { NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { withRole } from "@/utils/role-auth";
import { apiSuccess, apiError, apiNoContent } from "@/utils/api-response";

/**
 * PATCH /api/admin/users/[id]
 * Updates user membership role or active status. Scoped to the active company.
 * Prevents admins from locking themselves out or changing their own roles.
 */
export const PATCH = withRole(
  ["company_admin", "super_admin"],
  async (request, { params, company, user }) => {
    try {
      const { id } = await params;
      const json = await request.json();
      const { 
        role, 
        is_active, 
        systemRole, 
        modules, 
        login_restriction_type, 
        allowed_start_time, 
        allowed_end_time, 
        allowed_days, 
        timezone, 
        device_restriction_type,
        allowed_start_date,
        allowed_end_date,
      } = json;

      const supabase = createClient() as any;
      let db = supabase;
      try {
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
          db = createAdminClient() as any;
        }
      } catch (e) {
        console.warn("[PATCH /api/admin/users/[id]] SUPABASE_SERVICE_ROLE_KEY not configured. Falling back to session client.");
      }

      // Retrieve the target membership first
      const { data: targetMembership, error: fetchError } = await db
        .from("company_memberships")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError || !targetMembership) {
        return apiError("Membership record not found", 404);
      }

      // Check self-modification safety
      if (targetMembership.user_id === user.id) {
        return apiError("You cannot modify your own membership details", 400);
      }

      const updateData: any = {};
      if (role !== undefined) updateData.role = role;
      if (is_active !== undefined) updateData.is_active = is_active;

      // Handle profile updates (scheduling fields & active status)
      const profileUpdate: any = {};
      if (is_active !== undefined) profileUpdate.is_active = is_active;
      if (login_restriction_type !== undefined) profileUpdate.login_restriction_type = login_restriction_type;
      if (allowed_start_time !== undefined) profileUpdate.allowed_start_time = allowed_start_time;
      if (allowed_end_time !== undefined) profileUpdate.allowed_end_time = allowed_end_time;
      if (allowed_days !== undefined) profileUpdate.allowed_days = allowed_days;
      if (timezone !== undefined) profileUpdate.timezone = timezone;
      if (device_restriction_type !== undefined) profileUpdate.device_restriction_type = device_restriction_type;
      if (allowed_start_date !== undefined) profileUpdate.allowed_start_date = allowed_start_date || null;
      if (allowed_end_date !== undefined) profileUpdate.allowed_end_date = allowed_end_date || null;

      if (Object.keys(profileUpdate).length > 0) {
        const targetUserId = targetMembership.user_id;

        let { data: updatedRows, error: profileError } = await db
          .from("profiles")
          .update(profileUpdate)
          .eq("id", targetUserId)
          .select("id");

        if (profileError && (profileError.message?.includes("allowed_start_date") || profileError.message?.includes("allowed_end_date"))) {
          console.warn("[PATCH /api/admin/users/[id]] Date columns not yet on profiles, updating without date fields");
          const fallbackUpdate = { ...profileUpdate };
          delete fallbackUpdate.allowed_start_date;
          delete fallbackUpdate.allowed_end_date;
          const retryRes = await db
            .from("profiles")
            .update(fallbackUpdate)
            .eq("id", targetUserId)
            .select("id");
          updatedRows = retryRes.data;
          profileError = retryRes.error;
        }

        if (!profileError && (!updatedRows || updatedRows.length === 0)) {
          // Row might be missing in profiles: upsert to ensure it exists with the configured values
          await db
            .from("profiles")
            .upsert({
              id: targetUserId,
              ...profileUpdate,
              updated_at: new Date().toISOString(),
            });
        } else if (profileError) {
          console.warn("[PATCH /api/admin/users/[id]] Profile update error:", profileError);
        }
      }

      // Handle user_roles update
      if (systemRole !== undefined || modules !== undefined) {
        const targetUserId = targetMembership.user_id;
        
        // Fetch current to merge/fallback
        const { data: currentRoleRow } = await db
          .from("user_roles")
          .select("role, modules")
          .eq("user_id", targetUserId)
          .maybeSingle();
          
        const newSystemRole = systemRole !== undefined ? systemRole : (currentRoleRow?.role || "User");
        const newModules = modules !== undefined ? modules : (currentRoleRow?.modules || []);

        const { error: roleError } = await db
          .from("user_roles")
          .upsert({
            user_id: targetUserId,
            role: newSystemRole,
            modules: newModules,
            updated_at: new Date().toISOString()
          }, { onConflict: "user_id" });

        if (roleError) {
          console.error("[PATCH /api/admin/users/[id]] user_roles update error:", roleError);
        }
      }

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await db
          .from("company_memberships")
          .update(updateData)
          .eq("id", id)
          .eq("company_id", company.id); // Ensure scoped to active company

        if (updateError) {
          console.error("[PATCH /api/admin/users/[id]] Update Error:", updateError);
          return apiError("Failed to update membership", 500);
        }
      }

      // Re-fetch the full membership along with profiles and user_roles to return it correctly
      const { data: finalMembership, error: finalError } = await db
        .from("company_memberships")
        .select(`
          id,
          user_id,
          company_id,
          role,
          is_active,
          created_at,
          user:profiles!user_id(*)
        `)
        .eq("id", id)
        .single();

      if (finalError || !finalMembership) {
        return apiError("Failed to retrieve updated member info", 500);
      }

      // Fetch user role and full profile directly to ensure all scheduling & restriction fields are present
      const [userRoleRes, updatedProfileRes] = await Promise.all([
        db
          .from("user_roles")
          .select("role, modules")
          .eq("user_id", finalMembership.user_id)
          .maybeSingle(),
        db
          .from("profiles")
          .select("*")
          .eq("id", finalMembership.user_id)
          .maybeSingle(),
      ]);

      const rawUser = finalMembership.user;
      const normalizedUser = (Array.isArray(rawUser) ? rawUser[0] : rawUser) || {};
      const fullProfile = updatedProfileRes.data || {};

      const responseData = {
        ...finalMembership,
        user: {
          ...normalizedUser,
          ...fullProfile,
        },
        systemRole: userRoleRes.data?.role || "User",
        modules: userRoleRes.data?.modules || [],
      };

      return apiSuccess(responseData);
    } catch (error: any) {
      console.error("[PATCH /api/admin/users/[id]] Error:", error);
      return apiError("Internal server error", 500);
    }
  }
);

/**
 * GET /api/admin/users/[id]
 * Retrieves fresh user membership, full profile and system role/modules.
 */
export const GET = withRole(
  ["company_admin", "super_admin"],
  async (request, { params, company }) => {
    try {
      const { id } = await params;
      const supabase = createClient() as any;
      let db = supabase;
      try {
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
          db = createAdminClient() as any;
        }
      } catch (_) {}

      const { data: membership, error: memError } = await db
        .from("company_memberships")
        .select(`
          id,
          user_id,
          company_id,
          role,
          is_active,
          created_at,
          updated_at,
          user:profiles!user_id(*)
        `)
        .eq("id", id)
        .eq("company_id", company.id)
        .single();

      if (memError || !membership) {
        return apiError("Membership not found", 404);
      }

      const [roleRes, profileRes] = await Promise.all([
        db.from("user_roles").select("role, modules").eq("user_id", membership.user_id).maybeSingle(),
        db.from("profiles").select("*").eq("id", membership.user_id).maybeSingle(),
      ]);

      const rawUser = Array.isArray(membership.user) ? membership.user[0] : membership.user;
      const responseData = {
        ...membership,
        user: {
          ...(rawUser || {}),
          ...(profileRes.data || {}),
        },
        systemRole: roleRes.data?.role || "User",
        modules: roleRes.data?.modules || [],
      };

      return apiSuccess(responseData);
    } catch (error: any) {
      console.error("[GET /api/admin/users/[id]] Error:", error);
      return apiError("Internal server error", 500);
    }
  }
);

/**
 * DELETE /api/admin/users/[id]
 * Soft deletes / deactivates a user membership in the active company.
 * Prevents self-deactivation.
 */
export const DELETE = withRole(
  ["company_admin", "super_admin"],
  async (request, { params, company, user }) => {
    try {
      const { id } = await params;
      const supabase = createClient() as any;
      let db = supabase;
      try {
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
          db = createAdminClient() as any;
        }
      } catch (e) {
        console.warn("[DELETE /api/admin/users/[id]] SUPABASE_SERVICE_ROLE_KEY not configured. Falling back to session client.");
      }

      // Retrieve the target membership first
      const { data: targetMembership, error: fetchError } = await db
        .from("company_memberships")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError || !targetMembership) {
        return apiError("Membership record not found", 404);
      }

      // Check self-deactivation safety
      if (targetMembership.user_id === user.id) {
        return apiError("You cannot deactivate your own membership", 400);
      }

      const { error: deleteError } = await db
        .from("company_memberships")
        .update({ is_active: false })
        .eq("id", id)
        .eq("company_id", company.id);

      if (deleteError) {
        console.error("[DELETE /api/admin/users/[id]] DB Error:", deleteError);
        return apiError("Failed to deactivate member", 500);
      }

      return apiNoContent();
    } catch (error: any) {
      console.error("[DELETE /api/admin/users/[id]] Error:", error);
      return apiError("Internal server error", 500);
    }
  }
);
