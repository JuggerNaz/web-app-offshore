import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { withTenant } from "@/utils/tenant-auth";

export const GET = withTenant(async (request, { companyId, params }) => {
  try {
    const { id } = await params;
    const structureId = Number(id);

    if (isNaN(structureId)) {
      return NextResponse.json({ error: "Invalid platform ID" }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Fetch u_sow (Scope of Work) for this structure
    const { data: sows, error: sowsErr } = await (supabase as any)
      .from("u_sow")
      .select("id, jobpack_id")
      .eq("structure_id", structureId)
      .eq("company_id", companyId);

    if (sowsErr) throw sowsErr;

    const sowIds = sows?.map((s: any) => s.id) || [];
    const sowToJobpackMap: Record<number, number> = {};
    sows?.forEach((s: any) => {
      if (s.id && s.jobpack_id) {
        sowToJobpackMap[s.id] = s.jobpack_id;
      }
    });

    // 2. Fetch u_sow_items for the retrieved sows
    let sowItems: any[] = [];
    if (sowIds.length > 0) {
      const { data, error } = await (supabase as any)
        .from("u_sow_items")
        .select("sow_id, report_number")
        .in("sow_id", sowIds)
        .eq("company_id", companyId);
      
      if (error) throw error;
      sowItems = data || [];
    }

    // 3. Fetch insp_records for actual inspections
    const { data: records, error: recordsErr } = await (supabase as any)
      .from("insp_records")
      .select("jobpack_id, sow_report_no, component_id, inspection_type_id, rov_job_id, dive_job_id")
      .eq("structure_id", structureId)
      .eq("company_id", companyId);

    if (recordsErr) throw recordsErr;

    // 4. Resolve unique jobpack IDs
    const jobpackIdsSet = new Set<number>();
    sows?.forEach((s: any) => s.jobpack_id && jobpackIdsSet.add(s.jobpack_id));
    records?.forEach((r: any) => r.jobpack_id && jobpackIdsSet.add(r.jobpack_id));
    const jobpackIds = Array.from(jobpackIdsSet);

    // 5. Fetch jobpacks details
    let jobpacks: any[] = [];
    if (jobpackIds.length > 0) {
      const { data, error } = await (supabase as any)
        .from("jobpack")
        .select("id, name, metadata")
        .in("id", jobpackIds)
        .eq("company_id", companyId);
      
      if (error) throw error;
      jobpacks = data || [];
    }

    // 6. Compile statistics by jobpack
    const compiledJobpacks = jobpacks.map(jp => {
      const jpId = jp.id;
      const metadata = jp.metadata || {};

      // Resolve Job Type
      const plantype = metadata.plantype || "";
      const tasktype = metadata.tasktype || "";
      let jobType = "N/A";
      if (plantype && tasktype) {
        jobType = `${plantype} - ${tasktype}`;
      } else if (plantype || tasktype) {
        jobType = plantype || tasktype;
      }

      // Resolve Year
      let year = "N/A";
      if (metadata.istart) {
        try {
          const date = new Date(metadata.istart);
          if (!isNaN(date.getTime())) {
            year = String(date.getFullYear());
          }
        } catch (_) {}
      }

      // Collect SOW report numbers (only from insp_records for this structure & jobpack)
      const reportNumbersSet = new Set<string>();
      records?.forEach((rec: any) => {
        if (rec.jobpack_id === jpId && rec.sow_report_no) {
          reportNumbersSet.add(rec.sow_report_no.trim());
        }
      });

      // Distinct Inspection Types count
      const typesSet = new Set<number>();
      records?.forEach((rec: any) => {
        if (rec.jobpack_id === jpId && rec.inspection_type_id) {
          typesSet.add(rec.inspection_type_id);
        }
      });

      // Components inspected count
      const componentsInspectedSet = new Set<number>();
      records?.forEach((rec: any) => {
        if (rec.jobpack_id === jpId && rec.component_id) {
          componentsInspectedSet.add(rec.component_id);
        }
      });

      // ROV & Diving inspection types count
      const rovTypesSet = new Set<number>();
      const divingTypesSet = new Set<number>();
      records?.forEach((rec: any) => {
        if (rec.jobpack_id === jpId && rec.inspection_type_id) {
          if (rec.rov_job_id) {
            rovTypesSet.add(rec.inspection_type_id);
          }
          if (rec.dive_job_id) {
            divingTypesSet.add(rec.inspection_type_id);
          }
        }
      });

      return {
        jobpack_id: jpId,
        jobpack_name: jp.name || "Unnamed Jobpack",
        year,
        job_type: jobType,
        sow_report_nos: Array.from(reportNumbersSet).sort().join(", ") || "N/A",
        types_count: typesSet.size,
        components_inspected_count: componentsInspectedSet.size,
        rov_types_count: rovTypesSet.size,
        diving_types_count: divingTypesSet.size
      };
    });

    // Sort compiled jobpacks by year descending, name ascending
    compiledJobpacks.sort((a, b) => {
      const yearA = a.year === "N/A" ? 0 : Number(a.year);
      const yearB = b.year === "N/A" ? 0 : Number(b.year);
      if (yearB !== yearA) return yearB - yearA;
      return a.jobpack_name.localeCompare(b.jobpack_name);
    });

    return NextResponse.json({ data: compiledJobpacks });
  } catch (error: any) {
    console.error("[Platform Inspections API] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch platform inspections" }, { status: 500 });
  }
});
