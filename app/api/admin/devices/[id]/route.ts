import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { withRole } from "@/utils/role-auth";
import { apiSuccess, apiError, apiNoContent } from "@/utils/api-response";

/**
 * PATCH /api/admin/devices/[id]
 * Toggles a device's active status.
 * Protected: super_admin or company_admin only.
 */
export const PATCH = withRole(
  ["super_admin", "company_admin"],
  async (request, { params, company }) => {
    try {
      const { id } = await params;
      const json = await request.json();
      const { is_active } = json;

      if (is_active === undefined) {
        return apiError("is_active status is required", 400);
      }

      const supabase = createClient() as any;

      const { data: updatedDevice, error } = await supabase
        .from("registered_devices")
        .update({ is_active })
        .eq("id", id)
        .eq("company_id", company.id) // Scope to company
        .select()
        .single();

      if (error) {
        console.error("[PATCH /api/admin/devices/[id]] Database error:", error);
        return apiError("Failed to update device status", 500);
      }

      return apiSuccess(updatedDevice);
    } catch (error) {
      console.error("[PATCH /api/admin/devices/[id]] Error:", error);
      return apiError("Internal server error", 500);
    }
  }
);

/**
 * DELETE /api/admin/devices/[id]
 * Revokes / deletes a device registration.
 * Protected: super_admin or company_admin only.
 */
export const DELETE = withRole(
  ["super_admin", "company_admin"],
  async (request, { params, company }) => {
    try {
      const { id } = await params;
      const supabase = createClient() as any;

      const { error } = await supabase
        .from("registered_devices")
        .delete()
        .eq("id", id)
        .eq("company_id", company.id); // Scope to company

      if (error) {
        console.error("[DELETE /api/admin/devices/[id]] Database error:", error);
        return apiError("Failed to revoke device registration", 500);
      }

      return apiNoContent();
    } catch (error) {
      console.error("[DELETE /api/admin/devices/[id]] Error:", error);
      return apiError("Internal server error", 500);
    }
  }
);
