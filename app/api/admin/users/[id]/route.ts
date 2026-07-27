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
      const { role, is_active, systemRole, modules, login_restriction_type, allowed_start_time, allowed_end_time, allowed_days, timezone, device_restriction_type } = json;

      const supabase = createClient() as any;

      // Retrieve the target membership first
      const { data: targetMembership, error: fetchError } = await supabase
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

      // Handle profile updates (scheduling fields)
      const profileUpdate: any = {};
      if (login_restriction_type !== undefined) profileUpdate.login_restriction_type = login_restriction_type;
      if (allowed_start_time !== undefined) profileUpdate.allowed_start_time = allowed_start_time;
      if (allowed_end_time !== undefined) profileUpdate.allowed_end_time = allowed_end_time;
      if (allowed_days !== undefined) profileUpdate.allowed_days = allowed_days;
      if (timezone !== undefined) profileUpdate.timezone = timezone;
      if (device_restriction_type !== undefined) profileUpdate.device_restriction_type = device_restriction_type;

      if (Object.keys(profileUpdate).length > 0) {
        const targetUserId = targetMembership.user_id;
        let clientToUse = supabase;
        let isUsingAdminClient = false;
        try {
          clientToUse = createAdminClient() as any;
          isUsingAdminClient = true;
        } catch (e) {
          console.warn("[PATCH /api/admin/users/[id]] SUPABASE_SERVICE_ROLE_KEY not configured. Falling back to session-based client.");
        }

        const { error: profileError } = await clientToUse
          .from("profiles")
          .update(profileUpdate)
          .eq("id", targetUserId);

        if (profileError) {
          console.error("[PATCH /api/admin/users/[id]] Profile update error:", profileError);
          const errorMsg = !isUsingAdminClient 
            ? "Failed to update user profile: RLS policy blocked the update. Please configure SUPABASE_SERVICE_ROLE_KEY in .env.local to enable admin overrides."
            : "Failed to update user profile schedule: " + profileError.message;
          return apiError(errorMsg, 500);
        }
      }

      // Handle user_roles update
      if (systemRole !== undefined || modules !== undefined) {
        const targetUserId = targetMembership.user_id;
        
        // Fetch current to merge/fallback
        const { data: currentRoleRow } = await supabase
          .from("user_roles")
          .select("role, modules")
          .eq("user_id", targetUserId)
          .maybeSingle();
          
        const newSystemRole = systemRole !== undefined ? systemRole : (currentRoleRow?.role || "User");
        const newModules = modules !== undefined ? modules : (currentRoleRow?.modules || []);

        const { error: roleError } = await supabase
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
        const { error: updateError } = await supabase
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
      const { data: finalMembership, error: finalError } = await supabase
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

      // Get user role information
      const { data: userRoleRow } = await supabase
        .from("user_roles")
        .select("role, modules")
        .eq("user_id", finalMembership.user_id)
        .maybeSingle();

      const responseData = {
        ...finalMembership,
        systemRole: userRoleRow?.role || "User",
        modules: userRoleRow?.modules || [],
      };

      return apiSuccess(responseData);
    } catch (error: any) {
      console.error("[PATCH /api/admin/users/[id]] Error:", error);
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

      // Retrieve the target membership first
      const { data: targetMembership, error: fetchError } = await supabase
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

      const { error: deleteError } = await supabase
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
