import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { withRole } from "@/utils/role-auth";
import { apiSuccess, apiError, apiCreated } from "@/utils/api-response";
import crypto from "crypto";

/**
 * GET /api/admin/devices
 * Lists all registered devices for the active company.
 * Protected: super_admin or company_admin only.
 */
export const GET = withRole(
  ["super_admin", "company_admin"],
  async (request, { company }) => {
    try {
      const supabase = createClient() as any;

      const { data: devices, error } = await supabase
        .from("registered_devices")
        .select(`
          id,
          device_name,
          is_active,
          created_at,
          registered_by,
          registrar:profiles!registered_by(full_name, email)
        `)
        .eq("company_id", company.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[GET /api/admin/devices] Database error:", error);
        return apiError("Failed to fetch registered devices", 500);
      }

      return apiSuccess(devices || []);
    } catch (error) {
      console.error("[GET /api/admin/devices] Error:", error);
      return apiError("Internal server error", 500);
    }
  }
);

/**
 * POST /api/admin/devices
 * Registers a new device token.
 * Protected: super_admin or company_admin only.
 */
export const POST = withRole(
  ["super_admin", "company_admin"],
  async (request, { company, user }) => {
    try {
      const json = await request.json();
      const { device_name } = json;

      if (!device_name) {
        return apiError("Device name is required", 400);
      }

      // Generate cryptographically secure token
      const device_token = crypto.randomBytes(32).toString("hex");

      const supabase = createClient() as any;
      const { data: newDevice, error } = await supabase
        .from("registered_devices")
        .insert({
          company_id: company.id,
          device_name,
          device_token,
          is_active: true,
          registered_by: user.id
        })
        .select()
        .single();

      if (error) {
        console.error("[POST /api/admin/devices] Database error:", error);
        return apiError("Failed to register device", 500);
      }

      // Return both the record and the raw token to the registrar
      return apiCreated({
        ...newDevice,
        device_token // Expose raw token only on creation so client can save it
      });
    } catch (error) {
      console.error("[POST /api/admin/devices] Error:", error);
      return apiError("Internal server error", 500);
    }
  }
);
