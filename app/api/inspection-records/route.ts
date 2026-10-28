import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/utils/tenant-auth";

export const dynamic = "force-dynamic";

const EXCLUDED_CALIBRATION_CODES = ["RCPCLB", "RUTCLB", "CPCLB", "UTCLB"];

export const GET = withTenant(async (request, { companyId }) => {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const jobpackIdRaw = searchParams.get("jobpack_id");
    const structureIdRaw = searchParams.get("structure_id");
    let sow_report_no = searchParams.get("sow_report_no");
    if (sow_report_no) sow_report_no = decodeURIComponent(sow_report_no).trim();

    if (!jobpackIdRaw || !structureIdRaw) {
      return NextResponse.json({ error: "Missing required parameters: jobpack_id and structure_id" }, { status: 400 });
    }

    const jobpack_id = parseInt(String(jobpackIdRaw).replace(/^(jobpack)-/, ""), 10);
    const structure_id = parseInt(String(structureIdRaw).replace(/^(platform|pipeline)-/, ""), 10);

    if (isNaN(jobpack_id) || isNaN(structure_id)) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    // Pagination parameters
    const pageParam = searchParams.get("page");
    const pageSizeParam = searchParams.get("pageSize") || searchParams.get("limit");
    const offsetParam = searchParams.get("offset");
    const noPaginate = searchParams.get("all") === "true" || searchParams.get("no_paginate") === "true";

    const isPaginated = !noPaginate && (pageParam !== null || pageSizeParam !== null || offsetParam !== null);
    const pageSize = pageSizeParam ? Math.max(1, Math.min(500, parseInt(pageSizeParam, 10))) : 50;
    const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
    const offset = offsetParam !== null ? Math.max(0, parseInt(offsetParam, 10)) : (page - 1) * pageSize;

    // Filter & search parameters
    const queryTerm = searchParams.get("q") || searchParams.get("query") || searchParams.get("search") || "";
    const category = searchParams.get("category")?.toUpperCase() || "ALL"; // 'ALL' | 'ANOMALY' | 'FINDING' | 'INCOMPLETE' | 'COMPLETED'
    const anomalyStatus = searchParams.get("anomaly_status") || "";
    const excludeCalibrations = searchParams.get("exclude_calibrations") !== "false";
    const sortBy = searchParams.get("sort_by") || "inspection_date";
    const sortDir = (searchParams.get("sort_dir") || "desc").toLowerCase() === "asc" ? "asc" : "desc";

    // --------------------------------------------------------------------------
    // --------------------------------------------------------------------------
    // STRATEGY 1: Attempt to query the optimized Database View (v_inspection_workspace_records)
    // --------------------------------------------------------------------------
    let useView = true;
    try {
      const probeQuery = (supabase as any)
        .from("v_inspection_workspace_records")
        .select("insp_id")
        .limit(1);
      const { error: probeErr } = await probeQuery;
      if (probeErr) {
        useView = false;
      }
    } catch {
      useView = false;
    }

    const buildViewQuery = (includeCount = false) => {
      let q = (supabase as any)
        .from("v_inspection_workspace_records")
        .select("*", includeCount ? { count: "exact" } : {})
        .eq("jobpack_id", jobpack_id)
        .eq("structure_id", structure_id);

      if (companyId) {
        q = q.or(`company_id.eq.${companyId},company_id.is.null`);
      }

      // SOW report filtering
      if (sow_report_no && sow_report_no !== "all" && sow_report_no !== "N/A" && sow_report_no.trim() !== "") {
        q = q.or(`sow_report_no.eq."${sow_report_no}",sow_report_no.eq.N/A,sow_report_no.is.null`);
      }

      // Exclude calibration inspection records
      if (excludeCalibrations) {
        q = q.not("inspection_type_code", "in", '("RCPCLB","RUTCLB","CPCLB","UTCLB")');
      }

      // Record Category Filtering: ANOMALY | FINDING | INCOMPLETE | COMPLETED
      if (category && category !== "ALL") {
        q = q.eq("record_classification", category);
      }

      // Anomaly Status Filtering (e.g. 'OPEN', 'RECTIFIED', etc.)
      if (anomalyStatus && anomalyStatus !== "all" && anomalyStatus.trim() !== "") {
        q = q.eq("primary_anomaly_status", anomalyStatus);
      }

      // Free text search in backend search_text column
      if (queryTerm.trim()) {
        const terms = queryTerm.trim().toLowerCase().split(/\s+/).filter(Boolean);
        for (const t of terms) {
          q = q.ilike("search_text", `%${t}%`);
        }
      }

      // Sorting
      if (sortBy === "status") {
        q = q.order("status_weight", { ascending: sortDir === "asc" });
      } else if (sortBy === "inspection_date") {
        q = q
          .order("inspection_date", { ascending: sortDir === "asc" })
          .order("inspection_time", { ascending: sortDir === "asc" });
      } else if (sortBy === "component") {
        q = q.order("component_qid", { ascending: sortDir === "asc" });
      } else if (sortBy === "anomaly_ref") {
        q = q.order("primary_anomaly_ref_no", { ascending: sortDir === "asc", nullsFirst: false });
      } else if (sortBy === "dive_no") {
        q = q.order("job_no", { ascending: sortDir === "asc" });
      } else if (sortBy === "tape_no") {
        q = q.order("tape_no", { ascending: sortDir === "asc" });
      } else {
        q = q
          .order("inspection_date", { ascending: false })
          .order("insp_id", { ascending: false });
      }

      return q;
    };

    if (useView) {
      let initialViewQuery = buildViewQuery(true);
      if (isPaginated) {
        initialViewQuery = initialViewQuery.range(offset, offset + pageSize - 1);
      } else {
        initialViewQuery = initialViewQuery.range(0, 999);
      }

      const { data: firstChunk, count: totalRecordsCount, error: viewErr } = await initialViewQuery;
      if (!viewErr && firstChunk) {
        let allViewData = [...firstChunk];
        const totalRecords = totalRecordsCount ?? allViewData.length;

        // Auto-batching for unpaginated queries:
        // PostgREST enforces a server-side 1,000-row limit per HTTP request.
        // If not paginated and totalRecords > 1000, fetch remaining 1000-row chunks in parallel!
        if (!isPaginated && totalRecords > allViewData.length) {
          const CHUNK_SIZE = 1000;
          const remainingBatches: Promise<any>[] = [];

          for (let from = allViewData.length; from < totalRecords; from += CHUNK_SIZE) {
            const to = Math.min(from + CHUNK_SIZE - 1, totalRecords - 1);
            remainingBatches.push(buildViewQuery(false).range(from, to));
          }

          const batchResponses = await Promise.all(remainingBatches);
          for (const bRes of batchResponses) {
            if (bRes.data && Array.isArray(bRes.data)) {
              allViewData.push(...bRes.data);
            }
          }
        }

        const normalizedData = allViewData.map((row: any) => ({
          ...row,
          // Shape backward-compatible nested objects for existing callers
          structure_components: row.component_id ? {
            id: row.component_id,
            q_id: row.component_qid,
            id_no: row.component_name,
            code: row.component_code,
            metadata: row.component_metadata,
          } : null,
          inspection_type: row.inspection_type_id ? {
            id: row.inspection_type_id,
            code: row.inspection_type_code,
            name: row.inspection_type_name,
            category: row.inspection_type_category,
          } : null,
          insp_dive_jobs: row.dive_job_id ? {
            job_no: row.dive_no,
            name: row.diver_name,
          } : null,
          insp_rov_jobs: row.rov_job_id ? {
            job_no: row.deployment_no,
            name: row.rov_operator,
          } : null,
          insp_video_tapes: row.tape_id ? {
            tape_no: row.tape_no,
            chapter_no: row.chapter_no,
          } : null,
          insp_anomalies: row.anomalies_json || (row.primary_anomaly_id ? [{
            anomaly_id: row.primary_anomaly_id,
            anomaly_ref_no: row.primary_anomaly_ref_no,
            record_category: row.primary_record_category,
            status: row.primary_anomaly_status,
            priority_code: row.primary_priority_code,
            defect_type_code: row.primary_defect_type_code,
            defect_category_code: row.primary_defect_category_code,
            defect_description: row.primary_defect_description,
            recommended_action: row.primary_recommended_action,
            follow_up_required: row.primary_follow_up_required,
            follow_up_notes: row.primary_follow_up_notes,
            is_rectified: row.primary_is_rectified,
            rectified_remarks: row.primary_rectified_remarks,
            rectified_date: row.primary_rectified_date,
            rectified_by: row.primary_rectified_by,
          }] : []),
        }));

        const totalPages = isPaginated ? Math.ceil(totalRecords / pageSize) : 1;

        return NextResponse.json(
          {
            data: normalizedData,
            pagination: {
              page: isPaginated ? Math.floor(offset / pageSize) + 1 : 1,
              pageSize: isPaginated ? pageSize : totalRecords,
              totalRecords,
              totalPages,
              hasMore: isPaginated ? offset + normalizedData.length < totalRecords : false,
            },
          },
          {
            headers: {
              "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
              "Pragma": "no-cache",
            },
          }
        );
      }
    }

    // --------------------------------------------------------------------------
    // STRATEGY 2: Fallback to directly querying insp_records with joined relations
    // (Used when the database view has not yet been deployed in Supabase)
    // --------------------------------------------------------------------------
    const buildFallbackQuery = (includeCount = false) => {
      let q = (supabase as any)
        .from("insp_records")
        .select(`
          insp_id,
          dive_job_id,
          rov_job_id,
          structure_id,
          component_id,
          component_type,
          jobpack_id,
          sow_report_no,
          inspection_type_id,
          inspection_type_code,
          inspection_date,
          inspection_time,
          tape_count_no,
          tape_id,
          elevation,
          fp_kp,
          inspection_data,
          has_anomaly,
          status,
          description,
          incomplete_reason,
          company_id,
          cr_date,
          md_date,
          reviewed_by,
          reviewed_date,
          approved_by,
          approved_date,
          inspection_type:inspection_type_id!left(id, code, name, category),
          structure_components:component_id!left(id, q_id, id_no, code, metadata),
          insp_rov_jobs:rov_job_id!left(job_no:deployment_no, name:rov_operator),
          insp_dive_jobs:dive_job_id!left(job_no:dive_no, name:diver_name),
          insp_video_tapes:tape_id!left(tape_no, chapter_no),
          insp_anomalies(
            anomaly_id,
            anomaly_ref_no,
            record_category,
            status,
            priority_code,
            defect_type_code,
            defect_category_code,
            defect_description,
            recommended_action,
            follow_up_required,
            follow_up_notes,
            is_rectified,
            rectified_remarks,
            rectified_date,
            rectified_by
          )
        `, includeCount ? { count: "exact" } : {})
        .eq("jobpack_id", jobpack_id)
        .eq("structure_id", structure_id);

      if (companyId) {
        q = q.or(`company_id.eq.${companyId},company_id.is.null`);
      }

      // SOW report filtering in SQL
      if (sow_report_no && sow_report_no !== "all" && sow_report_no !== "N/A" && sow_report_no.trim() !== "") {
        q = q.or(`sow_report_no.eq."${sow_report_no}",sow_report_no.is.null`);
      }

      if (excludeCalibrations) {
        q = q.not("inspection_type_code", "in", '("RCPCLB","RUTCLB","CPCLB","UTCLB")');
      }

      return q
        .order("inspection_date", { ascending: false })
        .order("inspection_time", { ascending: false })
        .order("insp_id", { ascending: false });
    };

    let initialFallbackQuery = buildFallbackQuery(true);
    if (isPaginated) {
      initialFallbackQuery = initialFallbackQuery.range(offset, offset + pageSize - 1);
    } else {
      initialFallbackQuery = initialFallbackQuery.range(0, 999);
    }

    const { data: firstRawData, count: fallbackTotalCount, error: rawErr } = await initialFallbackQuery;
    if (rawErr) throw rawErr;

    let rawData = [...(firstRawData || [])];
    const fallbackTotal = fallbackTotalCount ?? rawData.length;

    // Parallel chunking for unpaginated fallback query
    if (!isPaginated && fallbackTotal > rawData.length) {
      const CHUNK_SIZE = 1000;
      const remainingBatches: Promise<any>[] = [];

      for (let from = rawData.length; from < fallbackTotal; from += CHUNK_SIZE) {
        const to = Math.min(from + CHUNK_SIZE - 1, fallbackTotal - 1);
        remainingBatches.push(buildFallbackQuery(false).range(from, to));
      }

      const batchResponses = await Promise.all(remainingBatches);
      for (const bRes of batchResponses) {
        if (bRes.data && Array.isArray(bRes.data)) {
          rawData.push(...bRes.data);
        }
      }
    }

    let items = (rawData || []).map((r: any) => {
      const anoms = r.insp_anomalies || [];
      const primaryAnom = anoms[0] || null;

      // Extract incomplete details
      const incompleteReason = (
        r.incomplete_reason ||
        r.inspection_data?.incomplete_reason ||
        r.inspection_data?.reason ||
        ""
      ).trim();
      const incompleteDetails = (
        r.inspection_data?.incomplete_details ||
        r.inspection_data?.incomplete_notes ||
        ""
      ).trim();

      // Normalize primary anomaly vs finding
      const isFinding = anoms.some((a: any) => a.record_category === "FINDING" || (a.anomaly_ref_no && a.anomaly_ref_no.startsWith("F-")));
      const isAnomaly = r.has_anomaly === true || anoms.some((a: any) => a.record_category === "ANOMALY" || (a.anomaly_ref_no && !a.anomaly_ref_no.startsWith("F-")));

      let recordClassification = "OTHER";
      let statusWeight = 0;
      if (isAnomaly) {
        recordClassification = "ANOMALY";
        statusWeight = 4;
      } else if (isFinding) {
        recordClassification = "FINDING";
        statusWeight = 3;
      } else if (r.status === "INCOMPLETE") {
        recordClassification = "INCOMPLETE";
        statusWeight = 2;
      } else if (r.status === "COMPLETED") {
        recordClassification = "COMPLETED";
        statusWeight = 1;
      }

      // Compute embedded / metadata attachment count
      let attCount = 0;
      if (Array.isArray(r.inspection_data?.attachments)) {
        attCount += r.inspection_data.attachments.length;
      }

      // Extract component metadata
      const compMeta = r.structure_components?.metadata || {};
      const componentQid = r.structure_components?.q_id || r.component_type || "";
      const componentName = r.structure_components?.id_no || componentQid;
      const componentCode = r.structure_components?.code || r.component_type || "";

      // Concatenate search text for backend evaluation
      const searchText = [
        r.sow_report_no,
        r.description,
        incompleteReason,
        incompleteDetails,
        r.elevation,
        r.fp_kp,
        r.inspection_type_code,
        r.inspection_type?.name,
        componentQid,
        componentName,
        componentCode,
        compMeta.start_leg,
        compMeta.end_leg,
        compMeta.start_node,
        compMeta.end_node,
        r.inspection_data?.event_name,
        r.inspection_data?.event_type,
        r.inspection_data?.event_position,
        r.inspection_data?.event_description,
        r.inspection_data?.findings,
        r.inspection_data?.cp_rdg,
        r.insp_video_tapes?.tape_no,
        r.insp_dive_jobs?.job_no,
        r.insp_rov_jobs?.job_no,
        ...anoms.map((a: any) => `${a.anomaly_ref_no} ${a.defect_description || ""} ${a.status || ""} ${a.priority_code || ""}`)
      ].filter(Boolean).join(" ").toLowerCase();

      return {
        ...r,
        component_qid: componentQid,
        component_name: componentName,
        component_code: componentCode,
        component_metadata: compMeta,
        inspection_type_name: r.inspection_type?.name || "",
        inspection_type_category: r.inspection_type?.category || "",
        dive_no: r.insp_dive_jobs?.job_no || "",
        diver_name: r.insp_dive_jobs?.name || "",
        deployment_no: r.insp_rov_jobs?.job_no || "",
        rov_operator: r.insp_rov_jobs?.name || "",
        job_no: r.insp_dive_jobs?.job_no || r.insp_rov_jobs?.job_no || "",
        tape_no: r.insp_video_tapes?.tape_no || r.inspection_data?.tape_no || "",
        chapter_no: r.insp_video_tapes?.chapter_no || r.inspection_data?.chapter_no || "",
        incomplete_reason: incompleteReason,
        incomplete_details: incompleteDetails,
        attachment_count: attCount,
        primary_anomaly_id: primaryAnom?.anomaly_id || null,
        primary_anomaly_ref_no: primaryAnom?.anomaly_ref_no || null,
        primary_record_category: primaryAnom?.record_category || (isFinding ? "FINDING" : isAnomaly ? "ANOMALY" : null),
        primary_anomaly_status: primaryAnom?.status || null,
        primary_priority_code: primaryAnom?.priority_code || null,
        primary_defect_type_code: primaryAnom?.defect_type_code || null,
        primary_defect_description: primaryAnom?.defect_description || null,
        record_classification: recordClassification,
        status_weight: statusWeight,
        search_text: searchText,
      };
    });

    // Client/Fallback filtering by category
    if (category && category !== "ALL") {
      items = items.filter((r: any) => r.record_classification === category);
    }

    // Client/Fallback filtering by anomaly status
    if (anomalyStatus && anomalyStatus !== "all" && anomalyStatus.trim() !== "") {
      items = items.filter((r: any) => r.primary_anomaly_status === anomalyStatus);
    }

    // Client/Fallback free-text search
    if (queryTerm.trim()) {
      const terms = queryTerm.trim().toLowerCase().split(/\s+/).filter(Boolean);
      items = items.filter((r: any) => terms.every((t) => r.search_text.includes(t)));
    }

    // Client/Fallback Sorting
    if (sortBy === "status") {
      items.sort((a: any, b: any) => sortDir === "asc" ? a.status_weight - b.status_weight : b.status_weight - a.status_weight);
    } else if (sortBy === "component") {
      items.sort((a: any, b: any) => sortDir === "asc" ? a.component_qid.localeCompare(b.component_qid) : b.component_qid.localeCompare(a.component_qid));
    } else if (sortBy === "anomaly_ref") {
      items.sort((a: any, b: any) => {
        const aRef = a.primary_anomaly_ref_no || "";
        const bRef = b.primary_anomaly_ref_no || "";
        return sortDir === "asc" ? aRef.localeCompare(bRef) : bRef.localeCompare(aRef);
      });
    }

    // Enrich attachment counts from public.attachment for this page of records
    const totalRecords = items.length;
    const paginatedItems = isPaginated ? items.slice(offset, offset + pageSize) : items;
    const pageInspIds = paginatedItems.map((r: any) => r.insp_id).filter(Boolean);

    if (pageInspIds.length > 0) {
      try {
        const { data: attCounts } = await (supabase as any)
          .from("attachment")
          .select("source_id")
          .in("source_id", pageInspIds)
          .in("source_type", ["inspection", "INSPECTION", "anomaly", "ANOMALY", "defect", "DEFECT", "insp_record", "INSP_RECORD"]);

        if (attCounts && attCounts.length > 0) {
          const map: Record<number, number> = {};
          for (const a of attCounts) {
            map[a.source_id] = (map[a.source_id] || 0) + 1;
          }
          for (const r of paginatedItems) {
            if (map[r.insp_id]) {
              r.attachment_count = (r.attachment_count || 0) + map[r.insp_id];
            }
          }
        }
      } catch (attErr) {
        // Non-blocking attachment count error
        console.warn("[InspectionRecords API] Attachment count warning:", attErr);
      }
    }

    const totalPages = isPaginated ? Math.ceil(totalRecords / pageSize) : 1;

    return NextResponse.json(
      {
        data: paginatedItems,
        pagination: {
          page: isPaginated ? Math.floor(offset / pageSize) + 1 : 1,
          pageSize: isPaginated ? pageSize : totalRecords,
          totalRecords,
          totalPages,
          hasMore: isPaginated ? offset + paginatedItems.length < totalRecords : false,
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
    console.error("[InspectionRecords API] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
