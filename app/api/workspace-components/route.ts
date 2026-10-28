import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/utils/tenant-auth";

export const dynamic = "force-dynamic";

export const GET = withTenant(async (request, { companyId }) => {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const jobpackIdRaw = searchParams.get("jobpack_id");
    const structureIdRaw = searchParams.get("structure_id");
    let sowReportNo = searchParams.get("sow_report_no");
    if (sowReportNo) sowReportNo = decodeURIComponent(sowReportNo).trim();

    if (!jobpackIdRaw || !structureIdRaw) {
      return NextResponse.json({ error: "Missing required parameters: jobpack_id and structure_id" }, { status: 400 });
    }

    const jobpack_id = parseInt(String(jobpackIdRaw).replace(/^(jobpack)-/, ""), 10);
    const structure_id = parseInt(String(structureIdRaw).replace(/^(platform|pipeline)-/, ""), 10);

    if (isNaN(jobpack_id) || isNaN(structure_id)) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    // 1. Fetch Structure Components for this platform (active / not deleted)
    let compQuery = (supabase as any)
      .from("structure_components")
      .select("id, q_id, id_no, code, comp_id, metadata, is_deleted")
      .eq("structure_id", structure_id);

    if (companyId) {
      compQuery = compQuery.or(`company_id.eq.${companyId},company_id.is.null`);
    }

    // 2. Fetch SOW header
    let sowQuery = (supabase as any)
      .from("u_sow")
      .select("id, report_numbers")
      .eq("jobpack_id", jobpack_id)
      .eq("structure_id", structure_id);

    if (companyId) {
      sowQuery = sowQuery.or(`company_id.eq.${companyId},company_id.is.null`);
    }

    // 3. Fetch inspection records for status truth-mask
    let recQuery = (supabase as any)
      .from("insp_records")
      .select("component_id, component_qid, inspection_type_code, status, has_anomaly, cr_date")
      .eq("jobpack_id", jobpack_id)
      .eq("structure_id", structure_id);

    if (companyId) {
      recQuery = recQuery.or(`company_id.eq.${companyId},company_id.is.null`);
    }

    if (sowReportNo && sowReportNo !== "all" && sowReportNo !== "N/A" && sowReportNo.trim() !== "") {
      recQuery = recQuery.or(`sow_report_no.eq."${sowReportNo}",sow_report_no.is.null`);
    }

    const [compsRes, sowRes, recsRes] = await Promise.all([
      compQuery,
      sowQuery.maybeSingle(),
      recQuery.order("cr_date", { ascending: false }),
    ]);

    if (compsRes.error) throw compsRes.error;

    // Filter out deleted/archived components
    const rawComps = (compsRes.data || []).filter((c: any) => {
      if (c.is_deleted === true || c.is_deleted === 1) return false;
      if (c.is_deleted === false || c.is_deleted === 0) return true;
      const md = typeof c.metadata === "string" ? (() => { try { return JSON.parse(c.metadata); } catch { return {}; } })() : (c.metadata || {});
      return !(md.del === 1 || md.del === "1" || md.del === true || md.status === "archived" || md.status === "deleted");
    });

    // 4. Fetch SOW Items if SOW exists
    let sowItems: any[] = [];
    const sowId = sowRes.data?.id;
    if (sowId) {
      let sowItemsQuery = (supabase as any)
        .from("u_sow_items")
        .select("id, sow_id, component_id, component_qid, component_type, inspection_code, inspection_name, status, report_number")
        .eq("sow_id", sowId);

      if (sowReportNo && sowReportNo !== "all" && sowReportNo !== "N/A" && sowReportNo.trim() !== "") {
        sowItemsQuery = sowItemsQuery.eq("report_number", sowReportNo);
      }

      const { data: sItems } = await sowItemsQuery;
      sowItems = sItems || [];
    }

    // 5. Build dynamic inspection truth status map and record count map
    const trueStatusMap = new Map<string, string>();
    const recordCountMap = new Map<string, number>();

    (recsRes.data || []).forEach((r: any) => {
      const rCode = String(r.inspection_type_code || "").trim().toUpperCase();
      const compIdStr = r.component_id ? String(r.component_id) : "";
      const compQidStr = r.component_qid ? String(r.component_qid).trim().toUpperCase() : "";

      if (rCode) {
        if (compIdStr) {
          const kId = `${compIdStr}_${rCode}`;
          recordCountMap.set(kId, (recordCountMap.get(kId) || 0) + 1);
          if (!trueStatusMap.has(kId)) {
            const hasAnom = r.has_anomaly || String(r.status).toUpperCase() === "ANOMALY";
            const isIncomp = String(r.status).toUpperCase() === "INCOMPLETE";
            trueStatusMap.set(kId, hasAnom ? "anomaly" : isIncomp ? "incomplete" : "completed");
          }
        }
        if (compQidStr) {
          const kQid = `${compQidStr}_${rCode}`;
          recordCountMap.set(kQid, (recordCountMap.get(kQid) || 0) + 1);
          if (!trueStatusMap.has(kQid)) {
            const hasAnom = r.has_anomaly || String(r.status).toUpperCase() === "ANOMALY";
            const isIncomp = String(r.status).toUpperCase() === "INCOMPLETE";
            trueStatusMap.set(kQid, hasAnom ? "anomaly" : isIncomp ? "incomplete" : "completed");
          }
        }
      }
    });

    // 6. Map SOW Items to Components using O(1) Hash Maps
    const compById = new Map<number, any>();
    const compByQid = new Map<string, any>();
    const compByType = new Map<string, any>();
    rawComps.forEach((c: any) => {
      if (c.id) compById.set(c.id, c);
      if (c.q_id) compByQid.set(String(c.q_id).trim().toUpperCase(), c);
      if (c.code) compByType.set(String(c.code).trim().toUpperCase(), c);
      if (c.name) compByType.set(String(c.name).trim().toUpperCase(), c);
    });

    const assignedCompsMap = new Map<number, { code: string; status: string; count?: number; recordCount?: number }[]>();

    sowItems.forEach((item: any) => {
      let matchingComp: any = null;
      if (item.component_id) {
        matchingComp = compById.get(item.component_id);
      }
      if (!matchingComp && item.component_qid) {
        matchingComp = compByQid.get(String(item.component_qid).trim().toUpperCase());
      }
      if (!matchingComp && item.component_type) {
        matchingComp = compByType.get(String(item.component_type).trim().toUpperCase());
      }

      if (matchingComp) {
        if (!assignedCompsMap.has(matchingComp.id)) {
          assignedCompsMap.set(matchingComp.id, []);
        }
        const taskToLog = item.inspection_code || item.inspection_name;
        if (taskToLog) {
          const tCodeUpper = String(taskToLog).trim().toUpperCase();
          const cQidUpper = String(matchingComp.q_id || matchingComp.name || "").trim().toUpperCase();
          const dynKey1 = `${matchingComp.id}_${item.inspection_code}`;
          const dynKey2 = `${matchingComp.id}_${item.inspection_name}`;
          const dynKey3 = cQidUpper ? `${cQidUpper}_${tCodeUpper}` : "";

          const rawSowStatus = String(item.status || "").toLowerCase();
          const realStatus =
            trueStatusMap.get(dynKey1) ||
            trueStatusMap.get(dynKey2) ||
            (dynKey3 ? trueStatusMap.get(dynKey3) : undefined) ||
            (rawSowStatus && rawSowStatus !== "pending" ? rawSowStatus : "pending");

          const recCount = Math.max(
            recordCountMap.get(`${matchingComp.id}_${tCodeUpper}`) || 0,
            cQidUpper ? (recordCountMap.get(`${cQidUpper}_${tCodeUpper}`) || 0) : 0,
            item.inspection_code ? (recordCountMap.get(`${matchingComp.id}_${String(item.inspection_code).trim().toUpperCase()}`) || 0) : 0,
            item.inspection_name ? (recordCountMap.get(`${matchingComp.id}_${String(item.inspection_name).trim().toUpperCase()}`) || 0) : 0
          );

          const isCompletedOrAnom = realStatus !== "pending" && realStatus !== "" && realStatus !== "not_started";
          const finalCount = recCount > 0 ? recCount : (isCompletedOrAnom ? 1 : 0);

          assignedCompsMap.get(matchingComp.id)?.push({
            code: taskToLog,
            status: realStatus,
            count: finalCount,
            recordCount: finalCount,
          });
        }
      }
    });

    // 7. Format assigned and unassigned components
    const assigned: any[] = [];
    const unassigned: any[] = [];

    rawComps.forEach((comp: any) => {
      const isAssigned = assignedCompsMap.has(comp.id);
      const md = (typeof comp.metadata === "string" ? (() => { try { return JSON.parse(comp.metadata); } catch { return {}; } })() : comp.metadata) || {};

      const startNode = md.start_node || md.f_node || md.Node_1 || comp.startNode || comp.start_node || "-";
      const endNode = md.end_node || md.s_node || md.Node_2 || comp.endNode || comp.end_node || "-";
      const startLeg = md.f_leg || md.start_leg || md.s_leg || md.leg_1 || md.StartLeg || md.Leg_1 || comp.startLeg || comp.start_leg || "-";
      const endLeg = md.s_leg || md.end_leg || md.f_leg || md.leg_2 || md.EndLeg || md.Leg_2 || comp.endLeg || comp.end_leg || "-";
      const startElev = md.start_elevation || md.elv_1 || comp.elevation1 || comp.start_elevation || "-";
      const endElev = md.end_elevation || md.elv_2 || comp.elevation2 || comp.end_elevation || "-";
      const nominalThk = md.nominal_thickness || md.NominalThickness || md.nominal_thk || md.wall_thk || md.additionalInfo?.wall_thk || comp.nominal_thickness || "-";
      const wallThickness = md.wall_thk || md.additionalInfo?.wall_thk || "-";

      const elv1Num = parseFloat(String(startElev).replace(/[^\d.-]/g, ""));
      const elv2Num = parseFloat(String(endElev).replace(/[^\d.-]/g, ""));
      const hasElv1 = !isNaN(elv1Num);
      const hasElv2 = !isNaN(elv2Num);
      let displayDepth = comp.water_depth || "-0.0m";
      let lowestElev = "-";
      if (hasElv1 && hasElv2) {
        lowestElev = String(Math.min(elv1Num, elv2Num));
        displayDepth = `${lowestElev}m`;
      } else if (hasElv1) {
        lowestElev = String(elv1Num);
        displayDepth = `${elv1Num}m`;
      } else if (hasElv2) {
        lowestElev = String(elv2Num);
        displayDepth = `${elv2Num}m`;
      }

      const face = md.face || md.face_name || md.face_code || md.Face || md.additionalInfo?.face || md.additionalInfo?.face_pos || comp.face || "";
      const compQId = comp.q_id || comp.name || `Node ${comp.id}`;
      const taskItems = assignedCompsMap.get(comp.id) || [];

      const obj = {
        id: comp.id,
        name: compQId,
        q_id: compQId,
        code: comp.code || comp.type || "-",
        type: comp.type || comp.code || "-",
        face: face && face !== "-" && face !== "N/A" ? face : "",
        depth: displayDepth,
        lowestElev,
        startNode,
        endNode,
        startLeg,
        endLeg,
        startElev,
        endElev,
        nominalThk,
        wallThickness,
        raw: comp,
        tasks: Array.from(new Set(taskItems.map((t) => t.code))),
        taskStatuses: Array.from(new Map(taskItems.map((item) => [item.code, item])).values()),
      };

      if (isAssigned) assigned.push(obj);
      else unassigned.push(obj);
    });

    const combined = [...assigned, ...unassigned];

    return NextResponse.json(
      {
        assigned,
        unassigned,
        all: combined,
        stats: {
          total: combined.length,
          totalAssigned: assigned.length,
          totalUnassigned: unassigned.length,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          "Pragma": "no-cache",
        },
      }
    );
  } catch (error: any) {
    console.error("[WorkspaceComponents API] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
