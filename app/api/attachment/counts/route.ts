import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { withTenant } from "@/utils/tenant-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/attachment/counts
 * Returns total attachment counts grouped by platform_id:
 * {
 *   [platform_id: number]: number
 * }
 * Aggregates:
 *  1. Direct platform attachments (source_type = 'platform')
 *  2. Component attachments belonging to the platform (source_type = 'component')
 *  3. Inspection attachments belonging to the platform (source_type = 'inspection')
 *  4. Insp_media photos/videos belonging to the platform
 */
export const GET = withTenant(async (request: NextRequest, { companyId }) => {
  const useAdmin = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = useAdmin ? createAdminClient() : createClient();

  try {
    // Helper to chunk arrays
    const chunkArray = <T>(arr: T[], size = 300): T[][] => {
      const chunks: T[][] = [];
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
      }
      return chunks;
    };

    // 1. Direct platform attachments
    let platAttQuery = (supabase as any)
      .from("attachment")
      .select("source_id")
      .in("source_type", ["platform", "PLATFORM"])
      .limit(100000);
    if (companyId) {
      platAttQuery = platAttQuery.or(`company_id.eq.${companyId},company_id.is.null`);
    }
    const { data: platAtts } = await platAttQuery;

    // 2. Component attachments
    let compAttQuery = (supabase as any)
      .from("attachment")
      .select("source_id")
      .in("source_type", ["component", "COMPONENT", "structure_component", "STRUCTURE_COMPONENT"])
      .limit(100000);
    if (companyId) {
      compAttQuery = compAttQuery.or(`company_id.eq.${companyId},company_id.is.null`);
    }
    const { data: compAtts } = await compAttQuery;

    const compIds: number[] = Array.from(
      new Set((compAtts || []).map((a: any) => Number(a.source_id)).filter(Boolean))
    );

    const compToPlatMap = new Map<number, number>();
    if (compIds.length > 0) {
      for (const chunk of chunkArray<number>(compIds)) {
        const { data: comps } = await (supabase as any)
          .from("structure_components")
          .select("id, structure_id")
          .in("id", chunk)
          .limit(10000);
        (comps || []).forEach((c: any) => {
          if (c.structure_id) compToPlatMap.set(c.id, c.structure_id);
        });
      }
    }

    // 3. Inspection attachments
    let inspAttQuery = (supabase as any)
      .from("attachment")
      .select("source_id, meta")
      .in("source_type", ["inspection", "INSPECTION", "insp_record", "INSP_RECORD", "anomaly", "ANOMALY"])
      .limit(100000);
    if (companyId) {
      inspAttQuery = inspAttQuery.or(`company_id.eq.${companyId},company_id.is.null`);
    }
    const { data: inspAtts } = await inspAttQuery;

    const inspIdsSet = new Set<number>();
    (inspAtts || []).forEach((a: any) => {
      const sid = Number(a.source_id);
      if (sid) inspIdsSet.add(sid);
      const metaInspId = Number(a.meta?.insp_id);
      if (metaInspId) inspIdsSet.add(metaInspId);
    });

    const inspIds: number[] = Array.from(inspIdsSet);
    const inspToPlatMap = new Map<number, number>();

    if (inspIds.length > 0) {
      for (const chunk of chunkArray<number>(inspIds)) {
        const { data: insps } = await (supabase as any)
          .from("insp_records")
          .select("insp_id, structure_id")
          .in("insp_id", chunk)
          .limit(10000);
        (insps || []).forEach((i: any) => {
          if (i.structure_id) inspToPlatMap.set(i.insp_id, i.structure_id);
        });
      }
    }

    // 4. Inspection media
    const { data: media } = await (supabase as any)
      .from("insp_media")
      .select("inspection_id")
      .limit(100000);
    const mediaInspIds: number[] = Array.from(
      new Set((media || []).map((m: any) => Number(m.inspection_id)).filter(Boolean))
    );

    if (mediaInspIds.length > 0) {
      const missingInspIds: number[] = mediaInspIds.filter((id) => !inspToPlatMap.has(id));
      if (missingInspIds.length > 0) {
        for (const chunk of chunkArray<number>(missingInspIds)) {
          const { data: mInsps } = await (supabase as any)
            .from("insp_records")
            .select("insp_id, structure_id")
            .in("insp_id", chunk)
            .limit(10000);
          (mInsps || []).forEach((i: any) => {
            if (i.structure_id) inspToPlatMap.set(i.insp_id, i.structure_id);
          });
        }
      }
    }

    // Calculate aggregated counts
    const counts: Record<number, number> = {};

    (platAtts || []).forEach((a: any) => {
      const pid = Number(a.source_id);
      if (pid) counts[pid] = (counts[pid] || 0) + 1;
    });

    (compAtts || []).forEach((a: any) => {
      const pid = compToPlatMap.get(Number(a.source_id));
      if (pid) counts[pid] = (counts[pid] || 0) + 1;
    });

    (inspAtts || []).forEach((a: any) => {
      let pid = inspToPlatMap.get(Number(a.source_id));
      if (!pid && a.meta?.insp_id) {
        pid = inspToPlatMap.get(Number(a.meta.insp_id));
      }
      if (pid) counts[pid] = (counts[pid] || 0) + 1;
    });

    (media || []).forEach((m: any) => {
      const pid = inspToPlatMap.get(Number(m.inspection_id));
      if (pid) counts[pid] = (counts[pid] || 0) + 1;
    });

    return NextResponse.json({ success: true, counts });
  } catch (err: any) {
    console.error("[GET /api/attachment/counts] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to calculate counts" }, { status: 500 });
  }
});
