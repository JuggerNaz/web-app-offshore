import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { withAuth } from "@/utils/with-auth";
import {
  getPaginationParams,
  createPaginationMeta,
  applyPagination,
  getSearchParam,
  buildSearchFilter,
} from "@/utils/pagination";
import { apiSuccess, apiBadRequest, apiPaginated } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";

/**
 * Nested join shape used by the Anomalies & Findings view.
 * Copied from the client-side queries the view previously ran for the
 * full table so item rows keep the exact same shape.
 */
const ANOMALY_SELECT = `
  *,
  inspection:insp_records!inner(
    insp_id,
    structure_id,
    component_id,
    jobpack_id,
    sow_report_no,
    inspection_type_code,
    inspection_date,
    inspection_data,
    has_anomaly,
    tape_count_no,
    tape_id,
    dive_job_id,
    rov_job_id,
    structure_components:component_id!left(q_id, code),
    insp_rov_jobs:rov_job_id!left(job_no:deployment_no),
    insp_dive_jobs:dive_job_id!left(job_no:dive_no),
    insp_video_tapes:tape_id!left(tape_no)
  )
`;

const FINDING_SELECT = `
  *,
  structure_components:component_id!left(q_id, code),
  insp_rov_jobs:rov_job_id!left(job_no:deployment_no),
  insp_dive_jobs:dive_job_id!left(job_no:dive_no),
  insp_video_tapes:tape_id!left(tape_no)
`;

/**
 * GET /api/anomalies-findings
 *
 * ?mode=counts
 *   Slim per-structure aggregation for the sidebar:
 *   [{ structure_id, anomalies, findings }]
 *   - anomalies  = insp_anomalies rows joined to insp_records
 *   - findings   = insp_records rows with has_anomaly=true
 *
 * ?view=anomalies|findings&structure_id=&page=&pageSize=&q=&id=
 *   Paged items for one structure with the same nested join shape the view
 *   uses. `q` searches ref no / description / defect code.
 *   `id=` fetches a single record by primary key (deep links), optionally scoped to a structure.
 */
export const GET = withAuth(async (request: NextRequest) => {
  const supabase = createClient();
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("mode");
  const view = searchParams.get("view") === "findings" ? "findings" : "anomalies";

  // ------------------------------------------------------------------
  // Counts mode: slim selects, aggregate in-route
  // ------------------------------------------------------------------
  if (mode === "counts") {
    const [anomsRes, findingsRes] = await Promise.all([
      supabase
        .from("insp_anomalies")
        .select("insp_records!inner(structure_id)"),
      supabase
        .from("insp_records")
        .select("structure_id")
        .eq("has_anomaly", true),
    ]);

    if (anomsRes.error) {
      return handleSupabaseError(anomsRes.error, "Failed to count anomalies");
    }
    if (findingsRes.error) {
      return handleSupabaseError(findingsRes.error, "Failed to count findings");
    }

    const counts = new Map<string, { structure_id: any; anomalies: number; findings: number }>();
    const bump = (structureId: any, key: "anomalies" | "findings") => {
      if (structureId === null || structureId === undefined) return;
      const sid = String(structureId);
      const entry = counts.get(sid) || { structure_id: structureId, anomalies: 0, findings: 0 };
      entry[key] += 1;
      counts.set(sid, entry);
    };

    (anomsRes.data || []).forEach((a: any) => {
      bump(a.insp_records?.structure_id, "anomalies");
    });

    (findingsRes.data || []).forEach((f: any) => {
      bump(f.structure_id, "findings");
    });

    return apiSuccess(Array.from(counts.values()));
  }

  // ------------------------------------------------------------------
  // Items mode
  // ------------------------------------------------------------------
  const idParam = searchParams.get("id");
  const structureIdRaw = searchParams.get("structure_id");
  const structureId = structureIdRaw ? Number(structureIdRaw) : null;
  const paginationParams = getPaginationParams(request);
  const q = getSearchParam(request);

  const isFindings = view === "findings";
  const select = isFindings ? FINDING_SELECT : ANOMALY_SELECT;
  const pk = isFindings ? "insp_id" : "anomaly_id";

  let query: any = supabase
    .from(isFindings ? "insp_records" : "insp_anomalies")
    .select(select, { count: "exact" });

  if (isFindings) {
    query = query.eq("has_anomaly", true);
    if (structureId !== null && !isNaN(structureId)) {
      query = query.eq("structure_id", structureId);
    }
  } else {
    if (structureId !== null && !isNaN(structureId)) {
      query = query.eq("inspection.structure_id", structureId);
    }
  }

  const searchColumns = isFindings
    ? ["description", "observation", "sow_report_no"]
    : [
        "anomaly_ref_no",
        "defect_description",
        "defect_type_code",
        "defect_category_code",
      ];

  const searchFilter = buildSearchFilter(q, searchColumns);
  if (searchFilter) {
    query = query.or(searchFilter);
  }

  // Deep-link support: return a single record by primary key.
  if (idParam) {
    const idNum = Number(idParam);
    if (isNaN(idNum)) {
      return apiBadRequest("Invalid id parameter");
    }
    const { data, error } = await query.eq(pk, idNum).limit(1);
    if (error) {
      return handleSupabaseError(error, `Failed to fetch ${isFindings ? "finding" : "anomaly"}`);
    }
    return apiSuccess(data?.[0] ?? null);
  }

  if (structureId === null || isNaN(structureId)) {
    return apiBadRequest("structure_id query parameter is required");
  }

  // Deterministic ordering keeps the paged windows stable.
  query = query.order(pk, { ascending: false });
  query = applyPagination(query, paginationParams);

  const { data, error, count } = await query;

  if (error) {
    return handleSupabaseError(error, "Failed to fetch anomalies / findings");
  }

  const pagination = createPaginationMeta(paginationParams, count || 0);

  return apiPaginated(data || [], pagination);
});
