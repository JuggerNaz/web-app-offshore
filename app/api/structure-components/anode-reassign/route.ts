import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient, isServiceRoleConfigured } from "@/utils/supabase/server";
import { apiSuccess } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";
import { withAuth } from "@/utils/with-auth";

/**
 * POST /api/structure-components/anode-reassign
 * Atomically handles accidental Wrong-QID selection on an ANMAIN inspection record:
 * 1. Losslessly rolls back the wrongly selected anode's spec & prior inspection records
 * 2. Reassigns insp_records, AI image analysis, and video logs to the new component
 *    (attachments, insp_media, and insp_anomalies follow insp_id automatically)
 * 3. Archives the new anode QID's old spec and applies the new anode spec (if replaced = true)
 */
export const POST = withAuth(
  async (request: NextRequest, { user }: { user: any }) => {
    const supabase = createClient();
    const db = isServiceRoleConfigured() ? createAdminClient() : supabase;

    const body = await request.json().catch(() => ({}));
    const {
      inspId,
      oldComponentId,
      newComponentId,
      newSpec = {},
      replaced = true,
      replacedDate,
      jobpackId = null,
      jobpackName = null,
      remarks = null,
      clientLocalDate = null,
      clientTimestamp = null,
      clientLocalTime = null,
      clientTimezone = null,
    } = body;

    if (!inspId || !oldComponentId || !newComponentId) {
      return NextResponse.json(
        { error: "inspId, oldComponentId, and newComponentId are required." },
        { status: 400 }
      );
    }

    const cleanDate =
      replacedDate && /^\d{4}-\d{2}-\d{2}/.test(String(replacedDate))
        ? String(replacedDate).slice(0, 10)
        : clientLocalDate && /^\d{4}-\d{2}-\d{2}/.test(String(clientLocalDate))
        ? String(clientLocalDate).slice(0, 10)
        : new Date().toISOString().slice(0, 10);

    const { data, error } = await (db as any).rpc("fn_reassign_anmain_component", {
      p_insp_id: Number(inspId),
      p_old_component_id: Number(oldComponentId),
      p_new_component_id: Number(newComponentId),
      p_new_spec: newSpec,
      p_replaced: Boolean(replaced),
      p_replaced_date: cleanDate,
      p_jobpack_id: jobpackId ? Number(jobpackId) : null,
      p_jobpack_name: jobpackName || null,
      p_remarks: remarks || null,
      p_user: user?.email || user?.id || null,
      p_client_timestamp: clientTimestamp || null,
      p_client_local_time: clientLocalTime || null,
      p_client_timezone: clientTimezone || null,
    });

    if (error) {
      return handleSupabaseError(error, "Failed to reassign ANMAIN component and roll back old anode");
    }

    return apiSuccess(data);
  }
);
