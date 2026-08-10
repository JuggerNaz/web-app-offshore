/**
 * Search Report Generator — Client-side utility for generating inspection reports
 * from Global Search results without needing the full workspace context.
 *
 * Each inspection type maps to one or more report templates. When there are multiple
 * templates, the UI shows a picker so the user can choose which variant to print.
 */

import { createClient } from "@/utils/supabase/client";
import { getReportHeaderData } from "@/utils/company-settings";
import { getMGIProfileForJobpack } from "@/utils/mgi-profile-helper";

// ── Report Template Option ─────────────────────────────────────────────────────

export type ReportTemplateOption = {
  templateId: string;
  label: string;
  code: string;
  mode: "DIVING" | "ROV" | "BOTH";
};

// ── Template Map ────────────────────────────────────────────────────────────────
// Maps inspection_type_code (uppercase) → available report templates.
// Single-template types get an array of length 1.
// Multi-template types get an array of length > 1 → triggers the picker UI.

export const REPORT_TEMPLATE_MAP: Record<string, ReportTemplateOption[]> = {
  // ── DIVING ────────────────────────────────────────────────────────────────────
  GVINS: [
    { templateId: "gvins", label: "Diving GVI (GVINS)", code: "GVINS", mode: "DIVING" },
  ],
  BSINS: [
    { templateId: "bsins", label: "Diving Bolted Support (BSINS)", code: "BSINS", mode: "DIVING" },
  ],
  CVINS: [
    { templateId: "cvins", label: "Diving Close Visual (CVINS)", code: "CVINS", mode: "DIVING" },
  ],
  CLEAN: [
    { templateId: "clean", label: "Diving Cleaning (CLEAN)", code: "CLEAN", mode: "DIVING" },
  ],
  MPINS: [
    { templateId: "mpins", label: "Diving Magnetic Particle (MPINS)", code: "MPINS", mode: "DIVING" },
  ],
  UTWTK: [
    { templateId: "utwtk", label: "Diving UT Wall Thickness (UTWTK)", code: "UTWTK", mode: "DIVING" },
  ],
  SZONE: [
    { templateId: "szone", label: "Diving Splash Zone (SZONE)", code: "SZONE", mode: "DIVING" },
  ],
  CPCLB: [
    { templateId: "cpclb", label: "CP Calibration (CPCLB)", code: "CPCLB", mode: "DIVING" },
  ],
  UTCLB: [
    { templateId: "utclb", label: "UT Calibration (UTCLB)", code: "UTCLB", mode: "DIVING" },
  ],
  ACFMC: [
    { templateId: "acfmc", label: "ACFM Survey (ACFMC)", code: "ACFMC", mode: "DIVING" },
  ],
  PL_CO: [
    { templateId: "plco", label: "Coating Damage Inspection (PL_CO)", code: "PL_CO", mode: "DIVING" },
  ],
  PL_AN: [
    { templateId: "diving-anode", label: "Diving Anode Inspection", code: "PL_AN", mode: "DIVING" },
  ],
  PL_IC: [
    { templateId: "diving-item-report", label: "Item Inspection Report (Diving)", code: "PL_IC", mode: "DIVING" },
  ],
  ITMAIN: [
    { templateId: "diving-itmain-report", label: "Item Maintenance Inspection Report (Diving)", code: "ITMAIN", mode: "DIVING" },
  ],
  ANMAIN: [
    { templateId: "diving-anmain", label: "Anode Maintenance Report (ANMAIN)", code: "ANMAIN", mode: "DIVING" },
  ],
  DMGI: [
    { templateId: "diving-mgi", label: "Marine Growth Inspection Graph Report (Diving)", code: "DMGI", mode: "DIVING" },
  ],
  MGROW: [
    { templateId: "diving-mgi", label: "Marine Growth Inspection Graph Report (Diving)", code: "MGROW", mode: "DIVING" },
  ],
  // Multi-template: Caisson Diving
  DCASN: [
    { templateId: "diving-dcasn-report", label: "Caisson Inspection (Combined)", code: "DCASN", mode: "DIVING" },
    { templateId: "diving-dcasn-uw-report", label: "Caisson Underwater", code: "DCASN-UW", mode: "DIVING" },
    { templateId: "diving-dcasn-ts-report", label: "Caisson Above Water", code: "DCASN-TS", mode: "DIVING" },
  ],
  // Multi-template: Conductor Diving
  DCOND: [
    { templateId: "diving-dcond-report", label: "Conductor Inspection (Combined)", code: "DCOND", mode: "DIVING" },
    { templateId: "diving-dcond-uw-report", label: "Conductor Underwater", code: "DCOND-UW", mode: "DIVING" },
    { templateId: "diving-dcond-ts-report", label: "Conductor Above Water", code: "DCOND-TS", mode: "DIVING" },
  ],

  // ── ROV ────────────────────────────────────────────────────────────────────────
  RGVI: [
    { templateId: "rgvi", label: "General Visual (GVI)", code: "RGVI", mode: "ROV" },
  ],
  RSWNI: [
    { templateId: "rswni", label: "ROV Selected Node Report", code: "RSWNI", mode: "ROV" },
  ],
  RICMI: [
    { templateId: "ricmi", label: "ROV Inclinometer Survey", code: "RICMI", mode: "ROV" },
  ],
  RWDI: [
    { templateId: "rwdi", label: "ROV Water Depth Inspection", code: "RWDI", mode: "ROV" },
  ],
  RFMD: [
    { templateId: "rfmd", label: "FMD Survey", code: "RFMD", mode: "ROV" },
  ],
  RUTWT: [
    { templateId: "rutwt", label: "UTWT Survey", code: "RUTWT", mode: "ROV" },
  ],
  BL: [
    { templateId: "bl", label: "ROV Boatlanding Report", code: "BL", mode: "ROV" },
  ],
  RG: [
    { templateId: "rg", label: "ROV Riser Guard Report", code: "RG", mode: "ROV" },
  ],
  SG: [
    { templateId: "sg", label: "ROV Caisson Guard Report", code: "SG", mode: "ROV" },
  ],
  CU: [
    { templateId: "cu", label: "ROV Conductor Guard Report", code: "CU", mode: "ROV" },
  ],
  RSANI: [
    { templateId: "rsani", label: "ROV Selected Anode Report (SANI)", code: "RSANI", mode: "ROV" },
  ],
  // Multi-template: ROV Scour
  RSCOR: [
    { templateId: "rscor", label: "Scour Survey Sketch Report", code: "RSCOR", mode: "ROV" },
    { templateId: "rscor-v2", label: "Scour Survey Sketch v2", code: "RSCOR-V2", mode: "ROV" },
  ],
  // Multi-template: ROV Riser
  RRISI: [
    { templateId: "rrisi", label: "Riser Survey Sketch Report", code: "RRISI", mode: "ROV" },
    { templateId: "rrisi-detail", label: "Riser Inspection Detail Report", code: "RRISI-D", mode: "ROV" },
  ],
  JTISI: [
    { templateId: "jtisi", label: "J-Tube Survey Sketch Report", code: "JTISI", mode: "ROV" },
    { templateId: "jtisi-detail", label: "J-Tube Detail Report", code: "JTISI-D", mode: "ROV" },
  ],
  ITISI: [
    { templateId: "itisi", label: "I-Tube Survey Sketch Report", code: "ITISI", mode: "ROV" },
    { templateId: "itisi-detail", label: "I-Tube Detail Report", code: "ITISI-D", mode: "ROV" },
  ],
  // Multi-template: ROV Caisson
  RCASN: [
    { templateId: "rcasn", label: "ROV Caisson Report", code: "RCASN", mode: "ROV" },
    { templateId: "rcasn-sketch", label: "ROV Caisson Sketch Report", code: "RCASN-S", mode: "ROV" },
  ],
  // Multi-template: ROV Conductor
  RCOND: [
    { templateId: "rcond", label: "ROV Conductor Report", code: "RCOND", mode: "ROV" },
    { templateId: "rcond-sketch", label: "ROV Conductor Sketch Report", code: "RCOND-S", mode: "ROV" },
  ],
  // Multi-template: ROV Seabed
  RSEAB: [
    { templateId: "seabed-rov", label: "Seabed Inspection Sketch Report", code: "RSEAB", mode: "ROV" },
    { templateId: "seabed-debris-detail", label: "Seabed Debris Detail Report", code: "RSEAB-DD", mode: "ROV" },
    { templateId: "seabed-gas-detail", label: "Seabed Gas Seepage Detail Report", code: "RSEAB-GD", mode: "ROV" },
    { templateId: "seabed-crater-detail", label: "Seabed Crater Detail Report", code: "RSEAB-CD", mode: "ROV" },
  ],
  // Multi-template: ROV Marine Growth
  RMGI: [
    { templateId: "rmgi-graph", label: "Marine Growth Graph Report", code: "RMGI-G", mode: "ROV" },
    { templateId: "rmgi-table", label: "Marine Growth Inspection Report", code: "RMGI", mode: "ROV" },
  ],
  RSZCI: [
    { templateId: "rszci", label: "ROV Splash Zone (SZCI)", code: "RSZCI", mode: "ROV" },
  ],
  ANOMALY: [
    { templateId: "anomaly-report", label: "Defect & Anomaly Report", code: "ANOMALY", mode: "DIVING" },
  ],
};

/**
 * Get available report templates for a given inspection type code.
 * Falls back to a generic "Inspection Report" if no mapping exists.
 */
export function getTemplatesForInspectionType(
  inspTypeCode: string,
  mode?: "DIVING" | "ROV"
): ReportTemplateOption[] {
  const code = inspTypeCode.toUpperCase();
  const templates = REPORT_TEMPLATE_MAP[code];
  if (templates && templates.length > 0) {
    // Filter by mode if provided, but keep BOTH-mode templates
    if (mode) {
      const filtered = templates.filter(t => t.mode === mode || t.mode === "BOTH");
      return filtered.length > 0 ? filtered : templates;
    }
    return templates;
  }
  // Fallback: generic single template
  return [
    { templateId: "generic", label: `Inspection Report (${code})`, code, mode: mode || "BOTH" },
  ];
}

// ── Report Context ──────────────────────────────────────────────────────────────

interface SearchReportContext {
  inspId: number;
  anomalyId?: number;
  inspectionTypeCode: string;
  jobpackId: number;
  structureId: number;
  sowReportNo?: string;
  mode: "DIVING" | "ROV";
}

/**
 * Generate a report blob from a search result.
 * Fetches all needed data from Supabase and calls the appropriate report generator.
 */
export async function generateReportFromSearch(
  ctx: SearchReportContext,
  templateId: string,
  printFriendly: boolean = false,
  showSignatures: boolean = true
): Promise<Blob | void> {
  const supabase = createClient();

  // If this is an anomaly report, handle it directly with anomalyId filter!
  if (templateId === "anomaly-report" || ctx.inspectionTypeCode === "ANOMALY" || ctx.anomalyId) {
    const { generateDefectAnomalyReport } = await import("@/utils/report-generators/defect-anomaly-report");
    const settings = await getReportHeaderData();
    const companyInfo = {
      company_name: settings.companyName,
      logo_url: settings.companyLogo,
      department_name: settings.departmentName,
    };
    return await generateDefectAnomalyReport(
      { id: ctx.jobpackId },
      { id: ctx.structureId },
      ctx.sowReportNo || "",
      companyInfo,
      {
        anomalyId: ctx.anomalyId,
        inspectionId: ctx.inspId,
        reportYear: new Date().getFullYear().toString(),
        preparedBy: { name: "Inspector", date: new Date().toISOString() },
        showContractorLogo: true,
        showPageNumbers: true,
        printFriendly,
        showSignatures,
        returnBlob: true,
      }
    ) as Blob;
  }

  // 1. Fetch the inspection record(s) for this SOW report
  let query = (supabase as any)
    .from("insp_records")
    .select(`
      insp_id,
      status,
      has_anomaly,
      elevation,
      description,
      inspection_date,
      inspection_data,
      inspection_type_code,
      sow_report_no,
      jobpack_id,
      structure_id,
      component_id,
      rov_job_id,
      dive_job_id,
      structure_components:component_id!left(id, q_id, code)
    `)
    .eq("jobpack_id", ctx.jobpackId)
    .eq("structure_id", ctx.structureId);

  if (ctx.sowReportNo && ctx.sowReportNo !== "all") {
    query = query.eq("sow_report_no", ctx.sowReportNo);
  }

  const { data: records, error: recError } = await query.order("inspection_date", { ascending: false });

  if (recError || !records || records.length === 0) {
    console.error("Failed to fetch inspection records:", recError);
    return;
  }

  // 2. Fetch header data
  const settings = await getReportHeaderData();

  // Fetch platform/pipeline name
  const { data: platform } = await (supabase as any)
    .from("platform")
    .select("title")
    .eq("plat_id", ctx.structureId)
    .maybeSingle();

  let structureName = platform?.title || "";
  if (!structureName) {
    const { data: pipeline } = await (supabase as any)
      .from("u_pipeline")
      .select("title")
      .eq("pipe_id", ctx.structureId)
      .maybeSingle();
    structureName = pipeline?.title || `Structure #${ctx.structureId}`;
  }

  // Fetch jobpack info
  const { data: jobPack } = await (supabase as any)
    .from("jobpack")
    .select("name, metadata")
    .eq("id", ctx.jobpackId)
    .single();

  // Fetch contractor logo
  let contractorLogoUrl = "";
  if (jobPack?.metadata?.contrac) {
    const { data: contrData } = await (supabase as any)
      .from("u_lib_list")
      .select("logo_url")
      .eq("lib_code", "CONTR_NAM")
      .eq("lib_id", jobPack.metadata.contrac)
      .maybeSingle();
    contractorLogoUrl = contrData?.logo_url || "";
  }

  const headerData = {
    platformName: structureName,
    jobpackName: jobPack?.name || "",
    sowReportNo: ctx.sowReportNo || "",
    contractorLogoUrl,
    vessel: jobPack?.metadata?.vessel_name || "",
  };

  const companyInfo = {
    company_name: settings.companyName,
    logo_url: settings.companyLogo,
    department_name: settings.departmentName,
  };

  const reportOpts: any = {
    returnBlob: true,
    printFriendly,
    showSignatures,
    structureId: ctx.structureId,
    jobPackId: ctx.jobpackId,
    sowReportNo: ctx.sowReportNo || "",
  };

  // 3. Route to the correct generator
  const code = ctx.inspectionTypeCode.toUpperCase();
  const tid = templateId.toLowerCase();

  try {
    return await routeToGenerator(tid, code, records, headerData, companyInfo, reportOpts, supabase);
  } catch (error) {
    console.error(`[SearchReportGenerator] Error generating report (template=${templateId}, code=${code}):`, error);
    return;
  }
}

// ── Generator Router ────────────────────────────────────────────────────────────

async function routeToGenerator(
  templateId: string,
  typeCode: string,
  records: any[],
  headerData: any,
  companyInfo: any,
  opts: any,
  supabase: any
): Promise<Blob | void> {
  // Filter records by inspection type code (fallback to all records if code filtering returns empty)
  const filterByCode = (codes: string[]) => {
    const filtered = records.filter((r: any) => {
      const rc = (r.inspection_type_code || "").toUpperCase();
      return codes.includes(rc);
    });
    return filtered.length > 0 ? filtered : records;
  };

  switch (templateId) {
    // ── DIVING ────────────────────────────────────────────────────────────────
    case "gvins": {
      const recs = filterByCode(["GVINS"]);
      if (!recs.length) return;
      const { generateDivingGVINSReport } = await import("@/utils/report-generators/diving-gvins-report");
      return await generateDivingGVINSReport(recs, headerData, companyInfo, opts) as Blob;
    }
    case "bsins": {
      const recs = filterByCode(["BSINS"]);
      if (!recs.length) return;
      const { generateDivingBSINSReport } = await import("@/utils/report-generators/diving-bsins-report");
      return await generateDivingBSINSReport(recs, headerData, companyInfo, opts) as Blob;
    }
    case "cvins": {
      const recs = filterByCode(["CVINS"]);
      if (!recs.length) return;
      const { generateDivingCVINSReport } = await import("@/utils/report-generators/diving-cvins-report");
      return await generateDivingCVINSReport(recs, headerData, companyInfo, opts) as Blob;
    }
    case "clean": {
      const recs = filterByCode(["CLEAN"]);
      if (!recs.length) return;
      const { generateDivingCLEANReport } = await import("@/utils/report-generators/diving-clean-report");
      return await generateDivingCLEANReport(recs, headerData, companyInfo, opts) as Blob;
    }
    case "mpins": {
      const recs = filterByCode(["MPINS"]);
      if (!recs.length) return;
      const { generateDivingMPINSReport } = await import("@/utils/report-generators/diving-mpins-report");
      return await generateDivingMPINSReport(recs, headerData, companyInfo, opts) as Blob;
    }
    case "utwtk": {
      const recs = filterByCode(["UTWTK", "DUTWT"]);
      if (!recs.length) return;
      const { generateDivingUTWTKReport } = await import("@/utils/report-generators/diving-utwtk-report");
      return await generateDivingUTWTKReport(recs, headerData, companyInfo, opts) as Blob;
    }
    case "szone": {
      const recs = filterByCode(["SZONE", "DSZCI"]);
      if (!recs.length) return;
      const { generateDivingSZONEReport } = await import("@/utils/report-generators/diving-szone-report");
      return await generateDivingSZONEReport(recs, headerData, companyInfo, opts, supabase) as Blob;
    }
    case "cpclb": {
      const recs = filterByCode(["CPCLB"]);
      if (!recs.length) return;
      const { generateDivingCPCLBReport } = await import("@/utils/report-generators/diving-cpclb-report");
      return await generateDivingCPCLBReport(recs, headerData, companyInfo, opts) as Blob;
    }
    case "utclb": {
      const recs = filterByCode(["UTCLB"]);
      if (!recs.length) return;
      const { generateDivingUTCLBReport } = await import("@/utils/report-generators/diving-utclb-report");
      return await generateDivingUTCLBReport(recs, headerData, companyInfo, opts) as Blob;
    }
    case "acfmc": {
      const recs = filterByCode(["ACFMC"]);
      if (!recs.length) return;
      const { generateDivingACFMCReport } = await import("@/utils/report-generators/diving-acfmc-report");
      return await generateDivingACFMCReport(recs, headerData, companyInfo, opts) as Blob;
    }
    case "plco": {
      const recs = filterByCode(["PL_CO"]);
      if (!recs.length) return;
      const { generateDivingPLCOReport } = await import("@/utils/report-generators/diving-plco-report");
      return await generateDivingPLCOReport(recs, headerData, companyInfo, opts) as Blob;
    }
    case "diving-item-report":
    case "plic": {
      const recs = filterByCode(["PL_IC"]);
      if (!recs.length) return;
      const { generateDivingItemReport } = await import("@/utils/report-generators/diving-item-report");
      return await generateDivingItemReport(recs, headerData, companyInfo, opts) as Blob;
    }
    case "diving-itmain-report":
    case "itmain": {
      const recs = filterByCode(["ITMAIN"]);
      if (!recs.length) return;
      const { generateDivingITMAINReport } = await import("@/utils/report-generators/diving-itmain-report");
      return await generateDivingITMAINReport(recs, headerData, companyInfo, opts) as Blob;
    }
    case "diving-anode": {
      const recs = filterByCode(["PL_AN"]);
      if (!recs.length) return;
      const { generateDivingAnodeReport } = await import("@/utils/report-generators/diving-anode-report");
      return await generateDivingAnodeReport(recs, headerData, companyInfo, opts) as Blob;
    }
    case "diving-anmain": {
      const recs = filterByCode(["ANMAIN"]);
      if (!recs.length) return;
      const { generateDivingANMAINReport } = await import("@/utils/report-generators/diving-anmain-report");
      return await generateDivingANMAINReport(recs, headerData, companyInfo, opts) as Blob;
    }
    case "diving-mgi": {
      const recs = filterByCode(["DMGI", "MGROW"]);
      if (!recs.length) return;
      const profileId = recs.find((r: any) => r.inspection_data?._mgi_profile_id)?.inspection_data?._mgi_profile_id;
      const mgiProfile = await getMGIProfileForJobpack(supabase, opts.jobPackId, profileId);
      const { generateDivingMGIReport } = await import("@/utils/report-generators/diving-mgi-report");
      return await generateDivingMGIReport(recs, mgiProfile, headerData, companyInfo, opts, supabase) as Blob;
    }
    // Caisson Diving variants
    case "diving-dcasn-report": {
      const recs = filterByCode(["GVINS", "CVINS", "CPSURV", "UTWTK", "DUTWT"]);
      if (!recs.length) return;
      const { generateDivingDCASNReport } = await import("@/utils/report-generators/diving-dcasn-report");
      return await generateDivingDCASNReport(recs, headerData, companyInfo, opts) as Blob;
    }
    case "diving-dcasn-uw-report": {
      const recs = filterByCode(["GVINS", "CVINS", "CPSURV", "UTWTK", "DUTWT"]);
      if (!recs.length) return;
      const { generateDivingDCASNUWReport } = await import("@/utils/report-generators/diving-dcasn-uw-report");
      return await generateDivingDCASNUWReport(recs, headerData, companyInfo, opts) as Blob;
    }
    case "diving-dcasn-ts-report": {
      const recs = filterByCode(["GVINS", "CVINS", "CPSURV", "UTWTK", "DUTWT"]);
      if (!recs.length) return;
      const { generateDivingDCASNTSReport } = await import("@/utils/report-generators/diving-dcasn-ts-report");
      return await generateDivingDCASNTSReport(recs, headerData, companyInfo, opts) as Blob;
    }
    // Conductor Diving variants
    case "diving-dcond-report": {
      const recs = filterByCode(["GVINS", "CVINS", "CPSURV", "UTWTK", "DUTWT"]);
      if (!recs.length) return;
      const { generateDivingDCONDReport } = await import("@/utils/report-generators/diving-dcond-report");
      return await generateDivingDCONDReport(recs, headerData, companyInfo, opts) as Blob;
    }
    case "diving-dcond-uw-report": {
      const recs = filterByCode(["GVINS", "CVINS", "CPSURV", "UTWTK", "DUTWT"]);
      if (!recs.length) return;
      const { generateDivingDCONDUWReport } = await import("@/utils/report-generators/diving-dcond-uw-report");
      return await generateDivingDCONDUWReport(recs, headerData, companyInfo, opts) as Blob;
    }
    case "diving-dcond-ts-report": {
      const recs = filterByCode(["GVINS", "CVINS", "CPSURV", "UTWTK", "DUTWT"]);
      if (!recs.length) return;
      const { generateDivingDCONDTSReport } = await import("@/utils/report-generators/diving-dcond-ts-report");
      return await generateDivingDCONDTSReport(recs, headerData, companyInfo, opts) as Blob;
    }

    // ── ROV ──────────────────────────────────────────────────────────────────
    case "rgvi": {
      const recs = filterByCode(["RGVI"]);
      if (!recs.length) return;
      const { generateROVRGVIReport } = await import("@/utils/report-generators/rov-rgvi-report");
      return await generateROVRGVIReport(recs, headerData, companyInfo, opts) as Blob;
    }
    case "rswni": {
      const recs = filterByCode(["RSWNI", "SWNI"]);
      if (!recs.length) return;
      const { generateROVSelectedNodeReport } = await import("@/utils/report-generators/rov-selected-node-report");
      return await generateROVSelectedNodeReport(recs, headerData, companyInfo, opts) as Blob;
    }
    case "ricmi": {
      const recs = filterByCode(["RICMI"]);
      if (!recs.length) return;
      const { generateROVRICMIReport } = await import("@/utils/report-generators/rov-ricmi-report");
      return await generateROVRICMIReport(recs, headerData, companyInfo, opts) as Blob;
    }
    case "rwdi": {
      const recs = filterByCode(["RWDI"]);
      if (!recs.length) return;
      const { generateROVRWDIReport } = await import("@/utils/report-generators/rov-rwdi-report");
      return await generateROVRWDIReport(recs, headerData, companyInfo, opts) as Blob;
    }
    case "rfmd": {
      const recs = filterByCode(["RFMD", "FMD"]);
      if (!recs.length) return;
      const { generateROVFMDReport } = await import("@/utils/report-generators/rov-fmd-report");
      return await generateROVFMDReport(recs, headerData, companyInfo, opts) as Blob;
    }
    case "dfmd":
    case "diving-fmd-report": {
      const recs = filterByCode(["FLOOD", "FMD", "DFMD"]);
      if (!recs.length) return;
      const { generateDivingFMDReport } = await import("@/utils/report-generators/diving-fmd-report");
      return await generateDivingFMDReport(recs, headerData, companyInfo, opts) as Blob;
    }
    case "measu":
    case "diving-measu-report": {
      const recs = filterByCode(["MEASU", "DMSR", "MEASUREMENT", "DMEAS"]);
      if (!recs.length) return;
      const { generateDivingMEASUReport } = await import("@/utils/report-generators/diving-measu-report");
      return await generateDivingMEASUReport(recs, headerData, companyInfo, opts) as Blob;
    }
    case "drrisi":
    case "diving-rrisi-report": {
      const recs = filterByCode(["DRRISI", "DRISI", "RSURV", "RISER", "DRSER", "DRSI", "RRISI", "JTISI", "ITISI"]);
      if (!recs.length) return;
      const { generateDivingRRISIReport } = await import("@/utils/report-generators/diving-rrisi-report");
      return await generateDivingRRISIReport(recs, headerData, companyInfo, { ...opts, reportType: 'R' }) as Blob;
    }
    case "diving-jtisi-report": {
      const recs = filterByCode(["DRRISI", "DRISI", "RSURV", "RISER", "DRSER", "DRSI", "RRISI", "JTISI", "ITISI"]);
      if (!recs.length) return;
      const { generateDivingRRISIReport } = await import("@/utils/report-generators/diving-rrisi-report");
      return await generateDivingRRISIReport(recs, headerData, companyInfo, { ...opts, reportType: 'J' }) as Blob;
    }
    case "diving-itisi-report": {
      const recs = filterByCode(["DRRISI", "DRISI", "RSURV", "RISER", "DRSER", "DRSI", "RRISI", "JTISI", "ITISI"]);
      if (!recs.length) return;
      const { generateDivingRRISIReport } = await import("@/utils/report-generators/diving-rrisi-report");
      return await generateDivingRRISIReport(recs, headerData, companyInfo, { ...opts, reportType: 'I' }) as Blob;
    }
    case "drrisi-detail":
    case "diving-rrisi-detail-report": {
      const recs = filterByCode(["DRRISI", "DRISI", "RSURV", "RISER", "DRSER", "DRSI", "RRISI", "JTISI", "ITISI"]);
      if (!recs.length) return;
      const { generateDivingRRISIDetailReport } = await import("@/utils/report-generators/diving-rrisi-detail-report");
      return await generateDivingRRISIDetailReport(recs, headerData, companyInfo, { ...opts, reportType: 'R' }) as Blob;
    }
    case "diving-jtisi-detail-report": {
      const recs = filterByCode(["DRRISI", "DRISI", "RSURV", "RISER", "DRSER", "DRSI", "RRISI", "JTISI", "ITISI"]);
      if (!recs.length) return;
      const { generateDivingRRISIDetailReport } = await import("@/utils/report-generators/diving-rrisi-detail-report");
      return await generateDivingRRISIDetailReport(recs, headerData, companyInfo, { ...opts, reportType: 'J' }) as Blob;
    }
    case "diving-itisi-detail-report": {
      const recs = filterByCode(["DRRISI", "DRISI", "RSURV", "RISER", "DRSER", "DRSI", "RRISI", "JTISI", "ITISI"]);
      if (!recs.length) return;
      const { generateDivingRRISIDetailReport } = await import("@/utils/report-generators/diving-rrisi-detail-report");
      return await generateDivingRRISIDetailReport(recs, headerData, companyInfo, { ...opts, reportType: 'I' }) as Blob;
    }
    case "rutwt": {
      const recs = filterByCode(["RUTWT"]);
      if (!recs.length) return;
      const { generateROVUTWTReport } = await import("@/utils/report-generators/rov-utwt-report");
      return await generateROVUTWTReport(recs, headerData, companyInfo, opts) as Blob;
    }
    case "rsani": {
      const recs = records.filter((r: any) => {
        const rc = (r.inspection_type_code || "").toUpperCase();
        const cc = (r.structure_components?.code || "").toUpperCase();
        return rc === "RSANI" && cc === "AN";
      });
      if (!recs.length) return;
      const { generateROVAnodeRSANIReport } = await import("@/utils/report-generators/rov-anode-rsani-report");
      return await generateROVAnodeRSANIReport(recs, headerData, companyInfo, opts) as Blob;
    }
    case "rscor": {
      const recs = filterByCode(["RSCOR", "SCOUR"]);
      if (!recs.length) return;
      const { generateROVRSCORReport } = await import("@/utils/report-generators/rov-rscor-report");
      return await generateROVRSCORReport(recs, headerData, companyInfo, opts) as Blob;
    }
    case "rscor-v2": {
      const recs = filterByCode(["RSCOR", "SCOUR"]);
      if (!recs.length) return;
      const { generateROVRSCORV2Report } = await import("@/utils/report-generators/rov-rscor-v2-report");
      return await generateROVRSCORV2Report(recs, headerData, companyInfo, opts) as Blob;
    }
    case "rrisi": {
      const recs = filterByCode(["RRISI"]);
      if (!recs.length) return;
      const { generateROVRRISIReport } = await import("@/utils/report-generators/rov-rrisi-report");
      return await generateROVRRISIReport(recs, headerData, companyInfo, { ...opts, reportType: "R" }) as Blob;
    }
    case "rrisi-detail": {
      const recs = filterByCode(["RRISI"]);
      if (!recs.length) return;
      const { generateROVRRISIDetailReport } = await import("@/utils/report-generators/rov-rrisi-detail-report");
      return await generateROVRRISIDetailReport(recs, headerData, companyInfo, opts) as Blob;
    }
    case "jtisi": {
      const recs = filterByCode(["JTISI", "RRISI"]);
      if (!recs.length) return;
      const { generateROVRRISIReport } = await import("@/utils/report-generators/rov-rrisi-report");
      return await generateROVRRISIReport(recs, headerData, companyInfo, { ...opts, reportType: "J" }) as Blob;
    }
    case "jtisi-detail": {
      const recs = filterByCode(["JTISI", "RRISI"]);
      if (!recs.length) return;
      const { generateROVRRISIJTubeDetailReport } = await import("@/utils/report-generators/rov-jtisi-detail-report");
      return await generateROVRRISIJTubeDetailReport(recs, headerData, companyInfo, opts) as Blob;
    }
    case "itisi": {
      const recs = filterByCode(["ITISI", "RRISI"]);
      if (!recs.length) return;
      const { generateROVRRISIReport } = await import("@/utils/report-generators/rov-rrisi-report");
      return await generateROVRRISIReport(recs, headerData, companyInfo, { ...opts, reportType: "I" }) as Blob;
    }
    case "itisi-detail": {
      const recs = filterByCode(["ITISI", "RRISI"]);
      if (!recs.length) return;
      const { generateROVRRISIITubeDetailReport } = await import("@/utils/report-generators/rov-itisi-detail-report");
      return await generateROVRRISIITubeDetailReport(recs, headerData, companyInfo, opts) as Blob;
    }
    case "rcasn": {
      const recs = filterByCode(["RCASN"]);
      if (!recs.length) return;
      const { generateROVCasnReport } = await import("@/utils/report-generators/rov-rcasn-report");
      return await generateROVCasnReport(recs, headerData, companyInfo, opts) as Blob;
    }
    case "rcasn-sketch": {
      const recs = filterByCode(["RCASN"]);
      if (!recs.length) return;
      const { generateROVCasnSketchReport } = await import("@/utils/report-generators/rov-rcasn-sketch-report");
      return await generateROVCasnSketchReport(recs, headerData, companyInfo, opts) as Blob;
    }
    case "rcond": {
      const recs = filterByCode(["RCOND", "RCON"]);
      if (!recs.length) return;
      const { generateROVCondReport } = await import("@/utils/report-generators/rov-rcond-report");
      return await generateROVCondReport(recs, headerData, companyInfo, opts) as Blob;
    }
    case "rcond-sketch": {
      const recs = filterByCode(["RCOND", "RCON"]);
      if (!recs.length) return;
      const { generateROVCondSketchReport } = await import("@/utils/report-generators/rov-rcond-sketch-report");
      return await generateROVCondSketchReport(recs, headerData, companyInfo, opts) as Blob;
    }
    case "bl": {
      const recs = filterByCode(["BL", "BOATLANDING"]);
      if (!recs.length) return;
      const { generateROVBoatlandingReport } = await import("@/utils/report-generators/rov-boatlanding-report");
      return await generateROVBoatlandingReport(recs.map((r: any) => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })), { ...headerData, vessel: headerData.vessel }, companyInfo, { ...opts, jobPackId: opts.jobPackId, structureId: opts.structureId, sowReportNo: headerData.sowReportNo }) as Blob;
    }
    case "rg": {
      const recs = filterByCode(["RG", "RISERGUARD"]);
      if (!recs.length) return;
      const { generateROVRiserGuardReport } = await import("@/utils/report-generators/rov-riser-guard-report");
      return await generateROVRiserGuardReport(recs.map((r: any) => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })), { ...headerData, vessel: headerData.vessel }, companyInfo, { ...opts, jobPackId: opts.jobPackId, structureId: opts.structureId, sowReportNo: headerData.sowReportNo }) as Blob;
    }
    case "sg": {
      const recs = filterByCode(["SG", "CAISSONGUARD"]);
      if (!recs.length) return;
      const { generateROVCaissonGuardReport } = await import("@/utils/report-generators/rov-caisson-guard-report");
      return await generateROVCaissonGuardReport(recs.map((r: any) => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })), { ...headerData, vessel: headerData.vessel }, companyInfo, { ...opts, jobPackId: opts.jobPackId, structureId: opts.structureId, sowReportNo: headerData.sowReportNo }) as Blob;
    }
    case "cu": {
      const recs = filterByCode(["CU", "CONDUCTORGUARD"]);
      if (!recs.length) return;
      const { generateROVConductorGuardReport } = await import("@/utils/report-generators/rov-conductor-guard-report");
      return await generateROVConductorGuardReport(recs.map((r: any) => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })), { ...headerData, vessel: headerData.vessel }, companyInfo, { ...opts, jobPackId: opts.jobPackId, structureId: opts.structureId, sowReportNo: headerData.sowReportNo }) as Blob;
    }
    case "rszci": {
      const recs = filterByCode(["RSZCI"]);
      if (!recs.length) return;
      const { generateROVSZCIReport } = await import("@/utils/report-generators/rov-szci-report");
      return await generateROVSZCIReport(recs, headerData, companyInfo, opts) as Blob;
    }
    // Seabed variants
    case "seabed-rov": {
      const recs = filterByCode(["RSEAB", "SEABED"]);
      if (!recs.length) return;
      const { generateSeabedSurveyReport } = await import("@/utils/report-generators/seabed-survey-report");
      return await generateSeabedSurveyReport(
        { id: opts.jobPackId, name: headerData.jobpackName },
        { id: opts.structureId, name: headerData.platformName },
        opts.sowReportNo || "",
        companyInfo,
        opts,
        ""
      ) as Blob;
    }
    case "seabed-debris-detail": {
      const recs = filterByCode(["RSEAB", "SEABED"]);
      if (!recs.length) return;
      const { generateROVRSEABDetailReport } = await import("@/utils/report-generators/rov-rseab-detail-report");
      return await generateROVRSEABDetailReport(recs.map((r: any) => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })), headerData, companyInfo, opts) as Blob;
    }
    case "seabed-gas-detail": {
      const recs = filterByCode(["RSEAB", "SEABED"]);
      if (!recs.length) return;
      const { generateROVRSEABGasDetailReport } = await import("@/utils/report-generators/rov-rseab-gas-detail-report");
      return await generateROVRSEABGasDetailReport(recs.map((r: any) => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })), headerData, companyInfo, opts) as Blob;
    }
    case "seabed-crater-detail": {
      const recs = filterByCode(["RSEAB", "SEABED"]);
      if (!recs.length) return;
      const { generateROVRSEABCraterDetailReport } = await import("@/utils/report-generators/rov-rseab-crater-detail-report");
      return await generateROVRSEABCraterDetailReport(recs.map((r: any) => ({ ...r, inspection_data: r.inspection_data || r.inspection_dat })), headerData, companyInfo, opts) as Blob;
    }
    // Marine Growth ROV variants
    case "rmgi-graph": {
      const recs = filterByCode(["RMGI", "MGROW"]);
      if (!recs.length) return;
      const profileId = recs.find((r: any) => r.inspection_data?._mgi_profile_id)?.inspection_data?._mgi_profile_id;
      const mgiProfile = await getMGIProfileForJobpack(supabase, opts.jobPackId, profileId);
      const { generateROVMGIGraphReport } = await import("@/utils/report-generators/rov-mgi-report");
      return await generateROVMGIGraphReport(recs, mgiProfile, headerData, companyInfo, opts) as Blob;
    }
    case "rmgi-table": {
      const recs = filterByCode(["RMGI"]);
      if (!recs.length) return;
      const { generateROVRMGIReport } = await import("@/utils/report-generators/rov-rmgi-report");
      return await generateROVRMGIReport(recs, headerData, companyInfo, opts) as Blob;
    }

    // Defect & Anomaly Report
    case "anomaly-report": {
      const { generateDefectAnomalyReport } = await import("@/utils/report-generators/defect-anomaly-report");
      const jobPack = { id: opts.jobPackId };
      const structure = { id: opts.structureId };
      return await generateDefectAnomalyReport(
        jobPack,
        structure,
        opts.sowReportNo || "",
        companyInfo,
        {
          ...opts,
          anomalyId: opts.anomalyId || opts.inspId,
          inspectionId: opts.inspId,
          reportYear: new Date().getFullYear().toString(),
          preparedBy: { name: "Inspector", date: new Date().toISOString() },
          showContractorLogo: true,
          showPageNumbers: true,
          returnBlob: true,
        }
      ) as Blob;
    }

    // ── Fallback: Generic Inspection Report ─────────────────────────────────
    default: {
      const recs = filterByCode([typeCode]);
      const targetRecord = recs.length > 0 ? recs[0] : records[0];
      if (!targetRecord?.insp_id) return;

      const { generateInspectionReport } = await import("@/utils/report-generators/inspection-report");
      return await generateInspectionReport(targetRecord.insp_id, companyInfo, opts) as Blob;
    }
  }
}
