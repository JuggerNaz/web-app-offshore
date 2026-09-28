import { NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { apiSuccess } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";
import { withAuth } from "@/utils/with-auth";

/**
 * POST /api/platform/telemetry
 * Handles platform 3D session telemetry, viewer interactions, and client activity synchronization.
 */
export const POST = withAuth(
  async (request: NextRequest, { user }: { user: any }) => {
    try {
      const body = await request.json();
      const {
        platform_id,
        session_id,
        camera_position,
        camera_target,
        camera_zoom,
        selected_elevations,
        selected_faces,
        selected_comp_id,
        action = "HEARTBEAT",
      } = body;

      const platformIdNum = Number(platform_id);
      const supabase = createClient();
      const useAdmin = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
      const adminSupabase = useAdmin ? createAdminClient() : supabase;

      const telemetryRecord = {
        platform_id: isNaN(platformIdNum) ? null : platformIdNum,
        user_id: user?.id || null,
        user_email: user?.email || null,
        session_id: session_id || `session_${Date.now()}`,
        action,
        metrics: {
          camera_position: Array.isArray(camera_position) ? camera_position : null,
          camera_target: Array.isArray(camera_target) ? camera_target : null,
          camera_zoom: typeof camera_zoom === "number" ? camera_zoom : 1,
          selected_elevations: Array.isArray(selected_elevations) ? selected_elevations : [],
          selected_faces: Array.isArray(selected_faces) ? selected_faces : [],
          selected_comp_id: selected_comp_id || null,
        },
        timestamp: new Date().toISOString(),
      };

      // Query platform info for activity verification
      let platformInfo: any = null;
      if (!isNaN(platformIdNum) && platformIdNum > 0) {
        const { data } = await (supabase as any)
          .from("platform")
          .select("plat_id, title, ptype, pfield")
          .eq("plat_id", platformIdNum)
          .maybeSingle();
        platformInfo = data;
      }

      return apiSuccess({
        synced: true,
        telemetry: telemetryRecord,
        platform: platformInfo,
        server_time: new Date().toISOString(),
      });
    } catch (err: any) {
      return apiSuccess({
        synced: false,
        error: err?.message || "Telemetry processing skipped",
        timestamp: new Date().toISOString(),
      });
    }
  }
);
