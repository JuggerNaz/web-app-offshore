import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
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
      const { role, is_active } = json;

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

      if (Object.keys(updateData).length === 0) {
        return apiError("No update parameters provided", 400);
      }

      const { data: updated, error: updateError } = await supabase
        .from("company_memberships")
        .update(updateData)
        .eq("id", id)
        .eq("company_id", company.id) // Ensure scoped to active company
        .select(`
          id,
          user_id,
          company_id,
          role,
          is_active,
          created_at,
          user:profiles!user_id(*)
        `)
        .single();

      if (updateError) {
        console.error("[PATCH /api/admin/users/[id]] Update Error:", updateError);
        return apiError("Failed to update membership", 500);
      }

      return apiSuccess(updated);
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
