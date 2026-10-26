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
    const method = (searchParams.get("method") || "DIVING").toUpperCase();
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

    const viewName = method === "DIVING" ? "v_workspace_dive_deployments" : "v_workspace_rov_deployments";
    let useView = true;
    try {
      const probe = await (supabase as any).from(viewName).select("id").limit(1);
      if (probe.error) useView = false;
    } catch {
      useView = false;
    }

    if (useView) {
      let viewQuery = (supabase as any)
        .from(viewName)
        .select("*")
        .eq("jobpack_id", jobpack_id)
        .eq("structure_id", structure_id)
        .order("id", { ascending: false });

      if (sow_report_no && sow_report_no !== "all" && sow_report_no !== "N/A" && sow_report_no.trim() !== "") {
        viewQuery = viewQuery.or(`sow_report_no.eq."${sow_report_no}",sow_report_no.eq.N/A,sow_report_no.is.null`);
      }

      const { data: vData, error: vErr } = await viewQuery;
      if (!vErr && vData && vData.length > 0) {
        const mapped = vData.map((d: any) => ({
          id: String(d.id),
          jobNo: d.jobNo,
          name: d.name,
          created_at: d.created_at,
          movement_count: d.movement_count,
          record_count: d.record_count,
          status: d.status,
          raw: d,
        }));
        return NextResponse.json(
          { deployments: mapped },
          {
            headers: {
              "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
              "Pragma": "no-cache",
            },
          }
        );
      }
    }

    const table = method === "DIVING" ? "insp_dive_jobs" : "insp_rov_jobs";
    const idCol = method === "DIVING" ? "dive_job_id" : "rov_job_id";
    const movTable = method === "DIVING" ? "insp_dive_movements" : "insp_rov_movements";

    // 1. Fetch deployments for this jobpack + structure
    let query = (supabase as any)
      .from(table)
      .select("*")
      .eq("jobpack_id", jobpack_id)
      .order(idCol, { ascending: false });

    if (structure_id) {
      query = query.eq("structure_id", structure_id);
    }
    if (sow_report_no && sow_report_no !== "all" && sow_report_no !== "N/A" && sow_report_no.trim() !== "") {
      query = query.or(`sow_report_no.eq."${sow_report_no}",sow_report_no.eq.N/A,sow_report_no.is.null`);
    }
    if (companyId) {
      query = query.or(`company_id.eq.${companyId},company_id.is.null`);
    }

    // 2. Fetch records check for legacy job IDs
    const recQuery = (supabase as any)
      .from("insp_records")
      .select(idCol)
      .eq("jobpack_id", jobpack_id)
      .eq("structure_id", structure_id)
      .not(idCol, "is", null)
      .limit(30);

    const [primaryRes, recJobsRes] = await Promise.all([query, recQuery]);

    let results = primaryRes.data || [];
    const recJobs = recJobsRes.data || [];
    const existingJobIds = new Set(results.map((r: any) => r[idCol]));

    if (recJobs.length > 0) {
      const orphanedJobIds = Array.from(new Set(recJobs.map((r: any) => r[idCol]))).filter(
        (id: any) => !existingJobIds.has(id)
      );

      if (orphanedJobIds.length > 0) {
        const virtualJobs = orphanedJobIds.map((jid: any) => ({
          [idCol]: jid,
          dive_no: `Legacy-${jid}`,
          deployment_no: `Legacy-${jid}`,
          diver_name: "Legacy Records",
          rov_operator: "Legacy Records",
          status: "COMPLETED",
          is_legacy: true,
        }));
        results = [...results, ...virtualJobs];
      }
    }

    const mapped = results.map((d: any) => {
      const rawId = d.dive_job_id || d.rov_job_id || d.id;
      const idStr = String(rawId);
      let jNo = d.dive_no || d.deployment_no || d.rov_job_no || `JOB-${rawId}`;
      if (d.is_legacy) jNo = `Legacy-${rawId}`;
      const dName = d.diver_name || d.rov_system || d.rov_operator || "Unnamed";
      const dDate = d.created_at || d.date || d.dive_date || d.deployment_date || d.start_date || d.start_time;

      return {
        id: idStr,
        jobNo: jNo,
        name: dName,
        created_at: dDate,
        raw: d,
      };
    });

    return NextResponse.json(
      { deployments: mapped },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          "Pragma": "no-cache",
        },
      }
    );
  } catch (error: any) {
    console.error("[WorkspaceDeployments API] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
});
