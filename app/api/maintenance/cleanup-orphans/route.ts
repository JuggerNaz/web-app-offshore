import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { withRole } from "@/utils/role-auth";

/**
 * GET /api/maintenance/cleanup-orphans
 * Dry-run scan for orphaned anomalies/attachments/media and SOW inconsistencies.
 * Restricted to company admins and super admins (heavy full-table scans).
 */
export const GET = withRole(["company_admin", "super_admin"], async (req: NextRequest) => {
  try {
    const supabase = await createClient();

    // 1. Fetch valid inspection records
    let allInspIds = new Set<number>();
    let allInspRecords: any[] = [];
    let from = 0;
    const pageSize = 1000;

    while (true) {
      const { data, error } = await supabase
        .from("insp_records")
        .select("insp_id, component_id, inspection_type_code, sow_report_no, status, has_anomaly, inspection_date")
        .order("insp_id", { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (data && data.length > 0) {
        allInspRecords.push(...data);
        data.forEach((r: any) => allInspIds.add(Number(r.insp_id)));
        if (data.length < pageSize) break;
        from += pageSize;
      } else {
        break;
      }
    }

    // 2. Fetch all anomalies
    let allAnomalies: any[] = [];
    from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("insp_anomalies")
        .select("anomaly_id, anomaly_ref_no, inspection_id")
        .order("anomaly_id", { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (data && data.length > 0) {
        allAnomalies.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      } else {
        break;
      }
    }

    const orphanedAnomalies = allAnomalies.filter(
      (a: any) => !a.inspection_id || !allInspIds.has(Number(a.inspection_id))
    );
    const validAnomalyIds = new Set(
      allAnomalies
        .filter((a: any) => a.inspection_id && allInspIds.has(Number(a.inspection_id)))
        .map((a: any) => Number(a.anomaly_id))
    );

    // 3. Fetch all attachments
    let allAttachments: any[] = [];
    from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("attachment")
        .select("id, source_id, source_type, path")
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (data && data.length > 0) {
        allAttachments.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      } else {
        break;
      }
    }

    const orphanedAttachments = allAttachments.filter((att: any) => {
      const st = String(att.source_type || "").toLowerCase();
      const sid = Number(att.source_id);
      if (["inspection", "insp_record"].includes(st)) {
        return !allInspIds.has(sid);
      }
      if (["anomaly", "defect"].includes(st)) {
        return !validAnomalyIds.has(sid);
      }
      return false;
    });

    // 4. Fetch all insp_media
    let allMedia: any[] = [];
    from = 0;
    while (true) {
      const { data, error } = await (supabase as any)
        .from("insp_media")
        .select("media_id, inspection_id, anomaly_id, file_path, thumbnail_path")
        .order("media_id", { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) break;
      if (data && data.length > 0) {
        allMedia.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      } else {
        break;
      }
    }

    const orphanedMedia = allMedia.filter((m: any) => {
      const invalidInsp = m.inspection_id && !allInspIds.has(Number(m.inspection_id));
      const invalidAnom = m.anomaly_id && !validAnomalyIds.has(Number(m.anomaly_id));
      const noLink = !m.inspection_id && !m.anomaly_id;
      return invalidInsp || invalidAnom || noLink;
    });

    // 5. Build lookup maps for SOW check
    const recordsByScopedKey = new Map<string, any[]>();
    const recordsByGenericKey = new Map<string, any[]>();

    allInspRecords.forEach((r: any) => {
      if (!r.component_id || !r.inspection_type_code) return;
      const taskCode = String(r.inspection_type_code).toUpperCase();
      const genKey = `${r.component_id}_${taskCode}`;
      if (!recordsByGenericKey.has(genKey)) recordsByGenericKey.set(genKey, []);
      recordsByGenericKey.get(genKey)!.push(r);

      if (r.sow_report_no) {
        const scopedKey = `${r.component_id}_${taskCode}_${String(r.sow_report_no).trim().toUpperCase()}`;
        if (!recordsByScopedKey.has(scopedKey)) recordsByScopedKey.set(scopedKey, []);
        recordsByScopedKey.get(scopedKey)!.push(r);
      }
    });

    // 6. Fetch SOW items
    let allSowItems: any[] = [];
    from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("u_sow_items")
        .select("id, sow_id, component_id, component_qid, inspection_code, inspection_name, status, report_number, inspection_count")
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (data && data.length > 0) {
        allSowItems.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      } else {
        break;
      }
    }

    const inconsistentSowItems: any[] = [];
    allSowItems.forEach((s: any) => {
      const tCode = String(s.inspection_code || s.inspection_name || "").toUpperCase();
      if (!s.component_id || !tCode) return;

      let matchingRecords: any[] = [];
      if (s.report_number) {
        const scopedKey = `${s.component_id}_${tCode}_${String(s.report_number).trim().toUpperCase()}`;
        matchingRecords = recordsByScopedKey.get(scopedKey) || [];
      }
      if (matchingRecords.length === 0) {
        const genKey = `${s.component_id}_${tCode}`;
        matchingRecords = recordsByGenericKey.get(genKey) || [];
      }

      const realCount = matchingRecords.length;
      const currentStatus = String(s.status || "").toLowerCase();
      const currentCount = Number(s.inspection_count || 0);

      let targetStatus = "pending";
      let targetCount = 0;

      if (realCount === 0) {
        targetStatus = "pending";
        targetCount = 0;
      } else {
        targetCount = realCount;
        const allIncomp = matchingRecords.every((r: any) => String(r.status).toUpperCase() === "INCOMPLETE");
        targetStatus = allIncomp ? "incomplete" : "completed";
      }

      if (currentStatus !== targetStatus || currentCount !== targetCount) {
        inconsistentSowItems.push({
          id: s.id,
          sowId: s.sow_id,
          component: s.component_qid || s.component_id,
          task: tCode,
          currentStatus: s.status,
          targetStatus,
          currentCount,
          targetCount,
        });
      }
    });

    return NextResponse.json({
      success: true,
      summary: {
        totalInspections: allInspIds.size,
        totalAnomalies: allAnomalies.length,
        orphanedAnomaliesCount: orphanedAnomalies.length,
        totalAttachments: allAttachments.length,
        orphanedAttachmentsCount: orphanedAttachments.length,
        orphanedMediaCount: orphanedMedia.length,
        totalSowItems: allSowItems.length,
        inconsistentSowItemsCount: inconsistentSowItems.length,
      },
      samples: {
        orphanedAnomalies: orphanedAnomalies.slice(0, 5),
        orphanedAttachments: orphanedAttachments.slice(0, 5),
        inconsistentSowItems: inconsistentSowItems.slice(0, 5),
      },
    });
  } catch (error: any) {
    console.error("[Cleanup API GET Error]", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

/**
 * POST /api/maintenance/cleanup-orphans
 * DESTRUCTIVE: permanently deletes orphaned records and storage objects and rewrites SOW counters.
 * Restricted to company admins and super admins, and requires an explicit { "confirm": true } body.
 */
export const POST = withRole(["company_admin", "super_admin"], async (req: NextRequest) => {
  try {
    const supabase = await createClient();

    // Require explicit confirmation for this destructive operation
    const body: any = await req.json().catch(() => ({}));
    if (body?.confirm !== true) {
      return NextResponse.json(
        { success: false, error: "Confirmation required. Resend with { \"confirm\": true } in the request body to run destructive cleanup." },
        { status: 400 }
      );
    }

    // 1. Fetch valid inspection records
    let allInspIds = new Set<number>();
    let allInspRecords: any[] = [];
    let from = 0;
    const pageSize = 1000;

    while (true) {
      const { data, error } = await supabase
        .from("insp_records")
        .select("insp_id, component_id, inspection_type_code, sow_report_no, status, has_anomaly, inspection_date")
        .order("insp_id", { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (data && data.length > 0) {
        allInspRecords.push(...data);
        data.forEach((r: any) => allInspIds.add(Number(r.insp_id)));
        if (data.length < pageSize) break;
        from += pageSize;
      } else {
        break;
      }
    }

    // 2. Fetch and identify orphaned anomalies
    let allAnomalies: any[] = [];
    from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("insp_anomalies")
        .select("anomaly_id, anomaly_ref_no, inspection_id")
        .order("anomaly_id", { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (data && data.length > 0) {
        allAnomalies.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      } else {
        break;
      }
    }

    const orphanedAnomalies = allAnomalies.filter(
      (a: any) => !a.inspection_id || !allInspIds.has(Number(a.inspection_id))
    );
    const validAnomalyIds = new Set(
      allAnomalies
        .filter((a: any) => a.inspection_id && allInspIds.has(Number(a.inspection_id)))
        .map((a: any) => Number(a.anomaly_id))
    );

    // 3. Fetch and clean orphaned attachments
    let allAttachments: any[] = [];
    from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("attachment")
        .select("id, source_id, source_type, path")
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (data && data.length > 0) {
        allAttachments.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      } else {
        break;
      }
    }

    const orphanedAttachments = allAttachments.filter((att: any) => {
      const st = String(att.source_type || "").toLowerCase();
      const sid = Number(att.source_id);
      if (["inspection", "insp_record"].includes(st)) {
        return !allInspIds.has(sid);
      }
      if (["anomaly", "defect"].includes(st)) {
        return !validAnomalyIds.has(sid);
      }
      return false;
    });

    if (orphanedAttachments.length > 0) {
      const cloudStoragePaths = orphanedAttachments
        .map((a: any) => a.path)
        .filter((p: any) => p && !p.includes(":\\") && !p.startsWith("\\"));
      if (cloudStoragePaths.length > 0) {
        await supabase.storage.from("attachments").remove(cloudStoragePaths);
      }
      const attIds = orphanedAttachments.map((a: any) => a.id);
      for (let i = 0; i < attIds.length; i += 100) {
        await supabase.from("attachment").delete().in("id", attIds.slice(i, i + 100));
      }
    }

    // 4. Fetch and clean orphaned insp_media
    let allMedia: any[] = [];
    from = 0;
    while (true) {
      const { data, error } = await (supabase as any)
        .from("insp_media")
        .select("media_id, inspection_id, anomaly_id, file_path, thumbnail_path")
        .order("media_id", { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) break;
      if (data && data.length > 0) {
        allMedia.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      } else {
        break;
      }
    }

    const orphanedMedia = allMedia.filter((m: any) => {
      const invalidInsp = m.inspection_id && !allInspIds.has(Number(m.inspection_id));
      const invalidAnom = m.anomaly_id && !validAnomalyIds.has(Number(m.anomaly_id));
      const noLink = !m.inspection_id && !m.anomaly_id;
      return invalidInsp || invalidAnom || noLink;
    });

    if (orphanedMedia.length > 0) {
      const mediaPaths: string[] = [];
      orphanedMedia.forEach((m: any) => {
        if (m.file_path && !m.file_path.includes(":\\")) mediaPaths.push(m.file_path);
        if (m.thumbnail_path && !m.thumbnail_path.includes(":\\")) mediaPaths.push(m.thumbnail_path);
      });
      if (mediaPaths.length > 0) {
        await supabase.storage.from("inspection-media").remove(mediaPaths);
        await supabase.storage.from("attachments").remove(mediaPaths);
      }
      const mediaIds = orphanedMedia.map((m: any) => m.media_id);
      for (let i = 0; i < mediaIds.length; i += 100) {
        await (supabase as any).from("insp_media").delete().in("media_id", mediaIds.slice(i, i + 100));
      }
    }

    // 5. Delete orphaned anomalies
    if (orphanedAnomalies.length > 0) {
      const anomIds = orphanedAnomalies.map((a: any) => a.anomaly_id);
      for (let i = 0; i < anomIds.length; i += 100) {
        await supabase.from("insp_anomalies").delete().in("anomaly_id", anomIds.slice(i, i + 100));
      }
    }

    // 6. Synchronize SOW items
    const recordsByScopedKey = new Map<string, any[]>();
    const recordsByGenericKey = new Map<string, any[]>();

    allInspRecords.forEach((r: any) => {
      if (!r.component_id || !r.inspection_type_code) return;
      const taskCode = String(r.inspection_type_code).toUpperCase();
      const genKey = `${r.component_id}_${taskCode}`;
      if (!recordsByGenericKey.has(genKey)) recordsByGenericKey.set(genKey, []);
      recordsByGenericKey.get(genKey)!.push(r);

      if (r.sow_report_no) {
        const scopedKey = `${r.component_id}_${taskCode}_${String(r.sow_report_no).trim().toUpperCase()}`;
        if (!recordsByScopedKey.has(scopedKey)) recordsByScopedKey.set(scopedKey, []);
        recordsByScopedKey.get(scopedKey)!.push(r);
      }
    });

    let allSowItems: any[] = [];
    from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("u_sow_items")
        .select("id, sow_id, component_id, component_qid, inspection_code, inspection_name, status, report_number, inspection_count, elevation_required, elevation_data")
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (data && data.length > 0) {
        allSowItems.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      } else {
        break;
      }
    }

    const affectedSowIds = new Set<number>();
    let correctedSowCount = 0;

    for (const s of allSowItems) {
      const tCode = String(s.inspection_code || s.inspection_name || "").toUpperCase();
      if (!s.component_id || !tCode) continue;

      let matchingRecords: any[] = [];
      if (s.report_number) {
        const scopedKey = `${s.component_id}_${tCode}_${String(s.report_number).trim().toUpperCase()}`;
        matchingRecords = recordsByScopedKey.get(scopedKey) || [];
      }
      if (matchingRecords.length === 0) {
        const genKey = `${s.component_id}_${tCode}`;
        matchingRecords = recordsByGenericKey.get(genKey) || [];
      }

      const realCount = matchingRecords.length;
      const currentStatus = String(s.status || "").toLowerCase();
      const currentCount = Number(s.inspection_count || 0);

      let targetStatus = "pending";
      let targetCount = 0;
      let targetDate: string | null = null;

      if (realCount === 0) {
        targetStatus = "pending";
        targetCount = 0;
        targetDate = null;
      } else {
        targetCount = realCount;
        const allIncomp = matchingRecords.every((r: any) => String(r.status).toUpperCase() === "INCOMPLETE");
        targetStatus = allIncomp ? "incomplete" : "completed";
        const sortedDates = matchingRecords.map((r: any) => r.inspection_date).filter(Boolean).sort().reverse();
        targetDate = sortedDates[0] || null;
      }

      if (currentStatus !== targetStatus || currentCount !== targetCount) {
        if (s.sow_id) affectedSowIds.add(Number(s.sow_id));

        const updatePayload: any = {
          status: targetStatus,
          inspection_count: targetCount,
          last_inspection_date: targetDate,
          updated_at: new Date().toISOString(),
        };

        if (targetCount === 0 && s.elevation_required && Array.isArray(s.elevation_data)) {
          updatePayload.elevation_data = s.elevation_data.map((elev: any) => ({
            ...elev,
            status: "pending",
          }));
        }

        await supabase.from("u_sow_items").update(updatePayload).eq("id", s.id);
        correctedSowCount++;
      }
    }

    // 7. Recalculate parent SOW totals
    for (const sId of Array.from(affectedSowIds)) {
      if (!sId) continue;
      const { data: refreshedItems } = await supabase
        .from("u_sow_items")
        .select("status")
        .eq("sow_id", sId);

      if (refreshedItems) {
        const totalItems = refreshedItems.length;
        const completedItems = refreshedItems.filter((i: any) => i.status === "completed").length;
        const incompleteItems = refreshedItems.filter((i: any) => i.status === "incomplete").length;
        const pendingItems = refreshedItems.filter((i: any) => i.status === "pending").length;

        await supabase
          .from("u_sow")
          .update({
            total_items: totalItems,
            completed_items: completedItems,
            incomplete_items: incompleteItems,
            pending_items: pendingItems,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sId);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Cleanup and SOW synchronization completed successfully",
      cleaned: {
        orphanedAnomaliesCount: orphanedAnomalies.length,
        orphanedAttachmentsCount: orphanedAttachments.length,
        orphanedMediaCount: orphanedMedia.length,
        correctedSowItemsCount: correctedSowCount,
        recalculatedSowCount: affectedSowIds.size,
      },
    });
  } catch (error: any) {
    console.error("[Cleanup API POST Error]", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
