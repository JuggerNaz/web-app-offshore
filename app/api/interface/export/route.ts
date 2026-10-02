import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { withTenant } from "@/utils/tenant-auth";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import fs from "fs";
import path from "path";
import { INITIAL_CLIENT_PROFILES, ClientProfile, ClientInterfaceDef, TemplateSheet } from "@/utils/interface-templates";
import { calculateInterpolatedMgiThreshold } from "@/utils/mgi-profile-helper";

export const POST = withTenant(async (request, { companyId, user }) => {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const {
      clientId = "pcsb",
      interfaceId = "pcsb-sic",
      structureIds = [],
      structureType = "ALL", // "ALL" | "PLATFORM" | "PIPELINE"
      jobpackMode = "ALL", // "ALL" | "SELECTED"
      jobpackIds = [],
      sowReportMode = "ALL", // "ALL" | "SELECTED"
      sowReportNos = [],
      sowReportNo = "",
      inspectionTypes = [],
      format = "individual_xlsx", // "individual_xlsx" | "individual_txt" | "individual_csv" | "single_xlsx" | "txt_zip" | "csv_zip" | "xlsx"
      destinationFolder = "",
      fileName = "",
      customInterface = null,
      singleTableCode = null, // e.g. "ANS", "CPS", etc.
      singleTableId = null,   // e.g. "sics-ans"
    } = body;

    const effectiveSowReportNos: string[] = (
      Array.isArray(sowReportNos) && sowReportNos.length > 0
        ? sowReportNos
        : (sowReportNo && sowReportNo !== "ALL" ? [sowReportNo] : [])
    ).map((s) => String(s).trim()).filter(Boolean);

    const isSowFiltered = (sowReportMode === "SELECTED" || effectiveSowReportNos.length > 0) && effectiveSowReportNos.length > 0;

    // Resolve client & interface definition
    const clientProfile: ClientProfile = INITIAL_CLIENT_PROFILES.find((c) => c.id === clientId) || INITIAL_CLIENT_PROFILES[0];
    const activeInterface: ClientInterfaceDef = customInterface || clientProfile.interfaces.find((i) => i.id === interfaceId) || clientProfile.interfaces[0];

    // Determine templates to process early
    let templatesToProcess = activeInterface.templates;
    if (singleTableCode) {
      const match = activeInterface.templates.filter(
        (t) => t.identifierCode.toUpperCase() === String(singleTableCode).toUpperCase()
      );
      if (match.length > 0) {
        templatesToProcess = [match[0]];
      } else {
        const idMatch = activeInterface.templates.filter((t) => t.id === singleTableCode);
        if (idMatch.length > 0) templatesToProcess = [idMatch[0]];
      }
    } else if (singleTableId) {
      const idMatch = activeInterface.templates.filter((t) => t.id === singleTableId);
      if (idMatch.length > 0) templatesToProcess = [idMatch[0]];
    }

    const isSingleTableExport = (Boolean(singleTableCode) || Boolean(singleTableId)) && templatesToProcess.length === 1;
    const singleCode = isSingleTableExport ? templatesToProcess[0].identifierCode.toUpperCase() : "";

    const targetCodesMap: Record<string, string[]> = {
      GVS: ["GVINS", "GVI", "GENIN", "GVS", "GENERAL_VISUAL", "GENERAL VISUAL", "RGVI", "PLATGI", "PGS"],
      MGS: ["MGROW", "MGINS", "MGCLB", "MGS", "MARINE_GROWTH", "MARINE GROWTH", "RMGI", "PGS"],
      SCS: ["SCR", "SCOUR", "RSCOR", "SCOUR_SURVEY", "SCOUR_INSP", "SCOUR INSPECTION", "SCOUR SURVEY", "PGS"],
      DBS: ["PL_DB", "DEBRIS", "DBS", "RGVI", "RRISI", "RCOND", "RCASN", "PGS"],
      CPS: ["CP", "CPRDG", "CPINS", "CPS", "RCP", "SZS", "BSS", "BSINS", "CPSURV", "SZONE", "PIPECP", "CPCLB", "RGVI", "RSANI", "RRISI", "RSZCI", "RSWNI", "RCOND", "RCASN", "PGS"],
      ANS: ["ANODE", "ANOD", "ANS", "RANS", "PL_AN", "ANMIN", "RGVI", "RSANI", "PGS"],
      FDS: ["FLOOD", "FDS", "FMD", "RFMD", "PGS"],
      MPS: ["MPINS", "MPI", "MPS", "ACFMC", "AFMC", "ACFM", "AFS", "PGS"],
      UTS: ["UTINS", "UTS", "UT", "RUT", "SZS", "PGS"],
      PHS: ["PHOTO", "PHS", "PGS"],
      VDS: ["VIDEO", "VDS", "PGS"],
      PGS: ["RGVI", "RMGI", "RSANI", "RFMD", "RSCOR", "RCASN", "RCOND", "RICMI", "RRISI", "RSEAB", "RSWNI", "RSZCI", "RUTWT", "RWDI", "PGS", "ROVGEN"],
      RSS: ["RISER", "RSS", "RISER_SURVEY", "RISER SURVEY", "RISERSURVEY", "RRISI", "RGVI", "PGS"],
      BTS: ["BOTTM"],
    };

    const needsAttachments = templatesToProcess.some((t) => t.queryStrategy === "ATTACHMENTS" || t.identifierCode === "ATS");
    const needsVideo = templatesToProcess.some((t) => ["VDS", "PGS"].includes(t.identifierCode) || t.id === "sics-pgs");
    const needsPipeGeo = templatesToProcess.some((t) => t.identifierCode === "PRS" || t.identifierCode === "PL_DB");
    const needsMgiProfiles = templatesToProcess.some((t) => t.identifierCode === "MGS");

    const selectedStrIds = (structureIds || []).map(Number).filter((n: number) => !isNaN(n) && n > 0);

    // 1. Fetch Structures & Platforms
    let strQuery = (supabase as any).from("structure").select("*");
    if (selectedStrIds.length > 0) {
      strQuery = strQuery.in("str_id", selectedStrIds);
    }
    if (structureType && structureType !== "ALL") {
      strQuery = strQuery.eq("str_type", structureType.toUpperCase());
    }

    const { data: structuresData } = await strQuery;
    const structureMap = new Map<number, any>();
    const activeStrIds = selectedStrIds.length > 0
      ? selectedStrIds
      : (structuresData || []).map((s: any) => Number(s.str_id || s.plat_id || s.id));

    // Fetch platform & pipeline details
    const [{ data: platformData }, { data: pipelineData }] = await Promise.all([
      (supabase as any)
        .from("platform")
        .select("*")
        .in("plat_id", activeStrIds.length > 0 ? activeStrIds : [0]),
      (supabase as any)
        .from("u_pipeline")
        .select("*")
        .in("pipe_id", activeStrIds.length > 0 ? activeStrIds : [0]),
    ]);

    (structuresData || []).forEach((s: any) => {
      const sid = Number(s.str_id || s.id);
      if (s.str_type === "PLATFORM") {
        const p = platformData?.find((item: any) => Number(item.plat_id) === sid);
        structureMap.set(sid, {
          ...s,
          title: p?.title || s.str_name || `Platform ${sid}`,
          pfield: p?.pfield || s.field_name || "Offshore",
          pdesc: p?.pdesc || s.description || p?.title || "Offshore Platform Facility",
          ptype: p?.ptype || "PLATFORM",
          def_unit: p?.unit_type || p?.def_unit || "Metric",
          depth: p?.depth || 0,
        });
      } else {
        const pl = pipelineData?.find((item: any) => Number(item.pipe_id) === sid);
        structureMap.set(sid, {
          ...s,
          title: pl?.title || s.str_name || `Pipeline ${sid}`,
          pfield: pl?.pfield || s.field_name || "Offshore",
          pdesc: pl?.description || "Subsea Pipeline Route",
          ptype: pl?.ptype || "PIPELINE",
          def_unit: "Metric",
          start_kp: pl?.start_kp || 0,
          end_kp: pl?.end_kp || 10,
          total_length: pl?.total_length || pl?.length || 10,
          pipe_dia: pl?.outer_dia || pl?.diameter || 18,
          depth: 0,
        });
      }
    });

    (platformData || []).forEach((p: any) => {
      const pid = Number(p.plat_id || p.id);
      if (!structureMap.has(pid)) {
        structureMap.set(pid, {
          title: p.title || `Platform ${pid}`,
          pfield: p.pfield || "Offshore",
          pdesc: p.pdesc || "Offshore Facility",
          ptype: p.ptype || "PLATFORM",
          def_unit: p.def_unit || p.unit_type || "Metric",
          depth: p.depth || 0,
        });
      }
    });

    // 2. Fetch Jobpacks & SOWs scoped to selected structures
    let rawJpQuery = (supabase as any).from("jobpack").select("id, name, status, metadata, created_at");
    const { data: allCompanyJps } = await rawJpQuery;

    let finalJobpacks: any[] = [];
    if (jobpackMode === "SELECTED" && jobpackIds.length > 0) {
      const selectedSet = new Set(jobpackIds.map(Number));
      finalJobpacks = (allCompanyJps || []).filter((j: any) => selectedSet.has(Number(j.id)));
    } else if (activeStrIds.length > 0) {
      const activeStrSet = new Set(activeStrIds.map(Number));
      finalJobpacks = (allCompanyJps || []).filter((jp: any) => {
        const structures = jp.metadata?.structures || [];
        if (Array.isArray(structures)) {
          const m = structures.some((s: any) => {
            const sid = Number(String(s.id || s.structure_id || s.platform_id || s.pipe_id || s.str_id || s.plat_id || "").replace(/^(platform|pipeline)-/, ""));
            return !isNaN(sid) && activeStrSet.has(sid);
          });
          if (m) return true;
        }
        const directSId = Number(String(jp.metadata?.structure_id || jp.metadata?.platform_id || jp.metadata?.pipe_id || jp.metadata?.plat_id || jp.metadata?.str_id || "").replace(/^(platform|pipeline)-/, ""));
        if (!isNaN(directSId) && activeStrSet.has(directSId)) return true;
        return true; // Keep jobpacks available for mapping
      });
    } else {
      finalJobpacks = allCompanyJps || [];
    }

    const jobpacksData = finalJobpacks;
    const jobpackMap = new Map<number, any>();
    (allCompanyJps || finalJobpacks || []).forEach((j: any) => jobpackMap.set(Number(j.id), j));

    // Fetch SOWs
    let sowQuery = (supabase as any)
      .from("u_sow")
      .select("*");
    if (activeStrIds.length > 0) {
      sowQuery = sowQuery.in("structure_id", activeStrIds);
    }
    const { data: sowData } = await sowQuery;
    const sowMap = new Map<number, any>();
    (sowData || []).forEach((s: any) => sowMap.set(s.sow_id || s.id, s));

    // 3. Fetch Components Master & Component Types
    const [
      compRes,
      compTypesRes,
      diveJobsRes,
      rovJobsRes,
      videoTapesRes,
      videoLogsRes,
    ] = await Promise.all([
      (supabase as any)
        .from("structure_components")
        .select("*")
        .in("structure_id", activeStrIds.length > 0 ? activeStrIds : [-999999])
        .limit(10000),
      (supabase as any)
        .from("components")
        .select("code, descrip, name"),
      (supabase as any)
        .from("insp_dive_jobs")
        .select("*")
        .limit(10000),
      (supabase as any)
        .from("insp_rov_jobs")
        .select("*")
        .limit(10000),
      needsVideo
        ? (supabase as any).from("insp_video_tapes").select("*").limit(5000)
        : Promise.resolve({ data: [] }),
      needsVideo
        ? (supabase as any).from("insp_video_logs").select("*").limit(10000)
        : Promise.resolve({ data: [] }),
    ]);

    const compData = compRes?.data || [];
    const compTypesData = compTypesRes?.data || [];
    const diveJobsData = diveJobsRes?.data || [];
    const rovJobsData = rovJobsRes?.data || [];
    const videoTapesData = videoTapesRes?.data || [];
    const videoLogsData = videoLogsRes?.data || [];

    const compMap = new Map<number, any>();
    const compMapByCompId = new Map<number, any>();
    const compMapByStrAndId = new Map<string, any>();
    const compMapByStrAndCompId = new Map<string, any>();
    const compMapByQid = new Map<string, any>();
    const compMapByStrAndQid = new Map<string, any>();

    const indexComponent = (c: any) => {
      if (!c) return;
      if (!c.code && c.id_no && typeof c.id_no === "string" && c.id_no.includes("/")) {
        const prefix = c.id_no.split("/")[0].trim().toUpperCase();
        if (prefix.length >= 2 && prefix.length <= 4) {
          c.code = prefix.substring(0, 2);
        }
      }
      const numId = Number(c.id);
      if (!isNaN(numId) && numId > 0) {
        compMap.set(numId, c);
        if (c.structure_id) {
          compMapByStrAndId.set(`${c.structure_id}_${numId}`, c);
        }
      }
      const numCompId = Number(c.comp_id);
      if (!isNaN(numCompId) && numCompId > 0) {
        compMapByCompId.set(numCompId, c);
        if (c.structure_id) {
          compMapByStrAndCompId.set(`${c.structure_id}_${numCompId}`, c);
        }
      }

      const registerKey = (rawKey: any) => {
        if (!rawKey) return;
        const strKey = String(rawKey).trim().toUpperCase();
        if (!strKey) return;
        compMapByQid.set(strKey, c);
        if (c.structure_id) {
          compMapByStrAndQid.set(`${c.structure_id}_${strKey}`, c);
        }
        const normKey = strKey.replace(/[^A-Z0-9]/g, "");
        if (normKey && normKey !== strKey) {
          compMapByQid.set(`NORM_${normKey}`, c);
          if (c.structure_id) {
            compMapByStrAndQid.set(`${c.structure_id}_NORM_${normKey}`, c);
          }
        }
      };

      registerKey(c.q_id);
      registerKey(c.id_no);
      registerKey(c.name);
      registerKey(c.code);
      registerKey(c.metadata?.q_id);
      registerKey(c.metadata?.qid);
      registerKey(c.metadata?.id_no);
      registerKey(c.metadata?.idno);
      registerKey(c.metadata?.anode_no);
      registerKey(c.metadata?.anod_no);
      registerKey(c.metadata?.anode_tag);
      registerKey(c.metadata?.description);
      registerKey(c.metadata?.descr);
      registerKey(c.metadata?.desc);
      registerKey(c.metadata?.compdesc);
    };

    (compData || []).forEach(indexComponent);

    const compTypeMap = new Map<string, string>();
    (compTypesData || []).forEach((ct: any) => {
      if (ct.code) {
        compTypeMap.set(String(ct.code).trim().toUpperCase(), ct.descrip || ct.name || "");
      }
    });

    const diveJobMap = new Map<number, any>();
    const diveJobMapByStrAndId = new Map<string, any>();
    const diveJobMapByJpAndId = new Map<string, any>();
    const diveJobMapByNo = new Map<string, any>();
    const diveJobMapByStrAndNo = new Map<string, any>();
    const diveJobMapByJpAndNo = new Map<string, any>();

    const indexDiveJob = (dj: any) => {
      if (!dj) return;
      const numId = Number(dj.id);
      if (!isNaN(numId) && numId > 0) {
        diveJobMap.set(numId, dj);
        if (dj.structure_id) diveJobMapByStrAndId.set(`${dj.structure_id}_${numId}`, dj);
        if (dj.jobpack_id) diveJobMapByJpAndId.set(`${dj.jobpack_id}_${numId}`, dj);
      }
      const numDiveJobId = Number(dj.dive_job_id);
      if (!isNaN(numDiveJobId) && numDiveJobId > 0) {
        diveJobMap.set(numDiveJobId, dj);
        if (dj.structure_id) diveJobMapByStrAndId.set(`${dj.structure_id}_${numDiveJobId}`, dj);
        if (dj.jobpack_id) diveJobMapByJpAndId.set(`${dj.jobpack_id}_${numDiveJobId}`, dj);
      }

      const registerDiveNo = (rawNo: any) => {
        if (!rawNo) return;
        const strNo = String(rawNo).trim().toUpperCase();
        if (!strNo) return;
        diveJobMapByNo.set(strNo, dj);
        if (dj.structure_id) diveJobMapByStrAndNo.set(`${dj.structure_id}_${strNo}`, dj);
        if (dj.jobpack_id) diveJobMapByJpAndNo.set(`${dj.jobpack_id}_${strNo}`, dj);

        const normDigits = strNo.replace(/[^\d]/g, "");
        if (normDigits && normDigits !== strNo) {
          diveJobMapByNo.set(normDigits, dj);
          diveJobMapByNo.set(`DIVE_${normDigits}`, dj);
          if (dj.structure_id) {
            diveJobMapByStrAndNo.set(`${dj.structure_id}_${normDigits}`, dj);
            diveJobMapByStrAndNo.set(`${dj.structure_id}_DIVE_${normDigits}`, dj);
          }
          if (dj.jobpack_id) {
            diveJobMapByJpAndNo.set(`${dj.jobpack_id}_${normDigits}`, dj);
            diveJobMapByJpAndNo.set(`${dj.jobpack_id}_DIVE_${normDigits}`, dj);
          }
        }
      };

      registerDiveNo(dj.dive_no);
      registerDiveNo(dj.deployment_no);
      registerDiveNo(dj.job_no);
      registerDiveNo(dj.name);
      registerDiveNo(dj.diveno);
    };

    (diveJobsData || []).forEach(indexDiveJob);

    const rovJobMap = new Map<number, any>();
    const rovJobMapByStrAndId = new Map<string, any>();
    const rovJobMapByJpAndId = new Map<string, any>();
    const rovJobMapByNo = new Map<string, any>();
    const rovJobMapByStrAndNo = new Map<string, any>();
    const rovJobMapByJpAndNo = new Map<string, any>();

    const indexRovJob = (rj: any) => {
      if (!rj) return;
      const numId = Number(rj.id);
      if (!isNaN(numId) && numId > 0) {
        rovJobMap.set(numId, rj);
        if (rj.structure_id) rovJobMapByStrAndId.set(`${rj.structure_id}_${numId}`, rj);
        if (rj.jobpack_id) rovJobMapByJpAndId.set(`${rj.jobpack_id}_${numId}`, rj);
      }
      const numRovJobId = Number(rj.rov_job_id);
      if (!isNaN(numRovJobId) && numRovJobId > 0) {
        rovJobMap.set(numRovJobId, rj);
        if (rj.structure_id) rovJobMapByStrAndId.set(`${rj.structure_id}_${numRovJobId}`, rj);
        if (rj.jobpack_id) rovJobMapByJpAndId.set(`${rj.jobpack_id}_${numRovJobId}`, rj);
      }

      const registerRovNo = (rawNo: any) => {
        if (!rawNo) return;
        const strNo = String(rawNo).trim().toUpperCase();
        if (!strNo) return;
        rovJobMapByNo.set(strNo, rj);
        if (rj.structure_id) rovJobMapByStrAndNo.set(`${rj.structure_id}_${strNo}`, rj);
        if (rj.jobpack_id) rovJobMapByJpAndNo.set(`${rj.jobpack_id}_${strNo}`, rj);

        const normDigits = strNo.replace(/[^\d]/g, "");
        if (normDigits && normDigits !== strNo) {
          rovJobMapByNo.set(normDigits, rj);
          if (rj.structure_id) rovJobMapByStrAndNo.set(`${rj.structure_id}_${normDigits}`, rj);
          if (rj.jobpack_id) rovJobMapByJpAndNo.set(`${rj.jobpack_id}_${normDigits}`, rj);
        }
      };

      registerRovNo(rj.deployment_no);
      registerRovNo(rj.rov_job_no);
      registerRovNo(rj.job_no);
      registerRovNo(rj.name);
      registerRovNo(rj.dive_no);
      registerRovNo(rj.diveno);
    };

    (rovJobsData || []).forEach(indexRovJob);

    const videoTapeMapByDiveJobId = new Map<number, any>();
    const videoTapeMapByRovJobId = new Map<number, any>();
    const videoTapeMapById = new Map<number, any>();
    const videoTapeMapByRovJobAndTapeId = new Map<string, any>();
    (videoTapesData || []).forEach((vt: any) => {
      if (vt.tape_id != null) videoTapeMapById.set(Number(vt.tape_id), vt);
      if (vt.id != null) videoTapeMapById.set(Number(vt.id), vt);
      if (vt.rov_job_id != null && vt.tape_id != null) {
        videoTapeMapByRovJobAndTapeId.set(`${vt.rov_job_id}_${vt.tape_id}`, vt);
      }
      if (vt.rov_job_id != null && vt.id != null) {
        videoTapeMapByRovJobAndTapeId.set(`${vt.rov_job_id}_${vt.id}`, vt);
      }
      if (vt.dive_job_id != null && !videoTapeMapByDiveJobId.has(Number(vt.dive_job_id))) {
        videoTapeMapByDiveJobId.set(Number(vt.dive_job_id), vt);
      }
      if (vt.rov_job_id != null && !videoTapeMapByRovJobId.has(Number(vt.rov_job_id))) {
        videoTapeMapByRovJobId.set(Number(vt.rov_job_id), vt);
      }
    });

    const videoLogMapByTapeId = new Map<number, any>();
    const videoLogMapByInspId = new Map<number, any>();
    (videoLogsData || []).forEach((vl: any) => {
      if (vl.tape_id != null && !videoLogMapByTapeId.has(Number(vl.tape_id))) {
        videoLogMapByTapeId.set(Number(vl.tape_id), vl);
      }
      if (vl.inspection_id != null && !videoLogMapByInspId.has(Number(vl.inspection_id))) {
        videoLogMapByInspId.set(Number(vl.inspection_id), vl);
      }
    });

    // 3.5 Fetch Inspection Types, MGI Profiles & Library Lists (AMLY_COD, AMLY_TYP)
    const [{ data: inspTypesData }, mgiProfilesRes, { data: libListData }] = await Promise.all([
      (supabase as any)
        .from("inspection_type")
        .select("id, code, name, metadata"),
      needsMgiProfiles
        ? (supabase as any).from("mgi_profiles").select("*").eq("is_archived", false)
        : Promise.resolve({ data: [] }),
      (supabase as any)
        .from("u_lib_list")
        .select("lib_code, lib_id, lib_desc")
        .in("lib_code", ["AMLY_COD", "AMLY_TYP", "ANOD_TYP"]),
    ]);
    const mgiProfilesData = mgiProfilesRes?.data || [];

    const amlyCodDescToId = new Map<string, string>();
    const amlyTypDescToId = new Map<string, string>();
    const anodTypDescToId = new Map<string, string>();
    (libListData || []).forEach((item: any) => {
      const lCode = String(item.lib_code || "").trim().toUpperCase();
      const lId = String(item.lib_id || "").trim();
      const lDesc = String(item.lib_desc || "").trim();

      if (lCode === "AMLY_COD") {
        if (lDesc) amlyCodDescToId.set(lDesc.toLowerCase(), lId);
        if (lId) amlyCodDescToId.set(lId.toLowerCase(), lId);
      } else if (lCode === "AMLY_TYP") {
        if (lDesc) amlyTypDescToId.set(lDesc.toLowerCase(), lId);
        if (lId) amlyTypDescToId.set(lId.toLowerCase(), lId);
      } else if (lCode === "ANOD_TYP") {
        if (lDesc) anodTypDescToId.set(lDesc.toLowerCase(), lId);
        if (lId) anodTypDescToId.set(lId.toLowerCase(), lId);
      }
    });

    const inspTypeMapById = new Map<number, any>();
    const inspTypeMapByCode = new Map<string, any>();
    (inspTypesData || []).forEach((it: any) => {
      if (it.id != null) inspTypeMapById.set(Number(it.id), it);
      if (it.code) inspTypeMapByCode.set(String(it.code).trim().toUpperCase(), it);
    });

    const mgiProfileMapById = new Map<number, any>();
    (mgiProfilesData || []).forEach((mp: any) => {
      if (mp.id != null) mgiProfileMapById.set(Number(mp.id), mp);
    });
    const defaultActiveMgiProfile = (mgiProfilesData || []).find((mp: any) => mp.is_active && !mp.is_job_specific) ||
      (mgiProfilesData || []).find((mp: any) => mp.is_active) || null;

    // 4. Fetch Inspection Records (Direct scalar query for reliability)
    let inspQuery = (supabase as any)
      .from("insp_records")
      .select("*");

    if (activeStrIds.length > 0) {
      inspQuery = inspQuery.in("structure_id", activeStrIds);
    }
    if (jobpackMode === "SELECTED" && jobpackIds.length > 0) {
      inspQuery = inspQuery.in("jobpack_id", jobpackIds.map(Number));
    }
    if (isSowFiltered) {
      inspQuery = inspQuery.in("sow_report_no", effectiveSowReportNos);
    }
    if (isSingleTableExport && singleCode && targetCodesMap[singleCode]) {
      inspQuery = inspQuery.in("inspection_type_code", targetCodesMap[singleCode]);
    } else if (inspectionTypes.length > 0 && !inspectionTypes.includes("ALL")) {
      inspQuery = inspQuery.in("inspection_type_code", inspectionTypes);
    }

    const { data: recordsData, error: recordsError } = await inspQuery.limit(10000);
    if (recordsError) {
      console.error("[Interface Export] Error querying insp_records:", recordsError);
    }
    let allRecords = recordsData || [];

    if (isSowFiltered) {
      const sowSet = new Set(effectiveSowReportNos.map((s) => s.toUpperCase()));
      allRecords = allRecords.filter((r: any) => {
        const idata = r.inspection_data || {};
        const rSow = String(r.sow_report_no || "").trim().toUpperCase();
        const iSow = String(idata.sow_report_no || idata.sow_no || idata.report_no || "").trim().toUpperCase();
        return (rSow && sowSet.has(rSow)) || (iSow && sowSet.has(iSow));
      });
    }

    // Fetch any missing components referenced in allRecords
    const missingCompIdSet = new Set<number>();
    const missingQidSet = new Set<string>();
    const extraStrIdSet = new Set<number>();

    allRecords.forEach((r: any) => {
      const idata = r.inspection_data || {};
      const strId = Number(r.structure_id);
      if (strId && !activeStrIds.includes(strId)) {
        extraStrIdSet.add(strId);
      }

      [
        Number(r.component_id),
        Number(idata.component_id),
        Number(idata.comp_id),
        Number(idata.structure_component_id),
        Number(idata.compid),
        Number(idata.anode_id),
        Number(idata.member_id),
      ].forEach((cid) => {
        if (!isNaN(cid) && cid > 0 && !compMap.has(cid) && !compMapByCompId.has(cid)) {
          missingCompIdSet.add(cid);
        }
      });

      [
        String(r.q_id || ""),
        String(r.component_qid || ""),
        String(idata.q_id || ""),
        String(idata.component_qid || ""),
        String(idata.component || ""),
        String(idata.comp_qid || ""),
        String(idata.id_no || ""),
        String(idata.component_id_no || ""),
        String(idata.anode_no || ""),
        String(idata.anod_no || ""),
        String(idata.anode_tag || ""),
        String(idata.member || ""),
        String(idata.member_name || ""),
      ].forEach((rawQid) => {
        const qVal = rawQid.trim().toUpperCase();
        if (qVal && !compMapByQid.has(qVal) && (!strId || !compMapByStrAndQid.has(`${strId}_${qVal}`))) {
          missingQidSet.add(qVal);
        }
      });
    });

    if (extraStrIdSet.size > 0) {
      const extraStrIds = Array.from(extraStrIdSet);
      const { data: extraComps } = await (supabase as any)
        .from("structure_components")
        .select("*")
        .in("structure_id", extraStrIds)
        .limit(10000);
      (extraComps || []).forEach(indexComponent);
    }

    if (missingCompIdSet.size > 0) {
      const missingIds = Array.from(missingCompIdSet);
      const [{ data: byIdComps }, { data: byCompIdComps }] = await Promise.all([
        (supabase as any).from("structure_components").select("*").in("id", missingIds),
        (supabase as any).from("structure_components").select("*").in("comp_id", missingIds),
      ]);
      (byIdComps || []).forEach(indexComponent);
      (byCompIdComps || []).forEach(indexComponent);
    }

    if (missingQidSet.size > 0) {
      const missingQids = Array.from(missingQidSet);
      const [{ data: byQidComps }, { data: byIdNoComps }] = await Promise.all([
        (supabase as any).from("structure_components").select("*").in("q_id", missingQids),
        (supabase as any).from("structure_components").select("*").in("id_no", missingQids),
      ]);
      (byQidComps || []).forEach(indexComponent);
      (byIdNoComps || []).forEach(indexComponent);
    }

    // Collect any missing dive jobs or ROV jobs referenced in allRecords
    const missingDiveJobIdSet = new Set<number>();
    const missingDiveNoSet = new Set<string>();
    const missingRovJobIdSet = new Set<number>();
    const missingRovNoSet = new Set<string>();

    allRecords.forEach((r: any) => {
      const idata = r.inspection_data || {};
      const didCandidates = [
        Number(r.dive_job_id),
        Number(idata.dive_job_id),
        Number(idata.dive_id),
        Number(idata.divejob_id),
        Number(r.rov_job_id),
        Number(idata.rov_job_id),
        Number(idata.rov_id),
      ].filter((n) => !isNaN(n) && n > 0);

      didCandidates.forEach((did) => {
        if (!diveJobMap.has(did)) missingDiveJobIdSet.add(did);
        if (!rovJobMap.has(did)) missingRovJobIdSet.add(did);
      });

      const dnoCandidates = [
        String(r.dive_no || ""),
        String(idata.dive_no || ""),
        String(idata.diveno || ""),
        String(idata.dive_num || ""),
        String(idata.deployment_no || ""),
        String(idata.dive || ""),
        String(r.rov_job_no || ""),
        String(idata.rov_job_no || ""),
        String(idata.rov_no || ""),
        String(idata.rov_num || ""),
        String(idata.rov || ""),
      ].map((s) => s.trim().toUpperCase()).filter(Boolean);

      dnoCandidates.forEach((dVal) => {
        if (!diveJobMapByNo.has(dVal)) missingDiveNoSet.add(dVal);
        if (!rovJobMapByNo.has(dVal)) missingRovNoSet.add(dVal);
      });
    });

    if (missingDiveJobIdSet.size > 0) {
      const missingDids = Array.from(missingDiveJobIdSet);
      const [{ data: byIdDjs }, { data: byJobIdDjs }] = await Promise.all([
        (supabase as any).from("insp_dive_jobs").select("*").in("id", missingDids),
        (supabase as any).from("insp_dive_jobs").select("*").in("dive_job_id", missingDids),
      ]);
      (byIdDjs || []).forEach(indexDiveJob);
      (byJobIdDjs || []).forEach(indexDiveJob);
    }

    if (missingDiveNoSet.size > 0) {
      const missingDnos = Array.from(missingDiveNoSet);
      const [{ data: byDiveNoDjs }, { data: byDeployNoDjs }, { data: byJobNoDjs }] = await Promise.all([
        (supabase as any).from("insp_dive_jobs").select("*").in("dive_no", missingDnos),
        (supabase as any).from("insp_dive_jobs").select("*").in("deployment_no", missingDnos),
        (supabase as any).from("insp_dive_jobs").select("*").in("job_no", missingDnos),
      ]);
      (byDiveNoDjs || []).forEach(indexDiveJob);
      (byDeployNoDjs || []).forEach(indexDiveJob);
      (byJobNoDjs || []).forEach(indexDiveJob);
    }

    if (missingRovJobIdSet.size > 0) {
      const missingRids = Array.from(missingRovJobIdSet);
      const [{ data: byIdRjs }, { data: byJobIdRjs }] = await Promise.all([
        (supabase as any).from("insp_rov_jobs").select("*").in("id", missingRids),
        (supabase as any).from("insp_rov_jobs").select("*").in("rov_job_id", missingRids),
      ]);
      (byIdRjs || []).forEach(indexRovJob);
      (byJobIdRjs || []).forEach(indexRovJob);
    }

    if (missingRovNoSet.size > 0) {
      const missingRnos = Array.from(missingRovNoSet);
      const [{ data: byDeployRjs }, { data: byJobNoRjs }, { data: byRovJobNoRjs }] = await Promise.all([
        (supabase as any).from("insp_rov_jobs").select("*").in("deployment_no", missingRnos),
        (supabase as any).from("insp_rov_jobs").select("*").in("job_no", missingRnos),
        (supabase as any).from("insp_rov_jobs").select("*").in("rov_job_no", missingRnos),
      ]);
      (byDeployRjs || []).forEach(indexRovJob);
      (byJobNoRjs || []).forEach(indexRovJob);
      (byRovJobNoRjs || []).forEach(indexRovJob);
    }

    // Collect any missing video tapes referenced in allRecords
    const missingTapeIdSet = new Set<number>();
    if (needsVideo) {
      allRecords.forEach((r: any) => {
        const idata = r.inspection_data || {};
        const tid = Number(r.tape_id ?? idata.tape_id);
        if (!isNaN(tid) && tid > 0 && !videoTapeMapById.has(tid)) {
          missingTapeIdSet.add(tid);
        }
      });
      if (missingTapeIdSet.size > 0) {
        const missingTids = Array.from(missingTapeIdSet);
        const [{ data: byIdTapes }, { data: byTapeIdTapes }] = await Promise.all([
          (supabase as any).from("insp_video_tapes").select("*").in("id", missingTids),
          (supabase as any).from("insp_video_tapes").select("*").in("tape_id", missingTids),
        ]);
        const combinedTapes = [...(byIdTapes || []), ...(byTapeIdTapes || [])];
        combinedTapes.forEach((vt: any) => {
          if (vt.tape_id != null) videoTapeMapById.set(Number(vt.tape_id), vt);
          if (vt.id != null) videoTapeMapById.set(Number(vt.id), vt);
          if (vt.rov_job_id != null && vt.tape_id != null) {
            videoTapeMapByRovJobAndTapeId.set(`${vt.rov_job_id}_${vt.tape_id}`, vt);
          }
          if (vt.rov_job_id != null && vt.id != null) {
            videoTapeMapByRovJobAndTapeId.set(`${vt.rov_job_id}_${vt.id}`, vt);
          }
          if (vt.dive_job_id != null && !videoTapeMapByDiveJobId.has(Number(vt.dive_job_id))) {
            videoTapeMapByDiveJobId.set(Number(vt.dive_job_id), vt);
          }
          if (vt.rov_job_id != null && !videoTapeMapByRovJobId.has(Number(vt.rov_job_id))) {
            videoTapeMapByRovJobId.set(Number(vt.rov_job_id), vt);
          }
        });
      }
    }

    // 5. Fetch Anomalies (insp_anomalies where inspection_id = insp_records.insp_id)
    let allAnomalies: any[] = [];
    const anomMapByInspId = new Map<number, any>();
    if (templatesToProcess.some((t) => t.queryStrategy === "INSP_RECORDS")) {
      const allInspIds = allRecords
        .map((r: any) => Number(r.insp_id))
        .filter((id: number) => !isNaN(id) && id > 0);

      if (allInspIds.length > 0) {
        for (let i = 0; i < allInspIds.length; i += 500) {
          const chunk = allInspIds.slice(i, i + 500);
          const { data: anomBatch, error: anomErr } = await (supabase as any)
            .from("insp_anomalies")
            .select("*")
            .in("inspection_id", chunk);

          if (!anomErr && anomBatch) {
            allAnomalies.push(...anomBatch);
            anomBatch.forEach((a: any) => {
              if (a.inspection_id != null) {
                anomMapByInspId.set(Number(a.inspection_id), a);
              }
            });
          }
        }
      }

      if (activeStrIds.length > 0 && allAnomalies.length === 0) {
        let anomQuery = (supabase as any)
          .from("insp_anomalies")
          .select("*")
          .in("structure_id", activeStrIds);
        if (jobpackMode === "SELECTED" && jobpackIds.length > 0) {
          anomQuery = anomQuery.in("jobpack_id", jobpackIds.map(Number));
        }
        if (isSowFiltered) {
          anomQuery = anomQuery.in("sow_report_no", effectiveSowReportNos);
        }
        const { data: anomaliesData } = await anomQuery.limit(10000);
        (anomaliesData || []).forEach((a: any) => {
          if (a.inspection_id != null && !anomMapByInspId.has(Number(a.inspection_id))) {
            anomMapByInspId.set(Number(a.inspection_id), a);
            allAnomalies.push(a);
          }
        });
      }
    }

    // 6. Fetch Pipeline Events / Geo
    let pipeGeoData: any[] = [];
    if (needsPipeGeo) {
      const { data: pgData } = await (supabase as any)
        .from("pipe_geo")
        .select("*")
        .in("str_id", activeStrIds.length > 0 ? activeStrIds : [0])
        .limit(2000);
      pipeGeoData = pgData || [];
    }

    // 7. Fetch Attachments linked to matching inspection records
    let attachmentsList: any[] = [];
    if (needsAttachments) {
      const targetInspIds = allRecords.map((r: any) => Number(r.insp_id)).filter((id: number) => !isNaN(id) && id > 0);
      if (targetInspIds.length > 0) {
        const [attRes1, attRes2, mediaRes] = await Promise.all([
          (supabase as any)
            .from("attachment")
            .select("*")
            .in("source_id", targetInspIds)
            .in("source_type", ["inspection", "INSPECTION"]),
          (supabase as any)
            .from("attachments")
            .select("*")
            .in("inspection_id", targetInspIds),
          (supabase as any)
            .from("insp_media")
            .select("*")
            .in("inspection_id", targetInspIds),
        ]);

        if (attRes1?.data && attRes1.data.length > 0) {
          attachmentsList.push(...attRes1.data);
        }
        if (attRes2?.data && attRes2.data.length > 0) {
          attRes2.data.forEach((a: any) => {
            attachmentsList.push({
              ...a,
              source_id: a.inspection_id || a.source_id,
              source_type: "INSPECTION",
            });
          });
        }
        if (mediaRes?.data && mediaRes.data.length > 0) {
          mediaRes.data.forEach((m: any) => {
            attachmentsList.push({
              id: m.media_id,
              source_id: m.inspection_id,
              source_type: "INSPECTION",
              name: m.name || `Snapshot ${m.media_id}`,
              title: m.name || `Snapshot ${m.media_id}`,
              file_name: m.meta?.original_file_name || m.name || `media_${m.media_id}.jpg`,
              file_type: m.meta?.file_extension || (m.file_path ? path.extname(m.file_path).replace(".", "") : "JPG"),
              path: m.file_path || "",
              meta: m.meta || {},
              description: m.meta?.description || m.description || "",
            });
          });
        }
      }
    }

    // Helpers
    const sanitizeText = (val: any) => {
      if (val == null) return "";
      return String(val).replace(/[\r\n\t]+/g, " ").trim();
    };

    const cleanCellValue = (val: any) => {
      if (val === null || val === undefined) return "";
      if (typeof val === "number") {
        if (isNaN(val) || !isFinite(val)) return "";
        return val;
      }
      if (typeof val === "boolean") return val ? "YES" : "NO";
      return String(val).replace(/[\r\n\t]+/g, " ").trim();
    };

    const toRoundNum = (val: any) => {
      if (val == null || val === "") return "";
      const n = Number(String(val).replace(/[^\d.-]/g, ""));
      return !isNaN(n) && isFinite(n) ? Math.round(n) : "";
    };

    const parseGrowthPercent = (val: any): number | string => {
      if (val == null || val === "") return "";
      if (typeof val === "number") {
        return !isNaN(val) && isFinite(val) ? Math.round(val) : "";
      }
      const s = String(val).replace(/[\r\n\t]+/g, " ").trim();
      if (!s) return "";

      // If value is "All over" / "All" -> 100
      if (/all\s*over/i.test(s) || /^all$/i.test(s)) {
        return 100;
      }

      // Extract numbers and get maximum range value (e.g. "0-10" -> 10, "10-20" -> 20, "20 - 40%" -> 40)
      const nums = s.replace(/%/g, " ").match(/\d+(?:\.\d+)?/g);
      if (nums && nums.length > 0) {
        const parsedNums = nums.map(Number).filter((n) => !isNaN(n) && isFinite(n));
        if (parsedNums.length > 0) {
          return Math.round(Math.max(...parsedNums));
        }
      }

      return "";
    };

    const parseAnodeDepletion = (val: any): number | string => {
      if (val == null || val === "") return "";
      const s = String(val).replace(/[\r\n\t]+/g, " ").trim();
      if (!s || /unable to estimate|n\/a|none|nil/i.test(s)) return "";

      // 1. Explicit range checks
      if (/75\s*[-–—~to\/]\s*100/i.test(s) || />\s*75/i.test(s) || /76\s*[-–—~to\/]\s*100/i.test(s)) {
        return 76;
      }
      if (/50\s*[-–—~to\/]\s*75/i.test(s)) {
        return 75;
      }
      if (/25\s*[-–—~to\/]\s*50/i.test(s)) {
        return 50;
      }
      if (/0\s*[-–—~to\/]\s*25/i.test(s) || /<\s*25/i.test(s)) {
        return 25;
      }

      // 2. Numeric range / value extraction
      const nums = s.replace(/%/g, " ").match(/\d+(?:\.\d+)?/g);
      if (nums && nums.length > 0) {
        const numVals = nums.map(Number).filter((n) => !isNaN(n) && isFinite(n));
        if (numVals.length >= 2) {
          const minN = Math.min(...numVals);
          const maxN = Math.max(...numVals);
          if (maxN > 75 || minN >= 75) return 76;
          if (maxN > 50 || minN >= 50) return 75;
          if (maxN > 25 || minN >= 25) return 50;
          return 25;
        } else if (numVals.length === 1) {
          const n = numVals[0];
          if (n === 76) return 76;
          if (n === 75) return 75;
          if (n === 50) return 50;
          if (n === 25) return 25;
          if (n > 75) return 76;
          if (n > 50) return 75;
          if (n > 25) return 50;
          return 25;
        }
      }

      return "";
    };

    const formatInspNo = (jobpackId: any): string => {
      const numId = Number(jobpackId) || 0;
      return String(numId + 10000).padStart(11, "0");
    };

    const formatScourAtLoc = (val: any): string => {
      if (val == null) return "";
      const s = String(val).replace(/[\r\n\t]+/g, " ").trim();
      if (!s) return "";

      // If the value is At Midpoint replace and insert as MIDPOINT
      if (/^(?:at\s+)?mid[\s\-]?point$/i.test(s) || /^midpoint$/i.test(s)) {
        return "MIDPOINT";
      }

      // For Leg names replace with the leg name only eg. Leg : B2 as B2, At Leg: B2 as B2, Location: Leg : B2 as B2
      const legMatch = s.match(/^(?:location\s*:\s*)?(?:at\s+)?leg\s*[:\-]?\s*(.+)$/i);
      if (legMatch && legMatch[1]) {
        return sanitizeText(legMatch[1]).toUpperCase();
      }

      return sanitizeText(s).toUpperCase();
    };

    const formatDateStr = (d: any): string => {
      if (!d) return "";
      try {
        const dt = new Date(d);
        if (isNaN(dt.getTime())) {
          const s = String(d).trim();
          if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
            const [yyyy, mm, dd] = s.split("T")[0].split("-");
            return `${dd}-${mm}-${yyyy}`;
          }
          if (/^\d{2}-\d{2}-\d{4}/.test(s)) {
            return s.substring(0, 10);
          }
          return s;
        }
        const day = String(dt.getUTCDate()).padStart(2, "0");
        const month = String(dt.getUTCMonth() + 1).padStart(2, "0");
        const year = String(dt.getUTCFullYear());
        return `${day}-${month}-${year}`;
      } catch {
        return String(d);
      }
    };

    const formatTimeStr = (t: any): string => {
      if (!t) return "";
      try {
        const dt = new Date(t);
        if (!isNaN(dt.getTime())) {
          const hh = String(dt.getUTCHours()).padStart(2, "0");
          const mm = String(dt.getUTCMinutes()).padStart(2, "0");
          const ss = String(dt.getUTCSeconds()).padStart(2, "0");
          return `${hh}:${mm}:${ss}`;
        }
        const s = String(t).trim();
        if (/^\d{2}:\d{2}:\d{2}/.test(s)) return s.substring(0, 8);
        return s;
      } catch {
        return String(t);
      }
    };

    const getModifiedRecDate = (updatedAt: any, createdAt?: any): string => {
      if (!updatedAt) return "";
      if (createdAt) {
        const uTime = new Date(updatedAt).getTime();
        const cTime = new Date(createdAt).getTime();
        if (!isNaN(uTime) && !isNaN(cTime) && Math.abs(uTime - cTime) < 1000) {
          return "";
        }
      }
      return formatDateStr(updatedAt);
    };

    // Helper for CSV escaping
    const escapeCsvValue = (val: any) => {
      if (val == null) return '""';
      const s = String(val).replace(/"/g, '""');
      return `"${s}"`;
    };

    // Build Data Tables for each SICS template
    interface TableExportResult {
      id: string;
      code: string;
      sheetName: string;
      xlsxFileName: string;
      txtFileName: string;
      csvFileName: string;
      columns: any[];
      rows: any[];
      textContent: string;
      csvContent: string;
      xlsxBuffer: Buffer;
    }

    const tablesOutput: TableExportResult[] = [];
    const dateFormattedYymmdd = new Date().toISOString().split("T")[0].replace(/-/g, "").substring(2);

    for (const sheetDef of templatesToProcess) {
      const sheetRows: any[] = [];
      const code = sheetDef.identifierCode;
      const strategy = sheetDef.queryStrategy;

      if (strategy === "COMPONENT_MASTER" || code === "CMS") {
        const activeStrSet = new Set(activeStrIds.map(Number));
        const targetComps = (compData || []).filter((c: any) => activeStrSet.has(Number(c.structure_id)));

        targetComps.forEach((c: any) => {
          const strObj = structureMap.get(Number(c.structure_id));
          const meta = c.metadata || {};
          const codeUpper = String(c.code || "").trim().toUpperCase();
          const compTypeDesc = compTypeMap.get(codeUpper) || meta.comptype || meta.comp_type || c.type || "MEMBER";

          sheetRows.push({
            STR_ID: strObj?.plat_id || c.structure_id,
            TITLE: sanitizeText(strObj?.title || `Platform ${c.structure_id}`),
            PFIELD: sanitizeText(strObj?.pfield || ""),
            PDESC: sanitizeText(strObj?.pdesc || ""),
            DEF_UNIT: sanitizeText(strObj?.def_unit || "Metric"),
            COMP_ID: c.id,
            ID_NO: sanitizeText(c.id_no || ""),
            Q_ID: sanitizeText(c.q_id || ""),
            CODE: sanitizeText(c.code || "").toUpperCase(),
            COMPDESC: sanitizeText(meta.description || meta.desc || c.description || c.name || ""),
            S_NODE: sanitizeText(meta.s_node || ""),
            F_NODE: sanitizeText(meta.f_node || ""),
            S_LEG: sanitizeText(meta.s_leg || ""),
            F_LEG: sanitizeText(meta.f_leg || ""),
            ELV_1: meta.elv_1 != null && meta.elv_1 !== "" ? Number(meta.elv_1) : (meta.start_elevation != null && meta.start_elevation !== "" ? Number(meta.start_elevation) : ""),
            ELV_2: meta.elv_2 != null && meta.elv_2 !== "" ? Number(meta.elv_2) : (meta.end_elevation != null && meta.end_elevation !== "" ? Number(meta.end_elevation) : ""),
            DIST: meta.dist != null && meta.dist !== "" ? Number(meta.dist) : (meta.distance != null && meta.distance !== "" ? Number(meta.distance) : ""),
            CLK_POS: meta.clk_pos != null && meta.clk_pos !== "" ? Number(meta.clk_pos) : (meta.clock_position != null && meta.clock_position !== "" ? Number(meta.clock_position) : ""),
            COMPTYPE: sanitizeText(compTypeDesc),
            REC_DATE: getModifiedRecDate(c.updated_at, c.created_at),
          });
        });
      } else if (strategy === "JOBPACK_SOW_MASTER" || code === "JMS") {
        (jobpacksData || []).forEach((jp: any) => {
          const istartVal = jp.metadata?.istart || jp.metadata?.date_start || jp.metadata?.start_date || jp.created_at;
          sheetRows.push({
            INSPNO: formatInspNo(jp.id),
            JOBNAME: sanitizeText(jp.name || `JP-${jp.id}`),
            ISTART: formatDateStr(istartVal),
            STATUS: sanitizeText(jp.status || "OPEN").toUpperCase(),
          });
        });
      } else if (strategy === "ATTACHMENTS" || code === "ATS") {
        (attachmentsList || []).forEach((att: any, idx: number) => {
          const inspId = Number(att.source_id || att.inspection_id);
          const linkedRec = allRecords.find((r: any) => Number(r.insp_id) === inspId);
          if (!linkedRec) return;

          const strId = Number(linkedRec.structure_id);
          const strObj = structureMap.get(strId);
          const recCompId = Number(linkedRec.component_id || linkedRec.inspection_data?.component_id || linkedRec.inspection_data?.comp_id);
          const recQid = String(linkedRec.q_id || linkedRec.component_qid || linkedRec.inspection_data?.q_id || linkedRec.inspection_data?.component_qid || linkedRec.inspection_data?.component || "").trim().toUpperCase();
          const comp = (!isNaN(recCompId) && recCompId > 0 ? (compMap.get(recCompId) || compMapByCompId.get(recCompId)) : null)
            || (recQid ? compMapByQid.get(recQid) : null)
            || linkedRec.structure_components
            || linkedRec.component;
          const compMeta = comp?.metadata || {};
          const jp = jobpackMap.get(Number(linkedRec.jobpack_id));

          // Component Type description
          const compCodeUpper = String(comp?.code || compMeta.code || compMeta.comp_code || linkedRec.inspection_data?.comp_code || "").trim().toUpperCase();
          const compTypeDesc = compTypeMap.get(compCodeUpper) || compMeta.comptype || compMeta.comp_type || comp?.type || "MEMBER";

          // File name & Extension & Path & Details
          const origFileName = String(
            att.meta?.original_file_name ||
            att.file_name ||
            att.name ||
            (att.path ? path.basename(att.path) : `attachment_${att.id || idx + 1}.jpg`)
          ).trim();

          let ext = "";
          if (origFileName && origFileName.includes(".")) {
            const parts = origFileName.split(".");
            ext = parts[parts.length - 1].toUpperCase();
          } else if (att.file_type) {
            ext = String(att.file_type).replace(".", "").toUpperCase();
          } else {
            ext = "JPG";
          }
          if (ext.length > 3) {
            ext = ext.substring(0, 3);
          }

          const filePath = att.path || att.file_path || att.meta?.path || "/attachments/";
          const attTitle = att.name || att.title || att.meta?.title || "Inspection Photo";
          const attDesc = att.meta?.description || att.description || "Inspection attachment image";

          // Inspection Type mapping
          const itype = (linkedRec.inspection_type_id ? inspTypeMapById.get(Number(linkedRec.inspection_type_id)) : null) ||
                        inspTypeMapByCode.get(String(linkedRec.inspection_type_code || "").trim().toUpperCase());

          const isRov = itype?.metadata?.rov === 1 || itype?.metadata?.rov === "1" || itype?.metadata?.rov === true;
          const isDiving = itype?.metadata?.diving === 1 || itype?.metadata?.diving === "1" || itype?.metadata?.diving === true;

          let inspCode = "PLATGI";
          if (isRov) {
            inspCode = "PLATGI";
          } else if (isDiving) {
            inspCode = String(itype?.code || linkedRec.inspection_type_code || "DIVING").trim().toUpperCase();
          } else {
            inspCode = String(itype?.code || linkedRec.inspection_type_code || "PLATGI").trim().toUpperCase();
          }

          const inspName = itype?.name || linkedRec.inspection_type_code || "General Visual Inspection";

          // INSPNO: Add 10000 + Jobpack.id, left pad with '0' to make 11 chars
          const numJpId = Number(linkedRec.jobpack_id || jp?.id) || 0;
          const formattedInspNo = String(numJpId + 10000).padStart(11, "0");

          sheetRows.push({
            ATTACH_ID: Number(att.id) || (idx + 1),
            STR_ID: Number(strObj?.plat_id || strObj?.str_id || strId || 1),
            TITLE: sanitizeText(strObj?.title || "Platform").substring(0, 20),
            PFIELD: sanitizeText(strObj?.pfield || "Offshore").substring(0, 20),
            PDESC: sanitizeText(strObj?.pdesc || "Platform").substring(0, 50),
            DEF_UNIT: sanitizeText(strObj?.def_unit || "Metric").substring(0, 10),
            COMP_ID: Number(comp?.comp_id || comp?.id || recCompId || 1),
            ID_NO: sanitizeText(comp?.id_no || compMeta.id_no || linkedRec.inspection_data?.id_no || "").substring(0, 25),
            Q_ID: sanitizeText(comp?.q_id || compMeta.q_id || linkedRec.q_id || linkedRec.component_qid || linkedRec.inspection_data?.q_id || linkedRec.inspection_data?.component_qid || "").substring(0, 16),
            CODE: sanitizeText(comp?.code || compMeta.code || compMeta.comp_code || linkedRec.inspection_data?.comp_code || "").substring(0, 2).toUpperCase(),
            COMPDESC: sanitizeText(compMeta.description || compMeta.desc || comp?.description || comp?.name || linkedRec.inspection_data?.compdesc || linkedRec.inspection_data?.description || "").substring(0, 40),
            S_NODE: sanitizeText(compMeta.s_node || compMeta.start_node || linkedRec.inspection_data?.s_node || "").substring(0, 6),
            F_NODE: sanitizeText(compMeta.f_node || compMeta.end_node || linkedRec.inspection_data?.f_node || "").substring(0, 6),
            S_LEG: sanitizeText(compMeta.s_leg || compMeta.start_leg || linkedRec.inspection_data?.s_leg || "").substring(0, 2),
            F_LEG: sanitizeText(compMeta.f_leg || compMeta.end_leg || linkedRec.inspection_data?.f_leg || "").substring(0, 2),
            ELV_1: compMeta.elv_1 != null && compMeta.elv_1 !== "" ? Number(compMeta.elv_1) : (compMeta.start_elevation != null && compMeta.start_elevation !== "" ? Number(compMeta.start_elevation) : (linkedRec.inspection_data?.elv_1 != null && linkedRec.inspection_data?.elv_1 !== "" ? Number(linkedRec.inspection_data?.elv_1) : "")),
            ELV_2: compMeta.elv_2 != null && compMeta.elv_2 !== "" ? Number(compMeta.elv_2) : (compMeta.end_elevation != null && compMeta.end_elevation !== "" ? Number(compMeta.end_elevation) : (linkedRec.inspection_data?.elv_2 != null && linkedRec.inspection_data?.elv_2 !== "" ? Number(linkedRec.inspection_data?.elv_2) : "")),
            DIST: compMeta.dist != null && compMeta.dist !== "" ? Number(compMeta.dist) : (compMeta.distance != null && compMeta.distance !== "" ? Number(compMeta.distance) : (linkedRec.inspection_data?.dist != null && linkedRec.inspection_data?.dist !== "" ? Number(linkedRec.inspection_data?.dist) : "")),
            CLK_POS: compMeta.clk_pos != null && compMeta.clk_pos !== "" ? Number(compMeta.clk_pos) : (compMeta.clock_position != null && compMeta.clock_position !== "" ? Number(compMeta.clock_position) : (linkedRec.inspection_data?.clk_pos != null && linkedRec.inspection_data?.clk_pos !== "" ? Number(linkedRec.inspection_data?.clk_pos) : "")),
            COMPTYPE: sanitizeText(compTypeDesc).substring(0, 30),
            A_FILENAME: sanitizeText(origFileName).substring(0, 60),
            A_FILETYPE: sanitizeText(ext).substring(0, 3),
            A_PATH: sanitizeText(filePath).substring(0, 255),
            ATT_TITLE: sanitizeText(attTitle).substring(0, 20),
            DETAILS: sanitizeText(attDesc).substring(0, 250),
            INSPNO: formattedInspNo,
            INSP_ID: Number(linkedRec.insp_id),
            INSPCODE: sanitizeText(inspCode).substring(0, 6),
            INSPNAME: sanitizeText(inspName).substring(0, 50),
            JOBNAME: sanitizeText(jp?.name || `JP-${numJpId}`).substring(0, 20),
            STATUS: sanitizeText(jp?.status || "OPEN").substring(0, 10).toUpperCase(),
          });
        });
      } else {
        const validCodes = (sheetDef.inspectionTypeCode || [code]).map((c) => String(c).trim().toUpperCase());
        if (code === "UCS") {
          validCodes.push("UTCLB", "UCS", "UT_CLB", "UT-CLB", "UT_CALIB", "CALIB", "UT CALIBRATION", "UTC");
        }
        if (code === "ITS") {
          validCodes.push("PL_IC", "ITS", "ITEM", "ITEM_INSP", "ITMAIN");
        }
        if (code === "ANS") {
          validCodes.push("ANODE", "ANOD", "ANS", "RANS", "PL_AN", "ANMIN", "ANODE_INSP", "ANODE INSPECTION");
        }
        if (code === "AFS") {
          validCodes.push("AFMC", "ACFMC", "ACFM", "AFS", "ACFM SURVEY");
        }
        if (code === "CVS") {
          validCodes.push("CVINS", "CVI", "CLPIN", "CVS", "CLOSE VISUAL");
        }
        if (code === "GVS") {
          validCodes.push("GVINS", "GVI", "GENIN", "GVS", "GENERAL_VISUAL", "GENERAL VISUAL", "RGVI", "PLATGI");
        }
        if (code === "BSS") {
          validCodes.push("BSINS", "BSS", "BOLT", "BOLTED", "BOLTED SUPPORT", "BOLTED_SUPPORT");
        }
        if (code === "RSS") {
          validCodes.push("RISER", "RSS", "RISER_SURVEY", "RISER SURVEY", "RISERSURVEY");
        }
        if (code === "CCS") {
          validCodes.push("CPCLB", "ROVCPCLB", "DIVCPCLB", "CCS", "CP_CLB", "CP-CLB", "CP_CALIB", "CP CALIBRATION", "CPCALIB");
        }
        if (code === "MPS") {
          validCodes.push("MPINS", "MPI", "MPS", "MAG", "MAG_PARTICLE", "MAGNETIC PARTICLE", "ACFMC", "AFMC", "ACFM", "AFS", "ACFM SURVEY");
        }
        if (code === "PHS") {
          validCodes.push("PHOTO", "PHS", "PHOTOGRAPHY", "PHOTO_INSP", "PHOTO_INSPECTION");
        }
        if (code === "VDS") {
          validCodes.push("VIDEO", "VDS", "DIVING", "ALL_DIVING", "VID", "VID_INSP");
        }
        if (code === "UTS") {
          validCodes.push("UTWTK", "UT_WTK", "UTCLB", "UTINS", "WTINS", "UTS", "WALL_THICKNESS", "UT_WALL_THICKNESS", "SZONE", "SZS", "SPLASH_ZONE", "SPLASH ZONE", "SZINS");
        }
        if (code === "FDS") {
          validCodes.push("FLOOD", "FMD", "FLOODED", "FDS", "FLOODED_MEMBER", "FMI", "FLOODED MEMBER", "RFMD", "ROVFMD", "ROV_FMD");
        }
        if (code === "DBS") {
          validCodes.push("PL_DB", "DEBRIS", "DBS", "DBINS", "DEBINS", "DEBRIS_INSP", "DEBRIS INSPECTION", "RGVI", "RRISI", "RCOND", "RCASN");
        }
        if (code === "MGS") {
          validCodes.push("MGROW", "MGINS", "MGCLB", "MGS", "MARINE_GROWTH", "MARINE GROWTH", "RMGI", "MG_INSP", "MGROWTH");
        }
        if (code === "SCS") {
          validCodes.push("SCOUR", "SCR", "RSCOR", "SCS", "SCOUR_SURVEY", "SCOUR_INSP", "SCOUR INSPECTION", "SCOUR SURVEY");
        }
        if (code === "CPS") {
          validCodes.push(
            "CP", "CPRDG", "CPINS", "CPS", "RCP", "SZS", "BSS", "BSINS", "CPSURV", "SZONE", "PIPECP", "CPCLB",
            "RGVI", "RSANI", "RRISI", "RSZCI", "RSWNI", "RCOND", "RCASN"
          );
        }
        if (code === "PGS") {
          validCodes.push(
            "RGVI", "RMGI", "RSANI", "RFMD", "RSCOR", "RCASN", "RCOND", "RICMI", "RRISI", "RSEAB", "RSWNI", "RSZCI", "RUTWT", "RWDI", "PGS", "ROVGEN", "ROV"
          );
        }

        const matchingRecords = allRecords.filter((r: any) => {
          const recType = String(r.inspection_type_code || "").trim().toUpperCase();
          if (validCodes.some((c) => recType === c || recType.includes(c))) return true;

          const itype = r.inspection_type_id ? inspTypeMapById.get(Number(r.inspection_type_id)) : null;
          const itypeCode = String(itype?.code || "").trim().toUpperCase();
          const itypeName = String(itype?.name || "").trim().toUpperCase();
          if (validCodes.some((c) => itypeCode === c || itypeCode.includes(c) || itypeName.includes(c))) return true;

          if (code === "UCS") {
            const idata = r.inspection_data || {};
            if (idata.calib_equipment_type || idata.probe || idata.probe_frequency || idata.reading01 !== undefined || idata.label01 !== undefined) {
              if (recType.includes("UT") || recType.includes("CLB") || recType.includes("CALIB") || itypeCode.includes("UT") || itypeCode.includes("CLB")) {
                return true;
              }
            }
          }

          if (code === "CCS") {
            const idata = r.inspection_data || {};
            if (
              idata.calib_block !== undefined ||
              idata.pre_dive_cp_rdg !== undefined ||
              idata.post_dive_cp_rdg !== undefined ||
              idata.in_water1 !== undefined ||
              recType === "CPCLB" ||
              recType === "CCS" ||
              recType === "ROVCPCLB" ||
              recType === "DIVCPCLB" ||
              recType.includes("CPCLB") ||
              recType.includes("CP_CLB") ||
              recType.includes("CP CALIB") ||
              itypeCode === "CPCLB" ||
              itypeCode === "CCS" ||
              itypeCode.includes("CPCLB") ||
              itypeName.includes("CP CALIBRATION")
            ) {
              return true;
            }
          }

          if (code === "CPS") {
            const idata = r.inspection_data || {};
            if (
              idata.cp_rdg !== undefined ||
              idata.cp_reading !== undefined ||
              idata.cp_rdg_additional !== undefined ||
              idata.cp_in !== undefined ||
              idata.cp_out !== undefined ||
              idata.pre_dive_cp !== undefined ||
              idata.post_dive_cp !== undefined ||
              ["CP", "CPRDG", "CPINS", "CPS", "RCP", "SZS", "BSS", "BSINS", "CPSURV", "SZONE", "PIPECP", "CPCLB", "RGVI", "RSANI", "RRISI", "RSZCI", "RSWNI", "RCOND", "RCASN"].includes(recType) ||
              ["CP", "CPRDG", "CPINS", "CPS", "RCP", "SZS", "BSS", "BSINS", "CPSURV", "SZONE", "PIPECP", "CPCLB", "RGVI", "RSANI", "RRISI", "RSZCI", "RSWNI", "RCOND", "RCASN"].includes(itypeCode) ||
              recType.includes("CP") ||
              itypeCode.includes("CP") ||
              itypeName.includes("CATHODIC") ||
              itypeName.includes("CP")
            ) {
              return true;
            }
          }

          if (code === "ANS") {
            const idata = r.inspection_data || {};
            const candidateCompIds = [
              Number(r.component_id),
              Number(idata.component_id),
              Number(idata.comp_id),
              Number(idata.structure_component_id),
              Number(idata.compid),
              Number(idata.anode_id),
              Number(idata.member_id),
            ].filter((n) => !isNaN(n) && n > 0);

            const candidateQids = [
              String(r.q_id || ""),
              String(r.component_qid || ""),
              String(idata.q_id || ""),
              String(idata.component_qid || ""),
              String(idata.component || ""),
              String(idata.comp_qid || ""),
              String(idata.id_no || ""),
              String(idata.component_id_no || ""),
              String(idata.anode_no || ""),
              String(idata.anod_no || ""),
              String(idata.anode_tag || ""),
              String(idata.member || ""),
              String(idata.member_name || ""),
              String(idata.tag || ""),
            ].map((s) => s.trim()).filter((s) => s.length > 0);

            const strIdNum = Number(r.structure_id);
            let comp: any = null;

            if (strIdNum) {
              for (const cid of candidateCompIds) {
                comp = compMapByStrAndId.get(`${strIdNum}_${cid}`) || compMapByStrAndCompId.get(`${strIdNum}_${cid}`);
                if (comp) break;
              }
            }
            if (!comp) {
              for (const cid of candidateCompIds) {
                comp = compMap.get(cid) || compMapByCompId.get(cid);
                if (comp) break;
              }
            }
            if (!comp && strIdNum) {
              for (const qid of candidateQids) {
                const qUpper = qid.toUpperCase();
                const norm = qUpper.replace(/[^A-Z0-9]/g, "");
                comp = compMapByStrAndQid.get(`${strIdNum}_${qUpper}`)
                  || (norm ? compMapByStrAndQid.get(`${strIdNum}_NORM_${norm}`) : null);
                if (comp) break;
              }
            }
            if (!comp) {
              for (const qid of candidateQids) {
                const qUpper = qid.toUpperCase();
                const norm = qUpper.replace(/[^A-Z0-9]/g, "");
                comp = compMapByQid.get(qUpper)
                  || (norm ? compMapByQid.get(`NORM_${norm}`) : null);
                if (comp) break;
              }
            }
            if (!comp) {
              comp = r.structure_components || r.component;
            }

            const rawIdNo = String(comp?.id_no || comp?.metadata?.id_no || idata.id_no || r.id_no || "").trim().toUpperCase();
            let idNoPrefix = "";
            if (rawIdNo.includes("/")) {
              idNoPrefix = rawIdNo.split("/")[0].trim();
            }

            const recCompCode = String(comp?.code || comp?.metadata?.code || comp?.metadata?.comp_code || idata.comp_code || idata.code || r.code || "").trim().toUpperCase();
            const rawQid = String(comp?.q_id || comp?.metadata?.q_id || r.q_id || r.component_qid || idata.q_id || idata.component_qid || idata.component || "").trim().toUpperCase();
            const compDesc = String(comp?.description || comp?.name || comp?.metadata?.description || comp?.metadata?.compdesc || idata.compdesc || idata.description || "").trim().toUpperCase();

            // 1. Explicit reject if known non-anode component code or non-anode id_no prefix (e.g. VD, BL, CL, RG, SG, CU, MB, LG, ND, BR)
            if (recCompCode && recCompCode !== "AN") {
              return false;
            }
            if (idNoPrefix && idNoPrefix !== "AN") {
              return false;
            }

            // 2. Reject if description indicates non-anode structure component unless it explicitly mentions ANODE
            if (
              (compDesc.includes("BOATLANDING") || compDesc.includes("GUARD") || compDesc.includes("MEMBER") || compDesc.includes("DIAGONAL") || compDesc.includes("CONDUCTOR") || compDesc.includes("CAISSON") || compDesc.includes("RISER") || compDesc.includes("SUPPORT")) &&
              !compDesc.includes("ANODE") &&
              !rawQid.startsWith("BAN") &&
              !rawQid.startsWith("LAN") &&
              !rawQid.startsWith("CAN") &&
              !rawQid.startsWith("TAN") &&
              !rawQid.startsWith("AN")
            ) {
              return false;
            }

            // 3. Strictly require that this is an ANODE component
            const isAnodeComp =
              recCompCode === "AN" ||
              idNoPrefix === "AN" ||
              rawQid.startsWith("BAN") ||
              rawQid.startsWith("LAN") ||
              rawQid.startsWith("CAN") ||
              rawQid.startsWith("TAN") ||
              rawQid.startsWith("ANODE") ||
              (rawQid.startsWith("AN") && !rawQid.startsWith("ANS")) ||
              candidateQids.some((q) => {
                const u = q.toUpperCase();
                return u.startsWith("BAN") || u.startsWith("LAN") || u.startsWith("CAN") || u.startsWith("TAN") || u.startsWith("ANODE") || (u.startsWith("AN") && !u.startsWith("ANS"));
              });

            if (!isAnodeComp) {
              return false;
            }

            return true;
          }

          if (code === "PGS") {
            const rovCodes = ["RGVI", "RMGI", "RSANI", "RFMD", "RSCOR", "RCASN", "RCOND", "RICMI", "RRISI", "RSEAB", "RSWNI", "RSZCI", "RUTWT", "RWDI", "PGS", "ROVGEN"];
            if (
              rovCodes.includes(recType) ||
              rovCodes.includes(itypeCode) ||
              rovCodes.some((c) => recType.includes(c) || itypeCode.includes(c)) ||
              itypeName.includes("ROV") ||
              recType.startsWith("R") ||
              itypeCode.startsWith("R") ||
              Boolean(r.rov_job_id)
            ) {
              return true;
            }
          }

          if (code === "ITS") {
            const idata = r.inspection_data || {};
            if (idata.item_type || idata.itemType || recType === "PL_IC" || itypeCode === "PL_IC" || itypeName.includes("ITEM")) {
              return true;
            }
          }

          if (code === "AFS") {
            const idata = r.inspection_data || {};
            if (
              idata.acfmc_page !== undefined ||
              idata.probe_fl !== undefined ||
              idata.chord_weld_brace !== undefined ||
              idata.probe_flow !== undefined ||
              idata.chord_thick_3clk !== undefined ||
              idata.brace_thick_3clk !== undefined ||
              recType === "AFMC" ||
              recType === "ACFMC" ||
              recType.includes("ACFM") ||
              recType.includes("AFMC") ||
              itypeCode === "AFMC" ||
              itypeCode === "ACFMC" ||
              itypeCode.includes("ACFM") ||
              itypeName.includes("ACFM")
            ) {
              return true;
            }
          }

          if (code === "CVS") {
            const idata = r.inspection_data || {};
            if (
              idata.lighting_method !== undefined ||
              idata.length !== undefined ||
              idata.width !== undefined ||
              recType === "CVINS" ||
              recType === "CVI" ||
              recType.includes("CVINS") ||
              recType.includes("CVI") ||
              itypeCode === "CVINS" ||
              itypeCode === "CVI" ||
              itypeName.includes("CLOSE VISUAL")
            ) {
              return true;
            }
          }

          if (code === "BSS") {
            const idata = r.inspection_data || {};
            if (
              idata.no_bolts_pres_memb !== undefined ||
              idata.appurtenance_clamp_type !== undefined ||
              idata.member_clamp_cp !== undefined ||
              idata.max_gap_top_member !== undefined ||
              idata.max_gap_top_brace !== undefined ||
              idata.clamp_coating_satisfactory !== undefined ||
              recType === "BSINS" ||
              recType === "BSS" ||
              recType.includes("BSINS") ||
              recType.includes("BOLT") ||
              itypeCode === "BSINS" ||
              itypeCode === "BSS" ||
              itypeCode.includes("BSINS") ||
              itypeName.includes("BOLTED")
            ) {
              return true;
            }
          }

          if (code === "RSS") {
            const idata = r.inspection_data || {};
            if (
              recType === "RISER" ||
              recType === "RSS" ||
              recType === "RRISI" ||
              recType.includes("RISER") ||
              itypeCode === "RISER" ||
              itypeCode === "RSS" ||
              itypeCode === "RRISI" ||
              itypeCode.includes("RISER") ||
              itypeName.includes("RISER") ||
              idata.span_height !== undefined ||
              idata.riserbend_elevation !== undefined ||
              idata.marine_growth_soft !== undefined ||
              idata.marine_growth_hard !== undefined ||
              idata.wall_thickness !== undefined ||
              idata.riser_present !== undefined ||
              idata.riser_pres !== undefined ||
              idata.riser_type !== undefined ||
              idata.clamp_qid !== undefined ||
              idata.no_bolts !== undefined ||
              idata.no_nuts !== undefined
            ) {
              return true;
            }
          }

          if (code === "MPS") {
            const idata = r.inspection_data || {};
            if (
              idata.magnetic_ink !== undefined ||
              idata.magnetic_method !== undefined ||
              idata.background_condition !== undefined ||
              idata.calib_block !== undefined ||
              idata.magnetic_lifting_power !== undefined ||
              idata.burmah_c_strip !== undefined ||
              idata.probe !== undefined ||
              idata.acfmc_page !== undefined ||
              idata.probe_fl !== undefined ||
              idata.chord_weld_brace !== undefined ||
              idata.probe_flow !== undefined ||
              idata.brace_thick_3clk !== undefined ||
              idata.chord_thick_3clk !== undefined ||
              recType === "MPINS" ||
              recType === "MPI" ||
              recType === "MPS" ||
              recType === "ACFMC" ||
              recType === "AFMC" ||
              recType === "ACFM" ||
              recType === "AFS" ||
              recType.includes("MPINS") ||
              recType.includes("MPI") ||
              recType.includes("MAG") ||
              recType.includes("ACFM") ||
              recType.includes("AFMC") ||
              itypeCode === "MPINS" ||
              itypeCode === "MPI" ||
              itypeCode === "MPS" ||
              itypeCode === "ACFMC" ||
              itypeCode === "AFMC" ||
              itypeCode === "ACFM" ||
              itypeCode === "AFS" ||
              itypeCode.includes("MPINS") ||
              itypeCode.includes("MPI") ||
              itypeCode.includes("MAG") ||
              itypeCode.includes("ACFM") ||
              itypeName.includes("MAGNETIC") ||
              itypeName.includes("MPI") ||
              itypeName.includes("ACFM")
            ) {
              return true;
            }
          }

          if (code === "PHS") {
            const idata = r.inspection_data || {};
            if (
              idata.camera_type !== undefined ||
              idata.subject_of_photo !== undefined ||
              idata.exposure_number !== undefined ||
              idata.photo_no !== undefined ||
              idata.film_type !== undefined ||
              idata.film_no !== undefined ||
              recType === "PHOTO" ||
              recType === "PHS" ||
              recType.includes("PHOTO") ||
              itypeCode === "PHOTO" ||
              itypeCode === "PHS" ||
              itypeCode.includes("PHOTO") ||
              itypeName.includes("PHOTO")
            ) {
              return true;
            }
          }

          if (code === "VDS") {
            const dj = r.dive_job_id ? diveJobMap.get(Number(r.dive_job_id)) : null;
            const tape = r.dive_job_id ? videoTapeMapByDiveJobId.get(Number(r.dive_job_id)) : null;
            const itypeMethods = itype?.methods || [];
            if (
              r.dive_job_id != null ||
              dj != null ||
              tape != null ||
              itypeMethods.includes("DIVING") ||
              recType === "VIDEO" ||
              recType === "VDS" ||
              recType.includes("DIV") ||
              itypeCode === "VIDEO" ||
              itypeCode === "VDS" ||
              itypeCode.includes("DIV") ||
              itypeName.includes("DIV") ||
              videoLogMapByInspId.has(Number(r.insp_id))
            ) {
              return true;
            }
          }

          if (code === "UTS") {
            const idata = r.inspection_data || {};
            if (
              idata.ut_3_o_clock !== undefined ||
              idata.ut_6_o_clock !== undefined ||
              idata.ut_9_o_clock !== undefined ||
              idata.ut_12_o_clock !== undefined ||
              idata.nominal_thickness !== undefined ||
              idata.max_reading !== undefined ||
              idata.min_reading !== undefined ||
              idata.avg_reading !== undefined ||
              idata.wall_thickness_loss !== undefined ||
              idata.scan_type !== undefined ||
              idata.size_of_area_tested !== undefined ||
              idata.reference_point_position !== undefined ||
              recType === "UTWTK" ||
              recType === "UTS" ||
              recType === "SZONE" ||
              recType === "SZS" ||
              recType.includes("UTWTK") ||
              recType.includes("UT_WTK") ||
              recType.includes("SZONE") ||
              recType.includes("SPLASH") ||
              itypeCode === "UTWTK" ||
              itypeCode === "UTS" ||
              itypeCode === "SZONE" ||
              itypeCode === "SZS" ||
              itypeCode.includes("UTWTK") ||
              itypeCode.includes("SZONE") ||
              itypeName.includes("WALL THICKNESS") ||
              itypeName.includes("UTWTK") ||
              itypeName.includes("SPLASH")
            ) {
              return true;
            }
          }

          if (code === "FDS") {
            const idata = r.inspection_data || {};
            if (
              idata.flooded !== undefined ||
              idata.grout !== undefined ||
              idata.is_flooded !== undefined ||
              idata.member_status !== undefined ||
              recType === "FLOOD" ||
              recType === "FDS" ||
              recType === "FMD" ||
              recType === "RFMD" ||
              recType.includes("FLOOD") ||
              recType.includes("FMD") ||
              recType.includes("RFMD") ||
              itypeCode === "FLOOD" ||
              itypeCode === "FDS" ||
              itypeCode === "FMD" ||
              itypeCode === "RFMD" ||
              itypeCode.includes("FLOOD") ||
              itypeCode.includes("FMD") ||
              itypeCode.includes("RFMD") ||
              itypeName.includes("FLOOD")
            ) {
              return true;
            }
          }

          if (code === "DBS") {
            const idata = r.inspection_data || {};
            const debrisCandidate = idata.debris ?? idata.debris_item ?? idata.item ?? idata.debris_type ?? idata.debris_name ?? idata.size_of_debris ?? idata.material ?? r.debris ?? r.item ?? r.debris_item;
            const debrisStr = debrisCandidate != null ? String(debrisCandidate).trim().toUpperCase() : "";
            const isInvalidDebrisStr = !debrisStr || ["NULL", "UNDEFINED", "NONE", "N/A", "NA", "N.A.", "NIL", "NO", "FALSE", "0"].includes(debrisStr);

            const hasDimensions = (idata.length_debris != null && idata.length_debris !== "" && Number(idata.length_debris) > 0) ||
                                  (idata.width_debris != null && idata.width_debris !== "" && Number(idata.width_debris) > 0) ||
                                  (idata.height_debris != null && idata.height_debris !== "" && Number(idata.height_debris) > 0);

            const hasDebrisOrItem = (!isInvalidDebrisStr) || hasDimensions || (idata.debris_present === true || String(idata.debris_present).toUpperCase() === "YES" || String(idata.debris_present).toUpperCase() === "TRUE");

            if (!hasDebrisOrItem) {
              return false;
            }

            return true;
          }

          if (code === "SCS") {
            const idata = r.inspection_data || {};
            if (
              idata.scour_depth !== undefined ||
              idata.scour_location !== undefined ||
              idata.exposed_pile !== undefined ||
              idata.Exposed_pile !== undefined ||
              idata.burial_percent !== undefined ||
              idata.Burial_percent !== undefined ||
              idata.platform_face !== undefined ||
              idata.mud_mat_height !== undefined ||
              idata.frame_rdg !== undefined ||
              idata.bottm_rdg !== undefined ||
              idata.scour_rdg !== undefined ||
              idata.scour_size !== undefined ||
              recType === "SCOUR" ||
              recType === "SCR" ||
              recType === "RSCOR" ||
              recType === "SCS" ||
              recType.includes("SCOUR") ||
              recType.includes("RSCOR") ||
              itypeCode === "SCOUR" ||
              itypeCode === "SCR" ||
              itypeCode === "RSCOR" ||
              itypeCode === "SCS" ||
              itypeCode.includes("SCOUR") ||
              itypeCode.includes("RSCOR") ||
              itypeName.includes("SCOUR")
            ) {
              return true;
            }
          }

          if (code === "MGS") {
            const idata = r.inspection_data || {};
            if (
              idata.mgi_hard_growth !== undefined ||
              idata.mgi_soft_growth !== undefined ||
              idata.hard_growth !== undefined ||
              idata.soft_growth !== undefined ||
              idata.mgi_hard_thickness_at_3 !== undefined ||
              idata.mgi_soft_thickness_at_3 !== undefined ||
              idata.circumferential_measurement_0m !== undefined ||
              idata.hard_circum !== undefined ||
              idata.soft_circum !== undefined ||
              idata.effective_thickness !== undefined ||
              idata.mgi_profile !== undefined ||
              recType === "MGROW" ||
              recType === "MGINS" ||
              recType === "MGS" ||
              recType === "RMGI" ||
              recType.includes("MGROW") ||
              recType.includes("MARINE_GROWTH") ||
              itypeCode === "MGROW" ||
              itypeCode === "MGINS" ||
              itypeCode === "MGS" ||
              itypeCode === "RMGI" ||
              itypeCode.includes("MGROW") ||
              itypeCode.includes("MARINE") ||
              itypeName.includes("MARINE")
            ) {
              return true;
            }
          }

          if (code === "GVS") {
            const idata = r.inspection_data || {};
            if (
              idata.coating_condition !== undefined ||
              idata.component_condition !== undefined ||
              idata.marine_growth_hard !== undefined ||
              idata.marine_growth_soft !== undefined ||
              idata.marine_growth_pct !== undefined ||
              recType === "GVINS" ||
              recType === "GVI" ||
              recType === "GVS" ||
              recType === "RGVI" ||
              recType.includes("GVINS") ||
              recType.includes("GENERAL_VISUAL") ||
              itypeCode === "GVINS" ||
              itypeCode === "GVI" ||
              itypeCode === "GVS" ||
              itypeCode === "RGVI" ||
              itypeCode.includes("GVINS") ||
              itypeName.includes("GENERAL VISUAL")
            ) {
              return true;
            }
          }

          if (code === "BTS") {
            if (
              recType === "BOTTM" ||
              itypeCode === "BOTTM"
            ) {
              return true;
            }
            return false;
          }

          if (recType.includes("PGS") && ["CPS", "FDS", "GVS", "MGS", "SCS"].includes(code)) return true;
          if (recType.includes("SZS") && ["CPS", "UTS"].includes(code)) return true;
          if ((recType.includes("BSS") || recType.includes("BSINS")) && ["CPS"].includes(code)) return true;
          if (recType.includes("AFS") && ["MPS"].includes(code)) return true;
          return false;
        });

        let recordsToProcess = matchingRecords;

        if (code === "SCS") {
          const scsGroups = new Map<string, any[]>();
          matchingRecords.forEach((r: any) => {
            const idata = r.inspection_data || {};
            const recQid = String(r.q_id || r.component_qid || idata.q_id || idata.component_qid || idata.component || "").trim().toUpperCase();
            const recCompId = r.component_id || idata.component_id || idata.comp_id || "";
            const groupKey = `${r.structure_id || ""}_${recQid || recCompId || r.insp_id}_${r.jobpack_id || ""}`;
            if (!scsGroups.has(groupKey)) {
              scsGroups.set(groupKey, []);
            }
            scsGroups.get(groupKey)!.push(r);
          });

          recordsToProcess = Array.from(scsGroups.values()).map((recs: any[]) => {
            const primary = recs.find((r) => r.has_anomaly === true) ||
                            recs.find((r) => String(r.status || "").toUpperCase() === "COMPLETED") ||
                            recs[0];

            // Resolve component for this QID / group to obtain Start/End leg & Start/End node
            let groupComp: any = null;
            for (const r of recs) {
              const strIdNum = Number(r.structure_id);
              const idata = r.inspection_data || {};
              const cIds = [Number(r.component_id), Number(idata.component_id), Number(idata.comp_id)].filter((n) => !isNaN(n) && n > 0);
              const qIds = [String(r.q_id || ""), String(r.component_qid || ""), String(idata.q_id || ""), String(idata.component_qid || ""), String(idata.component || "")].map((s) => s.trim()).filter((s) => s.length > 0);

              if (strIdNum) {
                for (const cid of cIds) {
                  groupComp = compMapByStrAndId.get(`${strIdNum}_${cid}`) || compMapByStrAndCompId.get(`${strIdNum}_${cid}`);
                  if (groupComp) break;
                }
                if (!groupComp) {
                  for (const qid of qIds) {
                    const qUpper = qid.toUpperCase();
                    const norm = qUpper.replace(/[^A-Z0-9]/g, "");
                    groupComp = compMapByStrAndQid.get(`${strIdNum}_${qUpper}`) || (norm ? compMapByStrAndQid.get(`${strIdNum}_NORM_${norm}`) : null);
                    if (groupComp) break;
                  }
                }
              }
              if (!groupComp) {
                for (const qid of qIds) {
                  const qUpper = qid.toUpperCase();
                  const norm = qUpper.replace(/[^A-Z0-9]/g, "");
                  groupComp = compMapByQid.get(qUpper) || (norm ? compMapByQid.get(`NORM_${norm}`) : null);
                  if (groupComp) break;
                }
              }
              if (groupComp || r.structure_components) {
                groupComp = groupComp || r.structure_components;
                break;
              }
            }

            const gMeta = groupComp?.metadata || {};
            const sLeg = String(groupComp?.s_leg || gMeta.s_leg || gMeta.start_leg || "").trim().toUpperCase();
            const sNode = String(groupComp?.s_node || gMeta.s_node || gMeta.start_node || "").trim().toUpperCase();
            const fLeg = String(groupComp?.f_leg || gMeta.f_leg || gMeta.end_leg || "").trim().toUpperCase();
            const fNode = String(groupComp?.f_node || gMeta.f_node || gMeta.end_node || "").trim().toUpperCase();

            let midPointVal: any = "";
            let startLegVal: any = sLeg;
            let endLegVal: any = fLeg;
            let expPileLeg1Val = "NO";
            let expPileLeg2Val = "NO";
            let depth1Val: any = "";
            let depth2Val: any = "";
            let frameRdgVal: any = "";
            let bottmRdgVal: any = "";
            let scourRdgVal: any = "";
            let scourSizeVal = "";

            recs.forEach((r) => {
              const idata = r.inspection_data || {};
              const rawLoc = String(idata.scour_location || idata.scour_at_loc || idata.location || "").trim();
              const locUpper = rawLoc.toUpperCase();
              const cleanLoc = formatScourAtLoc(rawLoc);

              const isStart = locUpper.includes("START") || locUpper.includes("LEG 1") || locUpper.includes("LEG1") || locUpper.includes("NODE 1") || locUpper.includes("NODE1") ||
                              Boolean(sLeg && (cleanLoc === sLeg || locUpper.includes(sLeg))) ||
                              Boolean(sNode && (cleanLoc === sNode || locUpper.includes(sNode)));

              const isEnd = locUpper.includes("END") || locUpper.includes("LEG 2") || locUpper.includes("LEG2") || locUpper.includes("NODE 2") || locUpper.includes("NODE2") ||
                            Boolean(fLeg && (cleanLoc === fLeg || locUpper.includes(fLeg))) ||
                            Boolean(fNode && (cleanLoc === fNode || locUpper.includes(fNode)));

              const isMid = locUpper.includes("MID") || locUpper === "MIDPOINT" || cleanLoc === "MIDPOINT";

              const depth = idata.scour_depth ?? idata.depth;
              const expPile = idata.exposed_pile ?? idata.Exposed_pile ?? idata.pile_exposed;
              const isExpPile = expPile === true || expPile === "true" || expPile === "True" || expPile === "TRUE" || expPile === "yes" || expPile === "Yes" || expPile === "YES" || expPile === 1 || expPile === "1";

              if (isMid && depth != null && depth !== "") {
                midPointVal = depth;
              } else if (idata.mid_point != null && idata.mid_point !== "") {
                midPointVal = idata.mid_point;
              }

              if (isStart) {
                if (depth != null && depth !== "") depth1Val = depth;
                if (isExpPile) expPileLeg1Val = "YES";
                if (!startLegVal && (cleanLoc || idata.leg_name || idata.leg1 || idata.start_leg)) {
                  startLegVal = sLeg || cleanLoc || idata.leg_name || idata.leg1 || idata.start_leg;
                }
              }
              if (idata.depth1 != null && idata.depth1 !== "") depth1Val = idata.depth1;
              if (idata.exp_pile_leg1 != null && idata.exp_pile_leg1 !== "") expPileLeg1Val = idata.exp_pile_leg1;

              if (isEnd) {
                if (depth != null && depth !== "") depth2Val = depth;
                if (isExpPile) expPileLeg2Val = "YES";
                if (!endLegVal && (cleanLoc || idata.leg_name || idata.leg2 || idata.end_leg)) {
                  endLegVal = fLeg || cleanLoc || idata.leg_name || idata.leg2 || idata.end_leg;
                }
              }
              if (idata.depth2 != null && idata.depth2 !== "") depth2Val = idata.depth2;
              if (idata.exp_pile_leg2 != null && idata.exp_pile_leg2 !== "") expPileLeg2Val = idata.exp_pile_leg2;

              if (idata.frame_rdg != null && idata.frame_rdg !== "") frameRdgVal = idata.frame_rdg;
              if (idata.mud_mat_height != null && idata.mud_mat_height !== "") frameRdgVal = idata.mud_mat_height;
              if (idata.bottm_rdg != null && idata.bottm_rdg !== "") bottmRdgVal = idata.bottm_rdg;
              if (idata.bottom_reading != null && idata.bottom_reading !== "") bottmRdgVal = idata.bottom_reading;
              if (idata.scour_rdg != null && idata.scour_rdg !== "") scourRdgVal = idata.scour_rdg;
              if (idata.scour_reading != null && idata.scour_reading !== "") scourRdgVal = idata.scour_reading;
              if (idata.scour_size) scourSizeVal = idata.scour_size;
            });

            return {
              ...primary,
              _scsMergedData: {
                midPointVal,
                startLegVal: startLegVal || sLeg,
                endLegVal: endLegVal || fLeg,
                expPileLeg1Val,
                expPileLeg2Val,
                depth1Val,
                depth2Val,
                frameRdgVal,
                bottmRdgVal,
                scourRdgVal,
                scourSizeVal,
              }
            };
          });
        }

        recordsToProcess.forEach((r: any) => {
          const strObj = structureMap.get(Number(r.structure_id));
          const idata = r.inspection_data || {};
          const strIdNum = Number(r.structure_id);

          const candidateCompIds = [
            Number(r.component_id),
            Number(idata.component_id),
            Number(idata.comp_id),
            Number(idata.structure_component_id),
            Number(idata.compid),
            Number(idata.anode_id),
            Number(idata.member_id),
          ].filter((n) => !isNaN(n) && n > 0);

          const candidateQids = [
            String(r.q_id || ""),
            String(r.component_qid || ""),
            String(idata.q_id || ""),
            String(idata.component_qid || ""),
            String(idata.component || ""),
            String(idata.comp_qid || ""),
            String(idata.id_no || ""),
            String(idata.component_id_no || ""),
            String(idata.anode_no || ""),
            String(idata.anod_no || ""),
            String(idata.anode_tag || ""),
            String(idata.member || ""),
            String(idata.member_name || ""),
            String(idata.tag || ""),
          ].map((s) => s.trim()).filter((s) => s.length > 0);

          let comp: any = null;

          // 1. By structure_id + ID / comp_id
          if (strIdNum) {
            for (const cid of candidateCompIds) {
              comp = compMapByStrAndId.get(`${strIdNum}_${cid}`) || compMapByStrAndCompId.get(`${strIdNum}_${cid}`);
              if (comp) break;
            }
          }

          // 2. By global ID / comp_id
          if (!comp) {
            for (const cid of candidateCompIds) {
              comp = compMap.get(cid) || compMapByCompId.get(cid);
              if (comp) break;
            }
          }

          // 3. By structure_id + QID / tag / id_no
          if (!comp && strIdNum) {
            for (const qid of candidateQids) {
              const qUpper = qid.toUpperCase();
              const norm = qUpper.replace(/[^A-Z0-9]/g, "");
              comp = compMapByStrAndQid.get(`${strIdNum}_${qUpper}`)
                || (norm ? compMapByStrAndQid.get(`${strIdNum}_NORM_${norm}`) : null);
              if (comp) break;
            }
          }

          // 4. By global QID / tag / id_no
          if (!comp) {
            for (const qid of candidateQids) {
              const qUpper = qid.toUpperCase();
              const norm = qUpper.replace(/[^A-Z0-9]/g, "");
              comp = compMapByQid.get(qUpper)
                || (norm ? compMapByQid.get(`NORM_${norm}`) : null);
              if (comp) break;
            }
          }

          // 5. Embedded
          if (!comp) {
            comp = r.structure_components || r.component;
          }

          const jp = jobpackMap.get(Number(r.jobpack_id));
          const meta = comp?.metadata || {};
          const isCalib = code === "UCS" || code === "CCS";
          const jpIdNum = Number(r.jobpack_id);

          const recTypeUpper = String(r.inspection_type_code || r.insp_type || r.insptype || r.type || "").trim().toUpperCase();
          const idataInspType = String(idata.inspection_type_code || idata.insp_type || idata.insptype || idata.inspection_type || idata.type || "").trim().toUpperCase();
          const itype = r.inspection_type_id ? inspTypeMapById.get(Number(r.inspection_type_id)) : null;
          const itypeCodeUpper = String(itype?.code || "").trim().toUpperCase();
          const itypeNameUpper = String(itype?.name || "").trim().toUpperCase();

          const rovInspectionCodes = new Set([
            "RGVI", "RMGI", "RSANI", "RFMD", "RSCOR", "RCASN", "RCOND", "RICMI", "RRISI", "RSEAB", "RSWNI", "RSZCI", "RUTWT", "RWDI", "PGS", "ROV", "RCP"
          ]);

          const isPgsInspection =
            code === "PGS" ||
            recTypeUpper === "PGS" ||
            recTypeUpper.includes("PGS") ||
            idataInspType === "PGS" ||
            idataInspType.includes("PGS") ||
            itypeCodeUpper === "PGS" ||
            itypeNameUpper.includes("PGS") ||
            itypeNameUpper.includes("PLATFORM GENERAL");

          const isRovInspection =
            isPgsInspection ||
            (r.rov_job_id != null && Number(r.rov_job_id) > 0) ||
            rovInspectionCodes.has(code) ||
            rovInspectionCodes.has(recTypeUpper) ||
            rovInspectionCodes.has(idataInspType) ||
            rovInspectionCodes.has(itypeCodeUpper) ||
            recTypeUpper.startsWith("R") ||
            idataInspType.startsWith("R") ||
            itypeCodeUpper.startsWith("R") ||
            recTypeUpper.includes("ROV") ||
            idataInspType.includes("ROV") ||
            itypeNameUpper.includes("ROV") ||
            String(r.mode || idata.mode || "").toUpperCase().includes("ROV");

          // Dive Job Multi-Tier Lookup (insp_dive_jobs)
          const candidateDiveIds = [
            Number(r.dive_job_id),
            Number(idata.dive_job_id),
            Number(idata.dive_id),
            Number(idata.divejob_id),
          ].filter((n) => !isNaN(n) && n > 0);

          const candidateDiveNos = [
            String(r.dive_no || ""),
            String(idata.dive_no || ""),
            String(idata.diveno || ""),
            String(idata.dive_num || ""),
            String(idata.deployment_no || ""),
            String(idata.dive || ""),
            String(r.dive_job_id || ""),
            String(idata.dive_job_id || ""),
          ].map((s) => s.trim()).filter((s) => s.length > 0);

          let dj: any = null;
          if (strIdNum) {
            for (const did of candidateDiveIds) {
              dj = diveJobMapByStrAndId.get(`${strIdNum}_${did}`);
              if (dj) break;
            }
          }
          if (!dj && jpIdNum) {
            for (const did of candidateDiveIds) {
              dj = diveJobMapByJpAndId.get(`${jpIdNum}_${did}`);
              if (dj) break;
            }
          }
          if (!dj) {
            for (const did of candidateDiveIds) {
              dj = diveJobMap.get(did);
              if (dj) break;
            }
          }
          if (!dj && strIdNum) {
            for (const dno of candidateDiveNos) {
              const dnoUpper = dno.toUpperCase();
              const norm = dnoUpper.replace(/[^\d]/g, "");
              dj = diveJobMapByStrAndNo.get(`${strIdNum}_${dnoUpper}`)
                || (norm ? diveJobMapByStrAndNo.get(`${strIdNum}_${norm}`) : null)
                || (norm ? diveJobMapByStrAndNo.get(`${strIdNum}_DIVE_${norm}`) : null);
              if (dj) break;
            }
          }
          if (!dj && jpIdNum) {
            for (const dno of candidateDiveNos) {
              const dnoUpper = dno.toUpperCase();
              const norm = dnoUpper.replace(/[^\d]/g, "");
              dj = diveJobMapByJpAndNo.get(`${jpIdNum}_${dnoUpper}`)
                || (norm ? diveJobMapByJpAndNo.get(`${jpIdNum}_${norm}`) : null)
                || (norm ? diveJobMapByJpAndNo.get(`${jpIdNum}_DIVE_${norm}`) : null);
              if (dj) break;
            }
          }
          if (!dj) {
            for (const dno of candidateDiveNos) {
              const dnoUpper = dno.toUpperCase();
              const norm = dnoUpper.replace(/[^\d]/g, "");
              dj = diveJobMapByNo.get(dnoUpper)
                || (norm ? diveJobMapByNo.get(norm) : null)
                || (norm ? diveJobMapByNo.get(`DIVE_${norm}`) : null);
              if (dj) break;
            }
          }
          if (!dj) {
            dj = r.insp_dive_jobs || r.dive_job || idata.dive_job;
          }

          // ROV Job Multi-Tier Lookup (insp_rov_jobs)
          const candidateRovIds = [
            Number(r.rov_job_id),
            Number(idata.rov_job_id),
            Number(idata.rov_id),
            ...(isPgsInspection ? [Number(r.dive_job_id), Number(idata.dive_job_id), Number(idata.dive_id)] : []),
          ].filter((n) => !isNaN(n) && n > 0);

          const candidateRovNos = [
            String(r.rov_job_no || ""),
            String(idata.rov_job_no || ""),
            String(idata.rov_no || ""),
            String(idata.rov_num || ""),
            String(idata.rov || ""),
            ...(isPgsInspection ? [String(r.dive_no || ""), String(idata.dive_no || ""), String(idata.deployment_no || "")] : []),
          ].map((s) => s.trim()).filter((s) => s.length > 0);

          let rj: any = null;
          if (strIdNum) {
            for (const rid of candidateRovIds) {
              rj = rovJobMapByStrAndId.get(`${strIdNum}_${rid}`);
              if (rj) break;
            }
          }
          if (!rj && jpIdNum) {
            for (const rid of candidateRovIds) {
              rj = rovJobMapByJpAndId.get(`${jpIdNum}_${rid}`);
              if (rj) break;
            }
          }
          if (!rj) {
            for (const rid of candidateRovIds) {
              rj = rovJobMap.get(rid);
              if (rj) break;
            }
          }
          if (!rj && strIdNum) {
            for (const rno of candidateRovNos) {
              const rnoUpper = rno.toUpperCase();
              const norm = rnoUpper.replace(/[^\d]/g, "");
              rj = rovJobMapByStrAndNo.get(`${strIdNum}_${rnoUpper}`)
                || (norm ? rovJobMapByStrAndNo.get(`${strIdNum}_${norm}`) : null);
              if (rj) break;
            }
          }
          if (!rj && jpIdNum) {
            for (const rno of candidateRovNos) {
              const rnoUpper = rno.toUpperCase();
              const norm = rnoUpper.replace(/[^\d]/g, "");
              rj = rovJobMapByJpAndNo.get(`${jpIdNum}_${rnoUpper}`)
                || (norm ? rovJobMapByJpAndNo.get(`${jpIdNum}_${norm}`) : null);
              if (rj) break;
            }
          }
          if (!rj) {
            for (const rno of candidateRovNos) {
              const rnoUpper = rno.toUpperCase();
              const norm = rnoUpper.replace(/[^\d]/g, "");
              rj = rovJobMapByNo.get(rnoUpper)
                || (norm ? rovJobMapByNo.get(norm) : null);
              if (rj) break;
            }
          }
          if (!rj) {
            rj = r.insp_rov_jobs || r.rov_job || idata.rov_job;
          }

          const linkedAnom = anomMapByInspId.get(Number(r.insp_id))
            || (Array.isArray(r.insp_anomalies) && r.insp_anomalies.length > 0 ? r.insp_anomalies[0] : null)
            || (allAnomalies || []).find((a: any) => Number(a.inspection_id) === Number(r.insp_id));

          // Resolution for COMP_ID: structure_components.id or comp_id, positive integer, never 0.
          let resolvedCompId: any = "";
          if (!isCalib) {
            if (comp?.comp_id != null && Number(comp.comp_id) > 0) {
              resolvedCompId = Number(comp.comp_id);
            } else if (comp?.id != null && Number(comp.id) > 0) {
              resolvedCompId = Number(comp.id);
            } else if (candidateCompIds.length > 0) {
              resolvedCompId = candidateCompIds[0];
            }
          }

          // Resolution for ID_NO
          const resolvedIdNo = isCalib ? "" : sanitizeText(
            comp?.id_no || meta.id_no || meta.idno || idata.id_no || idata.idno || idata.component_id_no || r.id_no || comp?.q_id || meta.q_id || idata.q_id || ""
          ).substring(0, 25);

          // Resolution for Q_ID
          const resolvedQId = isCalib ? "" : sanitizeText(
            comp?.q_id || meta.q_id || meta.qid || r.q_id || r.component_qid || idata.q_id || idata.component_qid || idata.component || idata.comp_qid || idata.anode_no || idata.anod_no || idata.anode_tag || idata.member || idata.member_name || comp?.id_no || meta.id_no || idata.id_no || ""
          ).substring(0, 16);

          // Resolution for CODE
          const resolvedCode = isCalib ? "" : sanitizeText(
            comp?.code || meta.code || meta.comp_code || idata.comp_code || idata.code || r.code || (code === "ANS" ? "AN" : (code === "CPS" ? "CP" : ""))
          ).substring(0, 2).toUpperCase();

          // Resolution for COMPDESC
          const resolvedCompDesc = isCalib ? "" : sanitizeText(
            meta.description || meta.descr || meta.desc || meta.compdesc || meta.component_description || comp?.description || comp?.name || idata.compdesc || idata.component_description || idata.description || idata.desc || idata.descr || comp?.q_id || idata.q_id || ""
          ).substring(0, 40);

          // Resolution for Nodes & Legs
          const resolvedSNode = isCalib ? "" : sanitizeText(comp?.s_node || meta.s_node || meta.snode || meta.start_node || meta.startnode || idata.s_node || idata.snode || idata.start_node || idata.startnode || "").substring(0, 6);
          const resolvedFNode = isCalib ? "" : sanitizeText(comp?.f_node || meta.f_node || meta.fnode || meta.end_node || meta.endnode || idata.f_node || idata.fnode || idata.end_node || idata.endnode || "").substring(0, 6);
          const resolvedSLeg = isCalib ? "" : sanitizeText(comp?.s_leg || meta.s_leg || meta.sleg || meta.start_leg || meta.startleg || idata.s_leg || idata.sleg || idata.start_leg || idata.startleg || idata.leg_name || idata.leg1 || "").substring(0, 2);
          const resolvedFLeg = isCalib ? "" : sanitizeText(comp?.f_leg || meta.f_leg || meta.fleg || meta.end_leg || meta.endleg || idata.f_leg || idata.fleg || idata.end_leg || idata.endleg || idata.leg2 || "").substring(0, 2);

          // Resolution for Elevations
          const rawElv1 = comp?.elv_1 ?? meta.elv_1 ?? meta.elv1 ?? meta.start_elevation ?? meta.startelevation ?? meta.elevation_1 ?? idata.elv_1 ?? idata.elv1 ?? idata.start_elevation ?? idata.elevation_1 ?? idata.depth1 ?? r.elevation;
          const resolvedElv1 = isCalib ? "" : (rawElv1 != null && rawElv1 !== "" && !isNaN(Number(rawElv1)) ? Number(rawElv1) : "");

          const rawElv2 = comp?.elv_2 ?? meta.elv_2 ?? meta.elv2 ?? meta.end_elevation ?? meta.endelevation ?? meta.elevation_2 ?? idata.elv_2 ?? idata.elv2 ?? idata.end_elevation ?? idata.elevation_2 ?? idata.depth2;
          const resolvedElv2 = isCalib ? "" : (rawElv2 != null && rawElv2 !== "" && !isNaN(Number(rawElv2)) ? Number(rawElv2) : "");

          const rawDist = comp?.dist ?? meta.dist ?? meta.distance ?? idata.dist ?? idata.distance;
          const resolvedDist = isCalib ? "" : (rawDist != null && rawDist !== "" && !isNaN(Number(rawDist)) ? Number(rawDist) : "");

          const rawClk = comp?.clk_pos ?? meta.clk_pos ?? meta.clkpos ?? meta.clock_position ?? meta.clock ?? meta.cp_clock ?? idata.clk_pos ?? idata.clkpos ?? idata.clock_position ?? idata.clock ?? idata.cp_clock;
          let resolvedClkPos: any = isCalib ? "" : 0;
          if (!isCalib && rawClk != null && rawClk !== "") {
            const clkStr = String(rawClk).toUpperCase().trim();
            if (clkStr === "N/A" || clkStr === "NA" || clkStr === "NONE") {
              resolvedClkPos = 0;
            } else if (!isNaN(Number(rawClk))) {
              resolvedClkPos = Number(rawClk);
            }
          }

          // Resolution for COMPTYPE
          const recCompTypeDesc = compTypeMap.get(resolvedCode)
            || compTypeMap.get(String(comp?.code || meta.code || "").trim().toUpperCase())
            || comp?.type
            || comp?.comp_type
            || meta.comptype
            || meta.comp_type
            || idata.comptype
            || idata.comp_type
            || (isCalib ? "CALIBRATION" : (code === "ANS" ? "ANODE" : (code === "CPS" ? "CP SURVEY" : "MEMBER")));

          let resolvedDiveNo = "";
          let resolvedDiver = "";
          let resolvedSupervisor = "";

          if (isRovInspection) {
            // For PGS and all ROV inspection types, refer to rov_job_id and fetch from insp_rov_jobs (with fallback to insp_dive_jobs)
            resolvedDiveNo = rj?.deployment_no
              || rj?.rov_job_no
              || rj?.job_no
              || rj?.name
              || rj?.dive_no
              || dj?.deployment_no
              || dj?.dive_no
              || dj?.job_no
              || dj?.name
              || r.dive_no
              || idata.dive_no
              || idata.deployment_no
              || r.rov_job_no
              || idata.rov_job_no
              || idata.rov_no
              || idata.diveno
              || idata.dive_num
              || idata.dive
              || "";

            resolvedDiver = rj?.rov_operator
              || rj?.pilot_name
              || rj?.pilot
              || rj?.pilot_1
              || rj?.diver_name
              || rj?.diver
              || idata.rov_operator
              || idata.pilot_name
              || idata.pilot
              || r.pilot_name
              || r.pilot
              || dj?.diver_name
              || dj?.diver
              || dj?.standby_diver
              || r.diver_name
              || r.diver
              || idata.diver_name
              || idata.diver
              || idata.inspector
              || r.inspector
              || "";

            resolvedSupervisor = rj?.rov_supervisor
              || rj?.supervisor
              || rj?.report_coordinator
              || idata.rov_supervisor
              || idata.supervisor
              || r.rov_supervisor
              || r.supervisor
              || dj?.dive_supervisor
              || dj?.supervisor
              || dj?.report_coordinator
              || r.dive_supervisor
              || idata.dive_supervisor
              || idata.dive_supv
              || idata.supv
              || "";
          } else {
            // For other inspection types, refer to dive_job_id and fetch from insp_dive_jobs (with fallback to insp_rov_jobs)
            resolvedDiveNo = dj?.dive_no
              || dj?.deployment_no
              || dj?.job_no
              || dj?.name
              || rj?.deployment_no
              || rj?.rov_job_no
              || rj?.job_no
              || rj?.name
              || r.dive_no
              || idata.dive_no
              || idata.deployment_no
              || idata.diveno
              || idata.dive_num
              || idata.dive
              || r.rov_job_no
              || idata.rov_job_no
              || "";

            resolvedDiver = dj?.diver_name
              || dj?.diver
              || dj?.standby_diver
              || rj?.rov_operator
              || rj?.pilot_name
              || rj?.pilot
              || rj?.pilot_1
              || r.diver_name
              || r.diver
              || idata.diver_name
              || idata.diver
              || idata.diver1
              || idata.rov_operator
              || idata.pilot_name
              || idata.pilot
              || idata.inspector
              || r.inspector
              || "";

            resolvedSupervisor = dj?.dive_supervisor
              || dj?.supervisor
              || dj?.report_coordinator
              || r.dive_supervisor
              || r.supervisor
              || idata.dive_supervisor
              || idata.supervisor
              || idata.dive_supv
              || idata.supv
              || idata.super_visor
              || rj?.rov_supervisor
              || rj?.supervisor
              || rj?.report_coordinator
              || idata.rov_supervisor
              || r.rov_supervisor
              || "";
          }

          const resolvedInspector = isRovInspection
            ? (r.inspector || idata.inspector || rj?.pilot_name || rj?.pilot || dj?.diver_name || "")
            : (r.inspector || idata.inspector || dj?.diver_name || dj?.diver || rj?.pilot_name || "");

          const baseRow: any = {
            STR_ID: r.structure_id || strObj?.plat_id || 1,
            TITLE: sanitizeText(strObj?.title || `Platform ${r.structure_id}`).substring(0, 20),
            PFIELD: sanitizeText(strObj?.pfield || "").substring(0, 20),
            PDESC: sanitizeText(strObj?.pdesc || "").substring(0, 50),
            DEF_UNIT: sanitizeText(strObj?.def_unit || "Metric").substring(0, 10),
            COMP_ID: resolvedCompId,
            ID_NO: resolvedIdNo,
            Q_ID: resolvedQId,
            CODE: resolvedCode,
            COMPDESC: resolvedCompDesc,
            S_NODE: resolvedSNode,
            F_NODE: resolvedFNode,
            S_LEG: resolvedSLeg,
            F_LEG: resolvedFLeg,
            ELV_1: resolvedElv1,
            ELV_2: resolvedElv2,
            DIST: resolvedDist,
            CLK_POS: resolvedClkPos,
            COMPTYPE: isCalib ? "" : sanitizeText(recCompTypeDesc).substring(0, 30),
            INSP_ID: r.insp_id,
            INSP_DATE: formatDateStr(r.inspection_date),
            INSP_TIME: sanitizeText(r.inspection_time || idata.insp_time || idata.time || "").substring(0, 8),
            INSPECTOR: sanitizeText(resolvedInspector).substring(0, 20),
            PROC: sanitizeText(r.procedure || idata.procedure || idata.proc || "").substring(0, 20),
            EQUIP: sanitizeText(r.equipment || idata.equipment || idata.calib_equipment_type || idata.equip || "").substring(0, 20),
            EQ_ID: sanitizeText(r.equipment_id || idata.equipment_id || idata.serial_number || idata.eq_id || "").substring(0, 20),
            SPEC: sanitizeText(r.spec || idata.spec || idata.specification || "").substring(0, 20),
            SURF_COND: sanitizeText(r.surf_cond || idata.surface_condition || idata.surf_cond || "").substring(0, 30),
            CLEAN_MET: sanitizeText(r.clean_met || idata.cleaning_method || idata.clean_met || "").substring(0, 20),
            SCAF: (idata.scaffolding || r.scaf || idata.scaf) ? "Yes" : "",
            SUPV: sanitizeText(resolvedSupervisor).substring(0, 20),
            DIVR: sanitizeText(resolvedDiver).substring(0, 20),
            DIVE_NO: sanitizeText(resolvedDiveNo).substring(0, 10),
            ELEVATION: isCalib ? "" : (r.elevation != null && r.elevation !== "" ? Number(r.elevation) : (idata.elevation != null && idata.elevation !== "" ? Number(idata.elevation) : "")),
            TOP_UND: isCalib ? "" : sanitizeText(meta.top_und || (Number(r.elevation || idata.elevation || 0) < 0 ? "SUBSEA" : "TOPSIDE")).substring(0, 8),
          };

          if (code === "ANS") {
            const rawIdNo = String(comp?.id_no || meta.id_no || idata.id_no || r.id_no || "").trim().toUpperCase();
            const idNoPrefix = rawIdNo.includes("/") ? rawIdNo.split("/")[0].trim() : "";
            const rawQid = String(comp?.q_id || meta.q_id || r.q_id || r.component_qid || idata.q_id || idata.component_qid || idata.component || "").trim().toUpperCase();
            const explicitCode = String(comp?.code || meta.code || meta.comp_code || idata.comp_code || idata.code || r.code || "").trim().toUpperCase();

            // Safety guard: If component is non-anode, skip this row!
            if ((explicitCode && explicitCode !== "AN") || (idNoPrefix && idNoPrefix !== "AN")) {
              return;
            }
            const isAnode = explicitCode === "AN" || idNoPrefix === "AN" || rawQid.startsWith("BAN") || rawQid.startsWith("LAN") || rawQid.startsWith("CAN") || rawQid.startsWith("TAN") || rawQid.startsWith("ANODE") || (rawQid.startsWith("AN") && !rawQid.startsWith("ANS"));
            if (!isAnode) {
              return;
            }

            baseRow.CODE = "AN";
            baseRow.INSPECTOR = "";
            baseRow.PROC = "";
            baseRow.EQUIP = "";
            baseRow.EQ_ID = "";
            baseRow.SPEC = "";
            baseRow.SURF_COND = "";
            baseRow.CLEAN_MET = "";
            baseRow.SCAF = "";

            baseRow.CP_RDG = idata.cp_rdg != null && idata.cp_rdg !== "" ? Number(idata.cp_rdg) : (idata.cp_reading != null && idata.cp_reading !== "" ? Number(idata.cp_reading) : (r.cp_rdg != null && r.cp_rdg !== "" ? Number(r.cp_rdg) : ""));
            baseRow.ANODE_OUTPUT = idata.anode_cp != null && idata.anode_cp !== "" ? toRoundNum(idata.anode_cp) : (idata.cp_rdg != null && idata.cp_rdg !== "" ? toRoundNum(idata.cp_rdg) : (idata.anode_output != null && idata.anode_output !== "" ? toRoundNum(idata.anode_output) : ""));
            baseRow.MG_THICK = idata.mg_thick != null && idata.mg_thick !== "" ? Number(idata.mg_thick) : (idata.marine_growth_thickness != null && idata.marine_growth_thickness !== "" ? Number(idata.marine_growth_thickness) : "");
            baseRow.MEMB_CP = idata.member_cp != null && idata.member_cp !== "" ? Number(idata.member_cp) : (idata.memb_cp != null && idata.memb_cp !== "" ? Number(idata.memb_cp) : "");
            baseRow.LENGTH = idata.anode_length != null && idata.anode_length !== "" ? Number(idata.anode_length) : (idata.length != null && idata.length !== "" ? Number(idata.length) : "");
            baseRow.CIRC_C1 = sanitizeText(idata.circumference_c1 ?? idata.circ_c1 ?? "").substring(0, 20);
            baseRow.CIRC_C2 = sanitizeText(idata.circumference_c2 ?? idata.circ_c2 ?? "").substring(0, 20);
            baseRow.CIRC_C3 = sanitizeText(idata.circumference_c3 ?? idata.circ_c3 ?? "").substring(0, 20);
            const rawAnodeType = sanitizeText(idata.anode_type ?? idata.type ?? comp?.metadata?.anode_type ?? comp?.metadata?.type ?? meta?.anode_type ?? meta?.type ?? "");
            const matchedAnodeTypeId = rawAnodeType
              ? (anodTypDescToId.get(rawAnodeType.toLowerCase()) || rawAnodeType)
              : "";
            baseRow.TYPE = sanitizeText(matchedAnodeTypeId).substring(0, 20);

            const rawSecured = idata.anode_secured_to_structure ?? idata.secured;
            const isSecured = rawSecured === true || String(rawSecured).trim().toUpperCase() === "YES" || String(rawSecured).trim().toUpperCase() === "TRUE";
            baseRow.SECURED = rawSecured != null && rawSecured !== "" ? (isSecured ? "YES" : "NO") : "";

            baseRow.DEPLETION = parseAnodeDepletion(idata.anode_depletion_percent ?? idata.anode_depletion ?? idata.depletion ?? comp?.metadata?.anode_depletion_percent ?? comp?.metadata?.anode_depletion ?? meta?.anode_depletion_percent ?? meta?.anode_depletion);
            baseRow.TOPSTUB_CP = idata.topstub_cp != null && idata.topstub_cp !== "" ? Number(idata.topstub_cp) : "";
            baseRow.BOTSTUB_CP = idata.bottomstub_cp != null && idata.bottomstub_cp !== "" ? Number(idata.bottomstub_cp) : (idata.botstub_cp != null && idata.botstub_cp !== "" ? Number(idata.botstub_cp) : "");
            baseRow.AVG_PIT = idata.avg_pitting_depth != null && idata.avg_pitting_depth !== "" ? Number(idata.avg_pitting_depth) : (idata.avg_pit != null && idata.avg_pit !== "" ? Number(idata.avg_pit) : "");
            baseRow.MAX_PIT = idata.max_pitting_dept != null && idata.max_pitting_dept !== "" ? Number(idata.max_pitting_dept) : (idata.max_pitting_depth != null && idata.max_pitting_depth !== "" ? Number(idata.max_pitting_depth) : (idata.max_pit != null && idata.max_pit !== "" ? Number(idata.max_pit) : ""));
            baseRow.AVG_DIA_PIT = idata.avg_pitting_diameter != null && idata.avg_pitting_diameter !== "" ? Number(idata.avg_pitting_diameter) : (idata.avg_dia_pit != null && idata.avg_dia_pit !== "" ? Number(idata.avg_dia_pit) : "");
            baseRow.MAX_DIA_PIT = idata.max_pitting_diameter != null && idata.max_pitting_diameter !== "" ? Number(idata.max_pitting_diameter) : (idata.max_dia_pit != null && idata.max_dia_pit !== "" ? Number(idata.max_dia_pit) : "");
          } else if (code === "CPS") {
            baseRow.INSPECTOR = "";
            baseRow.PROC = "";
            baseRow.EQUIP = "";
            baseRow.EQ_ID = "";
            baseRow.SPEC = "";
            baseRow.SURF_COND = sanitizeText(idata.surface_condition || idata.surf_cond || "").substring(0, 30);
            baseRow.CLEAN_MET = sanitizeText(idata.cleaning_method || idata.clean_met || "").substring(0, 20);
            baseRow.SCAF = "";
            baseRow.TOP_UND = sanitizeText(meta.top_und || (Number(r.elevation || idata.elevation || 0) < 0 ? "SUBSEA" : "TOPSIDE")).substring(0, 8);
            baseRow.CALIB_BLK = sanitizeText(idata.calib_block || idata.calib_blk || "");
            baseRow.PRE_DIV = toRoundNum(idata.pre_dive_cp ?? idata.pre_div);
            baseRow.IN_WATER1 = toRoundNum(idata.in_water1);
            baseRow.IN_WATER2 = toRoundNum(idata.in_water2);
            baseRow.IN_WATER3 = toRoundNum(idata.in_water3);
            baseRow.POST_DIVE = toRoundNum(idata.post_dive_cp ?? idata.post_dive);

            let cpInVal: any = "";
            const addCp = idata.cp_rdg_additional ?? idata.cp_additional ?? idata.additional_cp_readings ?? idata.cp_in;
            if (Array.isArray(addCp)) {
              const nums = addCp
                .map((item: any) => {
                  if (typeof item === "number") return item;
                  if (item && typeof item === "object") return Number(item.cp_reading ?? item.reading ?? item.val ?? item.value);
                  return Number(String(item).replace(/[^\d.-]/g, ""));
                })
                .filter((n: number) => !isNaN(n) && isFinite(n));
              if (nums.length > 0) {
                cpInVal = Math.max(...nums);
              }
            } else if (typeof addCp === "string" && addCp.includes(",")) {
              const nums = addCp
                .split(",")
                .map((s: string) => Number(s.trim().replace(/[^\d.-]/g, "")))
                .filter((n: number) => !isNaN(n) && isFinite(n));
              if (nums.length > 0) {
                cpInVal = Math.max(...nums);
              }
            } else if (addCp != null && addCp !== "") {
              const n = Number(String(addCp).replace(/[^\d.-]/g, ""));
              if (!isNaN(n) && isFinite(n)) {
                cpInVal = n;
              }
            }

            let cpOutVal: any = "";
            const rawCpOut = idata.member_cp ?? idata.cp_rdg ?? idata.cp_reading ?? idata.cp_out ?? r.cp_rdg;
            if (rawCpOut != null && rawCpOut !== "") {
              const n = Number(String(rawCpOut).replace(/[^\d.-]/g, ""));
              if (!isNaN(n) && isFinite(n)) {
                cpOutVal = n;
              }
            }

            baseRow.CP_IN = cpInVal !== "" ? Math.round(Number(cpInVal)) : "";
            baseRow.CP_OUT = cpOutVal !== "" ? Math.round(Number(cpOutVal)) : "";
          } else if (code === "GVS") {
            baseRow.INSPECTOR = "";
            baseRow.PROC = "";
            baseRow.EQUIP = "";
            baseRow.EQ_ID = "";
            baseRow.SPEC = "";
            baseRow.SURF_COND = "";
            baseRow.CLEAN_MET = "";
            baseRow.SCAF = (idata.scaffolding || r.scaf || idata.scaf) ? "Yes" : "";

            baseRow.COAT_COND = sanitizeText(idata.coating_condition || "").substring(0, 20);
            baseRow.COMP_COND = sanitizeText(idata.component_condition || "").substring(0, 20);

            const hard = idata.marine_growth_hard;
            const soft = idata.marine_growth_soft;
            let mgText = "";

            if (hard != null && hard !== "" && soft != null && soft !== "") {
              const hardStr = String(hard).trim();
              const softStr = String(soft).trim();
              if (hardStr === softStr) {
                mgText = `${hardStr}${hardStr.includes("%") ? "" : "%"} COVERAGE OF HARD AND SOFT GROWTH`;
              } else {
                mgText = `${hardStr}${hardStr.includes("%") ? "" : "%"} COVERAGE OF HARD GROWTH ${softStr}${softStr.includes("%") ? "" : "%"} COVERAGE OF SOFT GROWTH`;
              }
            } else if (hard != null && hard !== "") {
              const hardStr = String(hard).trim();
              mgText = `${hardStr}${hardStr.includes("%") ? "" : "%"} COVERAGE OF HARD GROWTH`;
            } else if (soft != null && soft !== "") {
              const softStr = String(soft).trim();
              mgText = `${softStr}${softStr.includes("%") ? "" : "%"} COVERAGE OF SOFT GROWTH`;
            } else if (idata.marine_growth_pct != null && idata.marine_growth_pct !== "") {
              mgText = `${idata.marine_growth_pct}% COVERAGE`;
            } else if (idata.marine_growth != null && idata.marine_growth !== "") {
              mgText = String(idata.marine_growth);
            }

            baseRow.MARINE_GROW = sanitizeText(mgText).substring(0, 60);
          } else if (code === "MGS") {
            const recTypeUpper = String(r.inspection_type_code || "").trim().toUpperCase();
            const itype = r.inspection_type_id ? inspTypeMapById.get(Number(r.inspection_type_id)) : null;
            const itypeCodeUpper = String(itype?.code || "").trim().toUpperCase();

            const isRovMarineGrowthAppend =
              recTypeUpper === "RMGI" ||
              recTypeUpper.includes("RMGI") ||
              itypeCodeUpper === "RMGI" ||
              itypeCodeUpper.includes("RMGI") ||
              Boolean(String(itype?.name || "").toUpperCase().includes("MARINE") && itype?.methods?.includes("ROV"));

            baseRow.INSPECTOR = "";
            baseRow.PROC = "";
            baseRow.EQUIP = "";
            baseRow.EQ_ID = "";
            baseRow.SPEC = "";
            baseRow.SURF_COND = "";
            baseRow.CLEAN_MET = "";
            baseRow.SCAF = "";

            const toNum = (val: any) => (val != null && val !== "" && !isNaN(Number(val)) ? Number(val) : "");
            const toRoundNum = (val: any) => (val != null && val !== "" && !isNaN(Number(val)) ? Math.round(Number(val)) : "");
            const toYesNo = (val: any) => {
              if (
                val === true ||
                val === "true" ||
                val === "True" ||
                val === "TRUE" ||
                val === "yes" ||
                val === "Yes" ||
                val === "YES" ||
                val === 1 ||
                val === "1"
              ) {
                return "YES";
              }
              return "NO";
            };

            baseRow.CP_RDG = toNum(idata.cp_rdg ?? idata.cp_reading ?? r.cp_rdg);
            baseRow.HARD_THK3 = toNum(idata.mgi_hard_thickness_at_3 ?? idata.hard_thk3 ?? idata.hard_thickness_at_3);
            baseRow.HARD_THK6 = toNum(idata.mgi_hard_thickness_at_6 ?? idata.hard_thk6 ?? idata.hard_thickness_at_6);
            baseRow.HARD_THK9 = toNum(idata.mgi_hard_thickness_at_9 ?? idata.hard_thk9 ?? idata.hard_thickness_at_9);
            baseRow.HARD_THK12 = toNum(idata.mgi_hard_thickness_at_12 ?? idata.hard_thk12 ?? idata.hard_thickness_at_12);
            baseRow.SOFT_THK3 = toNum(idata.mgi_soft_thickness_at_3 ?? idata.soft_thk3 ?? idata.soft_thickness_at_3);
            baseRow.SOFT_THK6 = toNum(idata.mgi_soft_thickness_at_6 ?? idata.soft_thk6 ?? idata.soft_thickness_at_6);
            baseRow.SOFT_THK9 = toNum(idata.mgi_soft_thickness_at_9 ?? idata.soft_thk9 ?? idata.soft_thickness_at_9);
            baseRow.SOFT_THK12 = toNum(idata.mgi_soft_thickness_at_12 ?? idata.soft_thk12 ?? idata.soft_thickness_at_12);
            const rawMgProf = idata.mgi_profile ?? r.mgi_profile ?? idata.max_allowable_thickness ?? idata.mg_profile ?? idata.profile ?? idata.mgi_limit ?? idata.max_allow;
            let resolvedMgProfile: any = "";

            if (rawMgProf != null && rawMgProf !== "") {
              const num = parseFloat(String(rawMgProf).replace(/[^\d.-]/g, ""));
              if (!isNaN(num)) {
                resolvedMgProfile = num;
              }
            }

            // Fallback: interpolate from record's linked profile or default active profile
            if (resolvedMgProfile === "" || resolvedMgProfile == null) {
              const profId = idata._mgi_profile_id || jp?.mgi_profile_id;
              const targetProf = (profId ? mgiProfileMapById.get(Number(profId)) : null) || defaultActiveMgiProfile;
              if (targetProf && targetProf.thresholds?.length > 0) {
                const vDepthRaw = idata.verification_depth || (meta.elv_1 != null ? meta.elv_1 : r.elevation) || 0;
                const vDepthUnit = idata.verification_depth_unit || "m";
                const waterDepth = Math.abs(Number(strObj?.water_depth || 0));
                const interpolated = calculateInterpolatedMgiThreshold(vDepthRaw, waterDepth, targetProf.thresholds, vDepthUnit);
                if (interpolated !== null && !isNaN(interpolated)) {
                  resolvedMgProfile = interpolated;
                }
              }
            }

            baseRow.MG_PROFILE = resolvedMgProfile !== "" ? Number(resolvedMgProfile) : "";

            if (isRovMarineGrowthAppend) {
              baseRow.HARD_GROWTH = parseGrowthPercent(idata.marine_growth_hard ?? idata.mgi_hard_growth ?? idata.hard_growth);
              baseRow.SOFT_GROWTH = parseGrowthPercent(idata.marine_growth_soft ?? idata.mgi_soft_growth ?? idata.soft_growth);
              baseRow.COATING_DAMAGE = "";
              baseRow.PHYSICAL_DAMAGE = "";
              baseRow.CIRCUM_PFIVE = "";
              baseRow.CIRCUM_NFIVE = "";
              baseRow.CIRCUM_ZERO = "";
              baseRow.NOM_DIA = "";
              baseRow.HARD_CIRCUM = "";
              baseRow.SOFT_CIRCUM = "";
              baseRow.GROWTH_CIRCUM = "";

              const hardThks = [
                idata.mgi_hard_thickness_at_12,
                idata.mgi_hard_thickness_at_9,
                idata.mgi_hard_thickness_at_6,
                idata.mgi_hard_thickness_at_3,
              ].filter((v) => v != null && v !== "" && !isNaN(Number(v))).map(Number);

              baseRow.EFF_THK = hardThks.length > 0 ? Math.max(...hardThks) : toNum(idata.effective_thickness ?? idata.eff_thk);
            } else {
              baseRow.HARD_GROWTH = parseGrowthPercent(idata.mgi_hard_growth ?? idata.hard_growth ?? idata.marine_growth_hard);
              baseRow.SOFT_GROWTH = parseGrowthPercent(idata.mgi_soft_growth ?? idata.soft_growth ?? idata.marine_growth_soft);
              baseRow.COATING_DAMAGE = toYesNo(idata.coating_damage);
              baseRow.PHYSICAL_DAMAGE = idata.physical_damage != null ? toYesNo(idata.physical_damage) : "";
              baseRow.CIRCUM_PFIVE = toNum(idata.circumferential_measurement_5m_above ?? idata.circum_pfive ?? idata.circumferential_measurement_p5);
              baseRow.CIRCUM_NFIVE = toNum(idata.circumferential_measurement_5m_below ?? idata.circum_nfive ?? idata.circumferential_measurement_n5);
              baseRow.CIRCUM_ZERO = toNum(idata.circumferential_measurement_0m ?? idata.circum_zero ?? idata.circumferential_measurement_0);
              baseRow.NOM_DIA = toNum(idata.nominal_diameter ?? idata.nom_dia);
              baseRow.HARD_CIRCUM = toYesNo(idata.hard_circum ?? idata.marine_growth_hard);
              baseRow.SOFT_CIRCUM = toYesNo(idata.soft_circum ?? idata.marine_growth_soft);
              baseRow.GROWTH_CIRCUM = toRoundNum(idata.growth_circum ?? idata.growth_percent ?? idata.growth_percentage ?? idata.marine_growth_pct);
              baseRow.EFF_THK = toNum(idata.effective_thickness ?? idata.eff_thk);
            }
          } else if (code === "SCS") {
            baseRow.INSPECTOR = "";
            baseRow.PROC = "";
            baseRow.EQUIP = "";
            baseRow.EQ_ID = "";
            baseRow.SPEC = "";
            baseRow.SURF_COND = "";
            baseRow.CLEAN_MET = "";
            baseRow.SCAF = "";

            const toNum = (val: any) => (val != null && val !== "" && !isNaN(Number(val)) ? Number(val) : "");
            const merged = (r as any)._scsMergedData || {};

            const cObj = comp;
            const cMeta = meta || comp?.metadata || {};
            const sLeg = String(cObj?.s_leg || cMeta.s_leg || cMeta.start_leg || "").trim().toUpperCase();
            const sNode = String(cObj?.s_node || cMeta.s_node || cMeta.start_node || "").trim().toUpperCase();
            const fLeg = String(cObj?.f_leg || cMeta.f_leg || cMeta.end_leg || "").trim().toUpperCase();
            const fNode = String(cObj?.f_node || cMeta.f_node || cMeta.end_node || "").trim().toUpperCase();

            const rawLoc = String(idata.scour_location || idata.scour_at_loc || idata.location || "").trim();
            const locUpper = rawLoc.toUpperCase();
            const cleanLoc = formatScourAtLoc(rawLoc);

            const isStartLoc = locUpper.includes("START") || locUpper.includes("LEG 1") || locUpper.includes("LEG1") || locUpper.includes("NODE 1") || locUpper.includes("NODE1") ||
                               Boolean(sLeg && (cleanLoc === sLeg || locUpper.includes(sLeg))) ||
                               Boolean(sNode && (cleanLoc === sNode || locUpper.includes(sNode)));

            const isEndLoc = locUpper.includes("END") || locUpper.includes("LEG 2") || locUpper.includes("LEG2") || locUpper.includes("NODE 2") || locUpper.includes("NODE2") ||
                             Boolean(fLeg && (cleanLoc === fLeg || locUpper.includes(fLeg))) ||
                             Boolean(fNode && (cleanLoc === fNode || locUpper.includes(fNode)));

            const rawExposed = idata.Exposed_pile ?? idata.exposed_pile ?? idata.pile_exposed;
            const isExpPile = rawExposed === true || rawExposed === "true" || String(rawExposed).trim().toUpperCase() === "YES" || rawExposed === 1 || rawExposed === "1";

            baseRow.FRAME_RDG = toNum(merged.frameRdgVal ?? idata.frame_rdg ?? idata.mud_mat_height);
            baseRow.BOTTM_RDG = toNum(merged.bottmRdgVal ?? idata.bottm_rdg ?? idata.bottom_reading);
            baseRow.SCOUR_RDG = toNum(merged.scourRdgVal ?? idata.scour_rdg ?? idata.scour_reading);
            baseRow.SCOUR_SIZE = sanitizeText(merged.scourSizeVal || idata.scour_size || "").substring(0, 20);
            baseRow.MID_POINT = toNum(merged.midPointVal ?? idata.mid_point ?? (locUpper.includes("MID") || cleanLoc === "MIDPOINT" ? idata.scour_depth : ""));
            baseRow.LEG1 = sanitizeText(merged.startLegVal || sLeg || idata.leg1 || idata.start_leg || "").substring(0, 20);
            baseRow.LEG2 = sanitizeText(merged.endLegVal || fLeg || idata.leg2 || idata.end_leg || "").substring(0, 20);
            baseRow.EXP_PILE_LEG1 = sanitizeText(merged.expPileLeg1Val || idata.exp_pile_leg1 || (isStartLoc && isExpPile ? "YES" : "NO")).substring(0, 3);
            baseRow.EXP_PILE_LEG2 = sanitizeText(merged.expPileLeg2Val || idata.exp_pile_leg2 || (isEndLoc && isExpPile ? "YES" : "NO")).substring(0, 3);
            baseRow.DEPTH1 = toNum(merged.depth1Val ?? idata.depth1 ?? (isStartLoc ? (idata.scour_depth ?? idata.depth) : ""));
            baseRow.DEPTH2 = toNum(merged.depth2Val ?? idata.depth2 ?? (isEndLoc ? (idata.scour_depth ?? idata.depth) : ""));
          } else if (code === "DBS") {
            const debrisCandidate = idata.debris ?? idata.debris_item ?? idata.item ?? idata.debris_type ?? idata.debris_name ?? idata.size_of_debris ?? idata.material ?? r.debris ?? r.item ?? r.debris_item;
            const debrisStr = debrisCandidate != null ? String(debrisCandidate).trim().toUpperCase() : "";
            const isInvalidDebrisStr = !debrisStr || ["NULL", "UNDEFINED", "NONE", "N/A", "NA", "N.A.", "NIL", "NO", "FALSE", "0"].includes(debrisStr);

            const hasDimensions = (idata.length_debris != null && idata.length_debris !== "" && Number(idata.length_debris) > 0) ||
                                  (idata.width_debris != null && idata.width_debris !== "" && Number(idata.width_debris) > 0) ||
                                  (idata.height_debris != null && idata.height_debris !== "" && Number(idata.height_debris) > 0);

            const hasDebrisOrItem = (!isInvalidDebrisStr) || hasDimensions || (idata.debris_present === true || String(idata.debris_present).toUpperCase() === "YES" || String(idata.debris_present).toUpperCase() === "TRUE");

            if (!hasDebrisOrItem) {
              return;
            }

            const recTypeUpper = String(r.inspection_type_code || "").trim().toUpperCase();
            const itype = r.inspection_type_id ? inspTypeMapById.get(Number(r.inspection_type_id)) : null;
            const itypeCodeUpper = String(itype?.code || "").trim().toUpperCase();

            const isRovDebrisAppend =
              recTypeUpper === "RGVI" ||
              recTypeUpper === "RRISI" ||
              recTypeUpper === "RCOND" ||
              recTypeUpper === "RCASN" ||
              recTypeUpper.includes("RGVI") ||
              recTypeUpper.includes("RRISI") ||
              recTypeUpper.includes("RCOND") ||
              recTypeUpper.includes("RCASN") ||
              itypeCodeUpper === "RGVI" ||
              itypeCodeUpper === "RRISI" ||
              itypeCodeUpper === "RCOND" ||
              itypeCodeUpper === "RCASN" ||
              itypeCodeUpper.includes("RGVI") ||
              itypeCodeUpper.includes("RRISI") ||
              itypeCodeUpper.includes("RCOND") ||
              itypeCodeUpper.includes("RCASN");

            baseRow.INSPECTOR = "";
            baseRow.PROC = "";
            baseRow.EQUIP = "";
            baseRow.EQ_ID = "";
            baseRow.SPEC = "";
            baseRow.SURF_COND = "";
            baseRow.CLEAN_MET = "";
            baseRow.SCAF = "";

            const toNum = (val: any) => (val != null && val !== "" && !isNaN(Number(val)) ? Number(val) : "");
            const toRoundNum = (val: any) => (val != null && val !== "" && !isNaN(Number(val)) ? Math.round(Number(val)) : "");
            const toYesNo = (val: any) => {
              if (
                val === true ||
                val === "true" ||
                val === "True" ||
                val === "TRUE" ||
                val === "yes" ||
                val === "Yes" ||
                val === "YES" ||
                val === 1 ||
                val === "1"
              ) {
                return "YES";
              }
              return "NO";
            };

            baseRow.CP_RDG = idata.cp_rdg != null && idata.cp_rdg !== ""
              ? Number(idata.cp_rdg)
              : (idata.cp_reading != null && idata.cp_reading !== ""
                ? Number(idata.cp_reading)
                : (r.cp_rdg != null && r.cp_rdg !== "" ? Number(r.cp_rdg) : ""));

            let resolvedItem = sanitizeText(idata.debris_item || idata.debris || idata.item || idata.debris_name || idata.debris_type || idata.material || r.item || r.debris || "").substring(0, 20);
            if (!resolvedItem && hasDimensions) {
              resolvedItem = "DEBRIS";
            }

            if (isRovDebrisAppend) {
              baseRow.SIDE = "";
              baseRow.DISTANC = "";
              baseRow.CP_CURR = "";
              baseRow.DAMAGE = "";
              baseRow.REMOVED = "";
              baseRow.LENGTH = "";
              baseRow.HEIGHT = "";
              baseRow.WIDTH = "";
              baseRow.ITEM = resolvedItem;
              baseRow.SIZE = "";
              baseRow.ASSESSMENT = "";
            } else {
              baseRow.SIDE = sanitizeText(idata.side_facing || idata.side || "").substring(0, 20);
              baseRow.DISTANC = toNum(idata.distance_debris ?? idata.distanc ?? idata.distance);
              baseRow.CP_CURR = toYesNo(idata.db_cp_pulled ?? idata.cp_curr);
              baseRow.DAMAGE = toYesNo(idata.damage_caused ?? idata.damage);
              baseRow.REMOVED = toYesNo(idata.debris_removed ?? idata.removed);
              baseRow.LENGTH = toRoundNum(idata.length_debris ?? idata.length);
              baseRow.HEIGHT = toRoundNum(idata.height_debris ?? idata.height);
              baseRow.WIDTH = toRoundNum(idata.width_debris ?? idata.width);
              baseRow.ITEM = resolvedItem;
              baseRow.SIZE = sanitizeText(idata.size_of_debris || idata.size || "").substring(0, 20);
              baseRow.ASSESSMENT = sanitizeText(idata.assessment || "").substring(0, 60);
            }
          } else if (code === "FDS") {
            const recTypeUpper = String(r.inspection_type_code || "").trim().toUpperCase();
            const itype = r.inspection_type_id ? inspTypeMapById.get(Number(r.inspection_type_id)) : null;
            const itypeCodeUpper = String(itype?.code || "").trim().toUpperCase();
            const itypeNameUpper = String(itype?.name || "").trim().toUpperCase();

            const isRfmdRec =
              recTypeUpper === "RFMD" ||
              recTypeUpper.includes("RFMD") ||
              recTypeUpper.includes("ROVFMD") ||
              itypeCodeUpper === "RFMD" ||
              itypeCodeUpper.includes("RFMD") ||
              idata.member_status !== undefined;

            baseRow.INSPECTOR = "";
            baseRow.PROC = "";
            baseRow.EQUIP = "";
            baseRow.EQ_ID = "";
            baseRow.SPEC = "";
            baseRow.SURF_COND = "";
            baseRow.CLEAN_MET = "";
            baseRow.SCAF = "";

            if (isRfmdRec) {
              const memStatus = String(idata.member_status || "").trim().toUpperCase();
              baseRow.FLOODED = (memStatus === "FLOODED" || memStatus === "YES" || memStatus === "TRUE") ? "YES" : "NO";
            } else {
              const toBoolYesNo = (val: any) => {
                if (
                  val === true ||
                  val === "true" ||
                  val === "True" ||
                  val === "TRUE" ||
                  val === "yes" ||
                  val === "Yes" ||
                  val === "YES" ||
                  val === 1 ||
                  val === "1"
                ) {
                  return "YES";
                }
                return "NO";
              };

              const floodVal = idata.flooded ?? idata.is_flooded ?? (idata.member_status ? (String(idata.member_status).toUpperCase().includes("FLOOD") ? "YES" : "NO") : undefined);
              baseRow.FLOODED = toBoolYesNo(floodVal);
            }
          } else if (code === "UTS") {
            const toNum = (val: any) => (val != null && val !== "" && !isNaN(Number(val)) ? Number(val) : "");

            const recTypeUpper = String(r.inspection_type_code || "").trim().toUpperCase();
            const itype = r.inspection_type_id ? inspTypeMapById.get(Number(r.inspection_type_id)) : null;
            const itypeCodeUpper = String(itype?.code || "").trim().toUpperCase();
            const itypeNameUpper = String(itype?.name || "").trim().toUpperCase();

            const isSzoneRec =
              recTypeUpper === "SZONE" ||
              recTypeUpper === "SZS" ||
              recTypeUpper.includes("SZONE") ||
              recTypeUpper.includes("SPLASH") ||
              itypeCodeUpper === "SZONE" ||
              itypeCodeUpper === "SZS" ||
              itypeCodeUpper.includes("SZONE") ||
              itypeNameUpper.includes("SPLASH");

            if (isSzoneRec) {
              baseRow.INSPECTOR = "";
              baseRow.PROC = "";
              baseRow.EQUIP = "";
              baseRow.EQ_ID = "";
              baseRow.SPEC = "";
              baseRow.SURF_COND = "";
              baseRow.CLEAN_MET = "";
              baseRow.SCAF = "";
              baseRow.SUPV = sanitizeText(dj?.dive_supervisor || dj?.supervisor || idata.supervisor || "").substring(0, 20);
              baseRow.DIVR = sanitizeText(dj?.diver_name || idata.diver_name || idata.diver || "").substring(0, 20);
              baseRow.DIVE_NO = sanitizeText(resolvedDiveNo).substring(0, 10);
              baseRow.ELEVATION = r.elevation != null && r.elevation !== "" ? Number(r.elevation) : (idata.elevation != null && idata.elevation !== "" ? Number(idata.elevation) : "");
              baseRow.TOP_UND = sanitizeText(meta.top_und || (Number(r.elevation || idata.elevation || 0) < 0 ? "SUBSEA" : "TOPSIDE")).substring(0, 8);

              baseRow.PROB_TYPE = "";
              baseRow.PROB_SIZE_DIAM = "";
              baseRow.SCAN_TECH = "";
              baseRow.COUPLANT = "";
              baseRow.CALIB_BLK = "";
              baseRow.CALIB_RANGE = "";
              baseRow.CALIB_DATE = "";
              baseRow.PROB_FREQ = "";
              baseRow.SENS_LVL = "";
              baseRow.AREA_TEST = "";
              baseRow.REF_POS = "";

              const nomThk = toNum(idata.nominal_thickness ?? idata.comp_wall_thk);
              baseRow.COMP_WALL_THK = nomThk;

              const c3 = toNum(idata.ut_3_o_clock ?? idata.c03);
              const c6 = toNum(idata.ut_6_o_clock ?? idata.c06);
              const c9 = toNum(idata.ut_9_o_clock ?? idata.c09);
              const c12 = toNum(idata.ut_12_o_clock ?? idata.c12);

              const clockReadings = [c3, c6, c9, c12].filter((v): v is number => typeof v === "number" && !isNaN(v));

              const maxThk = clockReadings.length > 0 ? Math.max(...clockReadings) : "";
              const minThk = clockReadings.length > 0 ? Math.min(...clockReadings) : "";
              const avgThk = clockReadings.length > 0 ? Number((clockReadings.reduce((a, b) => a + b, 0) / clockReadings.length).toFixed(3)) : "";
              const wallLoss = (typeof nomThk === "number" && typeof minThk === "number") ? Number((nomThk - minThk).toFixed(3)) : "";

              baseRow.MAX_THK = maxThk;
              baseRow.MIN_THK = minThk;
              baseRow.AVG_THK = avgThk;
              baseRow.WALL_THK_LOSS = wallLoss;
              baseRow.CORR_RATE = "";
              baseRow.NO_READINGS = "";

              baseRow.C01 = "";
              baseRow.C02 = "";
              baseRow.C03 = c3;
              baseRow.C04 = "";
              baseRow.C05 = "";
              baseRow.C06 = c6;
              baseRow.C07 = "";
              baseRow.C08 = "";
              baseRow.C09 = c9;
              baseRow.C10 = "";
              baseRow.C11 = "";
              baseRow.C12 = c12;

              baseRow.REF_NAME = "";
              baseRow.POSITION = "";
              baseRow.READ_THICK = "";
            } else {
              baseRow.PROB_TYPE = sanitizeText(idata.probe_type || idata.probe || idata.prob_type || "").substring(0, 20);
              baseRow.PROB_SIZE_DIAM = toNum(idata.probe_size_diam ?? idata.probe_size ?? idata.prob_size_diam);
              baseRow.SCAN_TECH = sanitizeText(idata.scan_type || idata.scan_tech || "").substring(0, 20);
              baseRow.COUPLANT = sanitizeText(idata.couplant || "").substring(0, 20);
              baseRow.CALIB_BLK = sanitizeText(idata.calib_block || idata.calib_blk || "").substring(0, 20);
              baseRow.CALIB_RANGE = sanitizeText(idata.calib_range || "").substring(0, 20);
              baseRow.CALIB_DATE = formatDateStr(idata.calib_date);
              baseRow.PROB_FREQ = toNum(idata.probe_frequency ?? idata.prob_freq);
              baseRow.SENS_LVL = sanitizeText(idata.sensitivity_level || idata.sens_lvl || "").substring(0, 20);
              baseRow.AREA_TEST = sanitizeText(idata.size_of_area_tested || idata.area_test || idata.area_tested || "").substring(0, 20);
              baseRow.REF_POS = sanitizeText(idata.ref_pos || "").substring(0, 20);
              baseRow.COMP_WALL_THK = toNum(idata.nominal_thickness ?? idata.comp_wall_thk);
              baseRow.MAX_THK = toNum(idata.max_reading ?? idata.max_thk);
              baseRow.MIN_THK = toNum(idata.min_reading ?? idata.min_thk);
              baseRow.AVG_THK = toNum(idata.avg_reading ?? idata.avg_thk);
              baseRow.WALL_THK_LOSS = toNum(idata.wall_thickness_loss ?? idata.wall_thk_loss);
              baseRow.CORR_RATE = toNum(idata.corr_rate ?? idata.corrosion_rate);

              const clockReadings = [idata.ut_3_o_clock, idata.ut_6_o_clock, idata.ut_9_o_clock, idata.ut_12_o_clock];
              const validCount = clockReadings.filter((v: any) => v !== null && v !== undefined && v !== "" && !isNaN(Number(v))).length;
              baseRow.NO_READINGS = validCount > 0 ? validCount : (idata.no_readings != null && idata.no_readings !== "" && !isNaN(Number(idata.no_readings)) ? Number(idata.no_readings) : "");

              baseRow.C01 = toNum(idata.c01);
              baseRow.C02 = toNum(idata.c02);
              baseRow.C03 = toNum(idata.ut_3_o_clock ?? idata.c03);
              baseRow.C04 = toNum(idata.c04);
              baseRow.C05 = toNum(idata.c05);
              baseRow.C06 = toNum(idata.ut_6_o_clock ?? idata.c06);
              baseRow.C07 = toNum(idata.c07);
              baseRow.C08 = toNum(idata.c08);
              baseRow.C09 = toNum(idata.ut_9_o_clock ?? idata.c09);
              baseRow.C10 = toNum(idata.c10);
              baseRow.C11 = toNum(idata.c11);
              baseRow.C12 = toNum(idata.ut_12_o_clock ?? idata.c12);
              baseRow.REF_NAME = sanitizeText(idata.ref_name || "").substring(0, 20);
              baseRow.POSITION = sanitizeText(idata.reference_point_position || idata.position || "").substring(0, 20);
              baseRow.READ_THICK = toNum(idata.read_thick ?? idata.read_thickness);
            }
          } else if (code === "UCS") {
            baseRow.PROBE = sanitizeText(idata.probe || idata.probe_type || "");
            baseRow.PROBE_SIZE = sanitizeText(idata.probe_size || idata.probe_dia || idata.size || "");
            baseRow.CLB_TYPE = sanitizeText(idata.clb_type || idata.calib_equipment_type || idata.calib_type || "");
            baseRow.PROBE_FQ = sanitizeText(idata.probe_frequency || idata.probe_fq || idata.frequency || "");
            baseRow.RDG_1 = idata.reading01 != null && idata.reading01 !== "" ? Number(idata.reading01) : (idata.rdg_1 != null && idata.rdg_1 !== "" ? Number(idata.rdg_1) : (idata.reading_1 != null && idata.reading_1 !== "" ? Number(idata.reading_1) : ""));
            baseRow.RDG_2 = idata.reading02 != null && idata.reading02 !== "" ? Number(idata.reading02) : (idata.rdg_2 != null && idata.rdg_2 !== "" ? Number(idata.rdg_2) : (idata.reading_2 != null && idata.reading_2 !== "" ? Number(idata.reading_2) : ""));
            baseRow.RDG_3 = idata.reading03 != null && idata.reading03 !== "" ? Number(idata.reading03) : (idata.rdg_3 != null && idata.rdg_3 !== "" ? Number(idata.rdg_3) : (idata.reading_3 != null && idata.reading_3 !== "" ? Number(idata.reading_3) : ""));
            baseRow.RDG_4 = idata.reading04 != null && idata.reading04 !== "" ? Number(idata.reading04) : (idata.rdg_4 != null && idata.rdg_4 !== "" ? Number(idata.rdg_4) : (idata.reading_4 != null && idata.reading_4 !== "" ? Number(idata.reading_4) : ""));
            baseRow.RDG_5 = idata.reading05 != null && idata.reading05 !== "" ? Number(idata.reading05) : (idata.rdg_5 != null && idata.rdg_5 !== "" ? Number(idata.rdg_5) : (idata.reading_5 != null && idata.reading_5 !== "" ? Number(idata.reading_5) : ""));
            baseRow.RDG_6 = idata.reading06 != null && idata.reading06 !== "" ? Number(idata.reading06) : (idata.rdg_6 != null && idata.rdg_6 !== "" ? Number(idata.rdg_6) : (idata.reading_6 != null && idata.reading_6 !== "" ? Number(idata.reading_6) : ""));
            baseRow.LBL_1 = sanitizeText(idata.label01 || idata.lbl_1 || idata.label_1 || idata.lbl1 || "");
            baseRow.LBL_2 = sanitizeText(idata.label02 || idata.lbl_2 || idata.label_2 || idata.lbl2 || "");
            baseRow.LBL_3 = sanitizeText(idata.label03 || idata.lbl_3 || idata.label_3 || idata.lbl3 || "");
            baseRow.LBL_4 = sanitizeText(idata.label04 || idata.lbl_4 || idata.label_4 || idata.lbl4 || "");
            baseRow.LBL_5 = sanitizeText(idata.label05 || idata.lbl_5 || idata.label_5 || idata.lbl5 || "");
            baseRow.LBL_6 = sanitizeText(idata.label06 || idata.lbl_6 || idata.label_6 || idata.lbl6 || "");
          } else if (code === "CCS") {
            baseRow.INSPECTOR = "";
            baseRow.PROC = "";
            baseRow.EQUIP = "";
            baseRow.EQ_ID = "";
            baseRow.SPEC = "";
            baseRow.SURF_COND = "";
            baseRow.CLEAN_MET = "";
            baseRow.SCAF = "";
            baseRow.ELEVATION = "";
            baseRow.TOP_UND = "";

            const toNum = (val: any) => (val != null && val !== "" && !isNaN(Number(val)) ? Number(val) : "");

            baseRow.CLB_BLOCK = sanitizeText(idata.calib_block || idata.clb_block || "").substring(0, 20);
            baseRow.PRE_DIVE = toNum(idata.pre_dive_cp_rdg ?? idata.pre_dive ?? idata.pre_dive_cp);
            baseRow.IN_WATER1 = toNum(idata.in_water1 ?? idata.in_water_1);
            baseRow.IN_WATER2 = toNum(idata.in_water2 ?? idata.in_water_2);
            baseRow.IN_WATER3 = toNum(idata.in_water3 ?? idata.in_water_3);
            baseRow.POST_DIVE = toNum(idata.post_dive_cp_rdg ?? idata.post_dive ?? idata.post_dive_cp);
          } else if (code === "ITS") {
            baseRow.CP_RDG = idata.cp_rdg != null && idata.cp_rdg !== ""
              ? Number(idata.cp_rdg)
              : (idata.cp_reading != null && idata.cp_reading !== ""
                ? Number(idata.cp_reading)
                : (r.cp_rdg != null && r.cp_rdg !== "" ? Number(r.cp_rdg) : ""));
            baseRow.ITEM_TYPE = sanitizeText(idata.item_type || idata.itemType || idata.item_typ || "").substring(0, 20);
            baseRow.INSPDESC = sanitizeText(idata.description || idata.item_description || idata.desc || r.description || "").substring(0, 35);
          } else if (code === "SZS") {
            baseRow.CP_RDG = idata.cp_rdg != null && idata.cp_rdg !== ""
              ? Number(idata.cp_rdg)
              : (idata.cp_reading != null && idata.cp_reading !== ""
                ? Number(idata.cp_reading)
                : (r.cp_rdg != null && r.cp_rdg !== "" ? Number(r.cp_rdg) : ""));
            baseRow.ASSESS = sanitizeText(idata.assess || idata.assessment || "");
            baseRow.C01 = idata.c01 != null && idata.c01 !== "" ? Number(idata.c01) : "";
            baseRow.C02 = idata.c02 != null && idata.c02 !== "" ? Number(idata.c02) : "";
            baseRow.C03 = idata.ut_3_o_clock != null && idata.ut_3_o_clock !== "" ? Number(idata.ut_3_o_clock) : (idata.c03 != null && idata.c03 !== "" ? Number(idata.c03) : "");
            baseRow.C04 = idata.c04 != null && idata.c04 !== "" ? Number(idata.c04) : "";
            baseRow.C05 = idata.c05 != null && idata.c05 !== "" ? Number(idata.c05) : "";
            baseRow.C06 = idata.ut_6_o_clock != null && idata.ut_6_o_clock !== "" ? Number(idata.ut_6_o_clock) : (idata.c06 != null && idata.c06 !== "" ? Number(idata.c06) : "");
            baseRow.C07 = idata.c07 != null && idata.c07 !== "" ? Number(idata.c07) : "";
            baseRow.C08 = idata.c08 != null && idata.c08 !== "" ? Number(idata.c08) : "";
            baseRow.C09 = idata.ut_9_o_clock != null && idata.ut_9_o_clock !== "" ? Number(idata.ut_9_o_clock) : (idata.c09 != null && idata.c09 !== "" ? Number(idata.c09) : "");
            baseRow.C10 = idata.c10 != null && idata.c10 !== "" ? Number(idata.c10) : "";
            baseRow.C11 = idata.c11 != null && idata.c11 !== "" ? Number(idata.c11) : "";
            baseRow.C12 = idata.ut_12_o_clock != null && idata.ut_12_o_clock !== "" ? Number(idata.ut_12_o_clock) : (idata.c12 != null && idata.c12 !== "" ? Number(idata.c12) : "");
            baseRow.NOM_THK = idata.nominal_thick != null && idata.nominal_thick !== "" ? Number(idata.nominal_thick) : (idata.nominal_thickness != null && idata.nominal_thickness !== "" ? Number(idata.nominal_thickness) : "");
            baseRow.COAT_COVERAGE = idata.coating_coverage_percent != null && idata.coating_coverage_percent !== "" ? Number(idata.coating_coverage_percent) : (idata.coat_coverage != null && idata.coat_coverage !== "" ? Number(idata.coat_coverage) : "");
          } else if (code === "AFS") {
            baseRow.INSPECTOR = sanitizeText(r.inspector || idata.inspector || "").substring(0, 20);
            baseRow.PROC = sanitizeText(r.procedure || idata.procedure || idata.proc || "").substring(0, 20);
            baseRow.EQUIP = sanitizeText(r.equipment || idata.equipment || idata.calib_equipment_type || idata.equip || "").substring(0, 20);
            baseRow.EQ_ID = sanitizeText(r.equipment_id || idata.equipment_id || idata.serial_number || idata.eq_id || "").substring(0, 20);
            baseRow.SPEC = sanitizeText(r.spec || idata.spec || idata.specification || "").substring(0, 20);
            baseRow.SURF_COND = sanitizeText(r.surf_cond || idata.surface_condition || idata.surf_cond || "").substring(0, 30);
            baseRow.CLEAN_MET = sanitizeText(r.clean_met || idata.cleaning_method || idata.clean_met || "").substring(0, 20);
            baseRow.SCAF = (idata.scaffolding || r.scaf || idata.scaf) ? "Yes" : "";
            baseRow.FILE_NAME = sanitizeText(idata.file_name || idata.filename || "").substring(0, 20);
            baseRow.PROB_NO = sanitizeText(idata.probe_fl || idata.prob_no || idata.probe_no || "").substring(0, 20);
            baseRow.ORIENTATION = sanitizeText(idata.orientation || "").substring(0, 20);
            baseRow.DIRECTION_TRAVL = sanitizeText(idata.direction_travl || idata.direction_travel || idata.dir_travel || "").substring(0, 20);
            baseRow.CLCK_POS = sanitizeText(idata.clk_pos || idata.clck_pos || idata.clock_pos || "").substring(0, 20);
            baseRow.OPERATOR = sanitizeText(idata.operator || r.operator || "").substring(0, 20);
            baseRow.PROBE_FL = sanitizeText(idata.probe_flow || idata.probe_fl || "").substring(0, 20);
            baseRow.CWB = sanitizeText(idata.chord_weld_brace || idata.cwb || "").substring(0, 20);
            baseRow.PAGE = idata.acfmc_page != null && idata.acfmc_page !== ""
              ? Number(idata.acfmc_page)
              : (idata.page != null && idata.page !== "" ? Number(idata.page) : "");
            baseRow.REPORT = sanitizeText(idata.report || idata.report_no || "").substring(0, 30);
            baseRow.C_WALL_THK3 = idata.chord_thick_3clk != null && idata.chord_thick_3clk !== ""
              ? Number(idata.chord_thick_3clk)
              : (idata.c_wall_thk3 != null && idata.c_wall_thk3 !== "" ? Number(idata.c_wall_thk3) : "");
            baseRow.C_WALL_THK6 = idata.chord_thick_6clk != null && idata.chord_thick_6clk !== ""
              ? Number(idata.chord_thick_6clk)
              : (idata.c_wall_thk6 != null && idata.c_wall_thk6 !== "" ? Number(idata.c_wall_thk6) : "");
            baseRow.C_WALL_THK9 = idata.chord_thick_9clk != null && idata.chord_thick_9clk !== ""
              ? Number(idata.chord_thick_9clk)
              : (idata.c_wall_thk9 != null && idata.c_wall_thk9 !== "" ? Number(idata.c_wall_thk9) : "");
            baseRow.C_WALL_THK12 = idata.chord_thick_12clk != null && idata.chord_thick_12clk !== ""
              ? Number(idata.chord_thick_12clk)
              : (idata.c_wall_thk12 != null && idata.c_wall_thk12 !== "" ? Number(idata.c_wall_thk12) : "");
            baseRow.B_WALL_THK3 = idata.brace_thick_3clk != null && idata.brace_thick_3clk !== ""
              ? Number(idata.brace_thick_3clk)
              : (idata.b_wall_thk3 != null && idata.b_wall_thk3 !== "" ? Number(idata.b_wall_thk3) : "");
            baseRow.B_WALL_THK6 = idata.brace_thick_6clk != null && idata.brace_thick_6clk !== ""
              ? Number(idata.brace_thick_6clk)
              : (idata.b_wall_thk6 != null && idata.b_wall_thk6 !== "" ? Number(idata.b_wall_thk6) : "");
            baseRow.B_WALL_THK9 = idata.brace_thick_9clk != null && idata.brace_thick_9clk !== ""
              ? Number(idata.brace_thick_9clk)
              : (idata.b_wall_thk9 != null && idata.b_wall_thk9 !== "" ? Number(idata.b_wall_thk9) : "");
            baseRow.B_WALL_THK12 = idata.brace_thick_12clk != null && idata.brace_thick_12clk !== ""
              ? Number(idata.brace_thick_12clk)
              : (idata.b_wall_thk12 != null && idata.b_wall_thk12 !== "" ? Number(idata.b_wall_thk12) : "");
          } else if (code === "CVS") {
            baseRow.INSPECTOR = sanitizeText(r.inspector || idata.inspector || "").substring(0, 20);
            baseRow.PROC = sanitizeText(r.procedure || idata.procedure || idata.proc || "").substring(0, 20);
            baseRow.EQUIP = sanitizeText(r.equipment || idata.equipment || idata.equip || "").substring(0, 20);
            baseRow.EQ_ID = sanitizeText(r.equipment_id || idata.equipment_id || idata.eq_id || "").substring(0, 20);
            baseRow.SPEC = sanitizeText(r.spec || idata.spec || idata.specification || "").substring(0, 20);
            baseRow.SURF_COND = sanitizeText(idata.surface_condition || r.surf_cond || idata.surf_cond || "").substring(0, 30);
            baseRow.CLEAN_MET = sanitizeText(idata.cleaning_method || r.clean_met || idata.clean_met || "").substring(0, 20);
            baseRow.SCAF = (idata.scaffolding || r.scaf) ? "Yes" : "";
            baseRow.LIGHT_METHOD = sanitizeText(idata.lighting_method || idata.light_method || "").substring(0, 20);
            baseRow.LENGTH = idata.length != null && idata.length !== "" ? Number(idata.length) : "";
            baseRow.WIDTH = idata.width != null && idata.width !== "" ? Number(idata.width) : "";
          } else if (code === "BSS") {
            baseRow.INSPECTOR = "";
            baseRow.PROC = "";
            baseRow.EQUIP = "";
            baseRow.EQ_ID = "";
            baseRow.SPEC = "";
            baseRow.SURF_COND = "";
            baseRow.CLEAN_MET = "";
            baseRow.SCAF = "";

            const toNum = (val: any) => (val != null && val !== "" && !isNaN(Number(val)) ? Number(val) : "");
            const toBoolYesNo = (val: any) => {
              if (
                val === null ||
                val === undefined ||
                val === "" ||
                val === false ||
                val === "false" ||
                val === "False" ||
                val === "FALSE" ||
                val === "no" ||
                val === "No" ||
                val === "NO" ||
                val === 0 ||
                val === "0"
              ) {
                return "NO";
              }
              return "YES";
            };

            baseRow.NO_BOLTS_PRES_MEMB = toNum(idata.no_bolts_pres_memb ?? idata.no_bolts_pres_member);
            baseRow.NO_BOLTS_LOSE_MEMB = toNum(idata.no_bolts_loose_memb ?? idata.no_bolts_lose_memb ?? idata.no_bolts_loose_member);
            baseRow.NO_BOLTS_MIS_MEMB = toNum(idata.no_bolts_miss_memb ?? idata.no_bolts_mis_memb ?? idata.no_bolts_missing_member);
            baseRow.LINER_MEMB = toBoolYesNo(idata.liner_present_member_end ?? idata.liner_memb);
            baseRow.LINER_COMP = toBoolYesNo(idata.liner_present_component_end ?? idata.liner_comp);
            baseRow.CLMP_COATING = toBoolYesNo(idata.clamp_coating_satisfactory ?? idata.clmp_coating);
            baseRow.EARTHWIRE_BOLT = toBoolYesNo(idata.earthing_wire_or_bolt_present ?? idata.earthwire_bolt);
            baseRow.BOLTS_NUTTED = toBoolYesNo(idata.all_bolts_double_nutted ?? idata.bolts_nutted);
            baseRow.WASHER_PRES = toBoolYesNo(idata.washers_present_all_bolts ?? idata.washer_pres);
            baseRow.GAP_TOP_MEMB = toNum(idata.max_gap_top_member ?? idata.gap_top_memb);
            baseRow.GAP_BOT_MEMB = toNum(idata.max_gap_bottom_member ?? idata.gap_bot_memb);
            baseRow.GAP_TOP_COMP = toNum(idata.max_gap_top_brace ?? idata.gap_top_comp);
            baseRow.GAP_BOT_COMP = toNum(idata.max_gap_bottom_brace ?? idata.gap_bot_comp);
            baseRow.FLNG_MEMB = toNum(idata.max_flange_misalign_member ?? idata.flng_memb);
            baseRow.FLNG_COMP = toNum(idata.max_flange_misalign_brace ?? idata.flng_comp);
            baseRow.NO_BOLTS_PRES_COMP = toNum(idata.no_bolts_pres_brace ?? idata.no_bolts_pres_comp);
            baseRow.NO_BOLTS_LOSE_COMP = toNum(idata.no_bolts_loose_brace ?? idata.no_bolts_lose_comp);
            baseRow.NO_BOLTS_MIS_COMP = toNum(idata.no_bolts_miss_brace ?? idata.no_bolts_mis_comp);
            baseRow.RISER_CP = toNum(idata.appurtenance_cp ?? idata.riser_cp);
            baseRow.RISER_CLMP_CP = toNum(idata.appurtenance_clamp_cp ?? idata.riser_clmp_cp);
            baseRow.STUB_CP = toNum(idata.stub_cp ?? idata.appurtenance_clamp_cp);
            baseRow.MEMB_CLMP_CP = toNum(idata.member_clamp_cp ?? idata.memb_clmp_cp);
            baseRow.MEMB_CP = toNum(idata.member_cp ?? idata.memb_cp);
            baseRow.RSR_CLMP_TYPE = sanitizeText(idata.appurtenance_clamp_type ?? idata.rsr_clmp_type ?? idata.clamp_type ?? "").substring(0, 20);
          } else if (code === "RSS") {
            baseRow.INSPECTOR = "";
            baseRow.PROC = "";
            baseRow.EQUIP = "";
            baseRow.EQ_ID = "";
            baseRow.SPEC = "";
            baseRow.SURF_COND = "";
            baseRow.CLEAN_MET = "";
            baseRow.SCAF = "";

            const toNum = (val: any) => (val != null && val !== "" && !isNaN(Number(val)) ? Number(val) : "");
            const toBoolYesNo = (val: any) => {
              if (
                val === null ||
                val === undefined ||
                val === "" ||
                val === false ||
                val === "false" ||
                val === "False" ||
                val === "FALSE" ||
                val === "no" ||
                val === "No" ||
                val === "NO" ||
                val === 0 ||
                val === "0"
              ) {
                return "NO";
              }
              return "YES";
            };

            baseRow.CP_RDG = toNum(idata.cp_rdg ?? idata.cp_reading ?? r.cp_rdg);
            baseRow.RISER_PRES = toBoolYesNo(idata.riser_present ?? idata.riser_pres);
            baseRow.TYPE = sanitizeText(idata.type || idata.riser_type || "").substring(0, 20);
            baseRow.DIAMETER = toNum(idata.diameter || idata.pipe_dia);
            baseRow.WALL_THK = toNum(idata.wall_thickness ?? idata.wall_thk ?? idata.nominal_thickness);
            baseRow.COAT_TYP = sanitizeText(idata.coating_type || idata.coat_typ || "").substring(0, 20);

            let mgVal = "";
            if (idata.marine_growth_soft !== undefined || idata.marine_growth_hard !== undefined) {
              const mgSoft = Number(idata.marine_growth_soft);
              const mgHard = Number(idata.marine_growth_hard);
              if (!isNaN(mgSoft) && !isNaN(mgHard)) {
                mgVal = String(mgSoft + mgHard);
              } else if (!isNaN(mgSoft)) {
                mgVal = String(mgSoft);
              } else if (!isNaN(mgHard)) {
                mgVal = String(mgHard);
              } else {
                mgVal = `${idata.marine_growth_soft || ""} ${idata.marine_growth_hard || ""}`.trim();
              }
            } else if (idata.mg !== undefined) {
              mgVal = String(idata.mg);
            }
            baseRow.MG = sanitizeText(mgVal).substring(0, 25);

            baseRow.BOTTM_HT = toNum(idata.span_height ?? idata.bottm_ht);
            baseRow.ELEV_BOTTM = toNum(idata.riserbend_elevation ?? idata.elev_bottm);
            baseRow.KNEE_BRACE = toBoolYesNo(idata.knee_brace);
            baseRow.SUPP_BEAM = toBoolYesNo(idata.supp_beam ?? idata.support_beam);
            baseRow.GUARD = toBoolYesNo(idata.guard ?? idata.riser_guard);
            baseRow.PHYS_DMG = toBoolYesNo(idata.phys_dmg ?? idata.physical_damage);
            baseRow.COAT_DMG = toBoolYesNo(idata.coat_dmg ?? idata.coating_damage);
            baseRow.CLAMP_QID = sanitizeText(idata.clamp_qid || "").substring(0, 25);
            baseRow.ON = sanitizeText(idata.on || "").substring(0, 1);
            baseRow.NO_BOLTS = toNum(idata.no_bolts);
            baseRow.NO_NUTS = toNum(idata.no_nuts);
            baseRow.NO_M_BOLTS = toNum(idata.no_m_bolts ?? idata.no_missing_bolts);
            baseRow.NO_M_NUTS = toNum(idata.no_m_nuts ?? idata.no_missing_nuts);
            baseRow.NO_L_BOLTS = toNum(idata.no_l_bolts ?? idata.no_loose_bolts);
            baseRow.NO_L_NUTS = toNum(idata.no_l_nuts ?? idata.no_loose_nuts);
            baseRow.NUT_SIZE = toNum(idata.nut_size);
            baseRow.BOLT_SIZE = toNum(idata.bolt_size);
            baseRow.GAP = toNum(idata.gap);
            baseRow.CP_IN = toNum(idata.cp_in);
            baseRow.CP_OUT = toNum(idata.cp_out);
            baseRow.GASKET_DMG = sanitizeText(idata.gasket_dmg || idata.gasket_info || "").substring(0, 20);
            baseRow.REF_NAME = sanitizeText(idata.ref_name || "").substring(0, 20);
            baseRow.POSITION = sanitizeText(idata.position || "").substring(0, 20);
            baseRow.READ_THICK = toNum(idata.read_thick ?? idata.read_thickness);
          } else if (code === "MPS") {
            const recTypeUpper = String(r.inspection_type_code || "").trim().toUpperCase();
            const itype = r.inspection_type_id ? inspTypeMapById.get(Number(r.inspection_type_id)) : null;
            const itypeCodeUpper = String(itype?.code || "").trim().toUpperCase();
            const itypeNameUpper = String(itype?.name || "").trim().toUpperCase();

            const isAcfmRec =
              recTypeUpper === "ACFMC" ||
              recTypeUpper === "AFMC" ||
              recTypeUpper === "AFS" ||
              recTypeUpper === "ACFM" ||
              recTypeUpper.includes("ACFM") ||
              recTypeUpper.includes("AFMC") ||
              itypeCodeUpper === "ACFMC" ||
              itypeCodeUpper === "AFMC" ||
              itypeCodeUpper === "ACFM" ||
              itypeCodeUpper === "AFS" ||
              itypeCodeUpper.includes("ACFM") ||
              itypeNameUpper.includes("ACFM") ||
              idata.acfmc_page !== undefined ||
              idata.chord_weld_brace !== undefined;

            baseRow.INSPECTOR = sanitizeText(r.inspector || idata.inspector || "").substring(0, 20);
            baseRow.PROC = sanitizeText(r.procedure || idata.procedure || idata.proc || "").substring(0, 20);
            baseRow.EQUIP = sanitizeText(r.equipment || idata.equipment || idata.calib_equipment_type || idata.equip || "").substring(0, 20);
            baseRow.EQ_ID = sanitizeText(r.equipment_id || idata.equipment_id || idata.serial_number || idata.eq_id || "").substring(0, 20);
            baseRow.SPEC = sanitizeText(r.spec || idata.spec || idata.specification || "").substring(0, 20);
            baseRow.SURF_COND = sanitizeText(idata.surface_condition || r.surf_cond || idata.surf_cond || "").substring(0, 30);
            baseRow.CLEAN_MET = sanitizeText(idata.cleaning_method || r.clean_met || idata.clean_met || "").substring(0, 20);
            baseRow.SCAF = (idata.scaffolding || r.scaf || idata.scaf) ? "Yes" : "";

            const toNum = (val: any) => (val != null && val !== "" && !isNaN(Number(val)) ? Number(val) : "");
            const toBoolYesNo = (val: any) => {
              if (
                val === true ||
                val === "true" ||
                val === "True" ||
                val === "TRUE" ||
                val === "yes" ||
                val === "Yes" ||
                val === "YES" ||
                val === 1 ||
                val === "1"
              ) {
                return "YES";
              }
              return "NO";
            };

            if (isAcfmRec) {
              baseRow.CALIB_BLK = "";
              baseRow.MAGNT_INK = "";
              baseRow.MAGNT_METHOD = "";
              baseRow.BAKGD_CONT = "";
              baseRow.MAGNT_LIFT_POWER = "";
              baseRow.ORIENTATION = sanitizeText(idata.orientation ?? "").substring(0, 20);
              baseRow.LIGHT_METHOD = "";
              baseRow.CURR_COIL_MAGN = "";
              baseRow.VOLT_COIL_MAGN = "";
              baseRow.MAGN_CURR_POLE = "";
              baseRow.DEMAGN = toBoolYesNo(idata.demagnetised ?? idata.demagnetized ?? idata.demagn);
              baseRow.DISTANCE = "";
              baseRow.INDICATION = "";
              baseRow.SIZE = "";
              baseRow.BURMAH = "";
              baseRow.PROBE_FL = sanitizeText(idata.probe_fl ?? idata.probe ?? idata.probe_flow ?? "").substring(0, 20);
              baseRow.WALL_THK3 = toNum(idata.brace_thick_3clk ?? idata.wall_thk3 ?? idata.b_wall_thk3);
              baseRow.WALL_THK6 = toNum(idata.brace_thick_6clk ?? idata.wall_thk6 ?? idata.b_wall_thk6);
              baseRow.WALL_THK9 = toNum(idata.brace_thick_9clk ?? idata.wall_thk9 ?? idata.b_wall_thk9);
              baseRow.WALL_THK12 = toNum(idata.brace_thick_12clk ?? idata.wall_thk12 ?? idata.b_wall_thk12);
              baseRow.C_WALL_THK3 = toNum(idata.chord_thick_3clk ?? idata.c_wall_thk3);
              baseRow.C_WALL_THK6 = toNum(idata.chord_thick_6clk ?? idata.c_wall_thk6);
              baseRow.C_WALL_THK9 = toNum(idata.chord_thick_9clk ?? idata.chord_thick9clk ?? idata.c_wall_thk9);
              baseRow.C_WALL_THK12 = toNum(idata.chord_thick_12clk ?? idata.c_wall_thk12);
              baseRow.T_CHORD1 = "";
              baseRow.T_CHORD2 = "";
              baseRow.T_CHORD3 = "";
              baseRow.T_CHORD4 = "";
              baseRow.WELD1 = "";
              baseRow.WELD2 = "";
              baseRow.WELD3 = "";
              baseRow.WELD4 = "";
              baseRow.T_BRACE1 = "";
              baseRow.T_BRACE2 = "";
              baseRow.T_BRACE3 = "";
              baseRow.T_BRACE4 = "";
              baseRow.CP_WALL_THK3 = "";
              baseRow.CP_WALL_THK6 = "";
              baseRow.CP_WALL_THK9 = "";
              baseRow.CP_WALL_THK12 = "";
              baseRow.SPEC_THK_CHORD = "";
              baseRow.SPEC_THK_BRACE = "";
              baseRow.POSITION = "";
              baseRow.UTWT = "";
              baseRow.UNDERCUT = "";
            } else {
              baseRow.CALIB_BLK = sanitizeText(idata.calib_block ?? idata.calib_blk ?? "").substring(0, 20);
              baseRow.MAGNT_INK = sanitizeText(idata.magnetic_ink ?? idata.magnt_ink ?? "").substring(0, 20);
              baseRow.MAGNT_METHOD = sanitizeText(idata.magnetic_method ?? idata.magnt_method ?? "").substring(0, 20);
              baseRow.BAKGD_CONT = sanitizeText(idata.background_condition ?? idata.bakgd_cont ?? "").substring(0, 20);
              baseRow.MAGNT_LIFT_POWER = toNum(idata.magnetic_lifting_power ?? idata.magnt_lift_power);
              baseRow.ORIENTATION = sanitizeText(idata.orientation ?? "").substring(0, 20);
              baseRow.LIGHT_METHOD = sanitizeText(idata.lighting_method ?? idata.light_method ?? "").substring(0, 20);
              baseRow.CURR_COIL_MAGN = toNum(idata.current_in_coil_magnet ?? idata.curr_coil_magn);
              baseRow.VOLT_COIL_MAGN = toNum(idata.voltage_in_coil_magnet ?? idata.volt_coil_magn);
              baseRow.MAGN_CURR_POLE = toNum(idata.current_pole_spacing ?? idata.magn_curr_pole);
              baseRow.DEMAGN = toBoolYesNo(idata.demagnetised ?? idata.demagnetized ?? idata.demagn);
              baseRow.DISTANCE = toNum(idata.distance ?? idata.dist_from_datum);
              baseRow.INDICATION = sanitizeText(idata.indication ?? "").substring(0, 20);
              baseRow.SIZE = sanitizeText(idata.probe_size ?? idata.size ?? "").substring(0, 20);
              baseRow.BURMAH = sanitizeText(idata.burmah_c_strip ?? idata.burmah ?? "").substring(0, 20);
              baseRow.PROBE_FL = sanitizeText(idata.probe ?? idata.probe_fl ?? idata.probe_flow ?? "").substring(0, 20);
              baseRow.WALL_THK3 = toNum(idata.brace_thick_3clk ?? idata.wall_thk3);
              baseRow.WALL_THK6 = toNum(idata.brace_thick_6clk ?? idata.wall_thk6);
              baseRow.WALL_THK9 = toNum(idata.brace_thick_9clk ?? idata.wall_thk9);
              baseRow.WALL_THK12 = toNum(idata.brace_thick_12clk ?? idata.wall_thk12);
              baseRow.C_WALL_THK3 = toNum(idata.chord_thick_3clk ?? idata.c_wall_thk3);
              baseRow.C_WALL_THK6 = toNum(idata.chord_thick_6clk ?? idata.c_wall_thk6);
              baseRow.C_WALL_THK9 = toNum(idata.chord_thick9clk ?? idata.chord_thick_9clk ?? idata.c_wall_thk9);
              baseRow.C_WALL_THK12 = toNum(idata.chord_thick_12clk ?? idata.c_wall_thk12);
              baseRow.T_CHORD1 = sanitizeText(idata.toe_chord_6_9 ?? idata.t_chord1 ?? "").substring(0, 50);
              baseRow.T_CHORD2 = sanitizeText(idata.toe_chord_9_12 ?? idata.t_chord2 ?? "").substring(0, 50);
              baseRow.T_CHORD3 = sanitizeText(idata.toe_chord_12_3 ?? idata.t_chord3 ?? "").substring(0, 50);
              baseRow.T_CHORD4 = sanitizeText(idata.toe_chord_3_6 ?? idata.t_chord4 ?? "").substring(0, 50);
              baseRow.WELD1 = sanitizeText(idata.weld_6_9 ?? idata.weld1 ?? "").substring(0, 50);
              baseRow.WELD2 = sanitizeText(idata.weld_9_12 ?? idata.weld2 ?? "").substring(0, 50);
              baseRow.WELD3 = sanitizeText(idata.weld_12_3 ?? idata.weld3 ?? "").substring(0, 50);
              baseRow.WELD4 = sanitizeText(idata.weld_3_6 ?? idata.weld4 ?? "").substring(0, 50);
              baseRow.T_BRACE1 = sanitizeText(idata.toe_brace_6_9 ?? idata.t_brace1 ?? "").substring(0, 50);
              baseRow.T_BRACE2 = sanitizeText(idata.toe_brace_9_12 ?? idata.t_brace2 ?? "").substring(0, 50);
              baseRow.T_BRACE3 = sanitizeText(idata.toe_brace_12_3 ?? idata.t_brace3 ?? "").substring(0, 50);
              baseRow.T_BRACE4 = sanitizeText(idata.toe_brace_3_6 ?? idata.t_brace4 ?? "").substring(0, 50);
              baseRow.CP_WALL_THK3 = toNum(idata.cp_at_3clk ?? idata.cp_wall_thk3);
              baseRow.CP_WALL_THK6 = toNum(idata.cp_at_6clk ?? idata.cp_wall_thk6);
              baseRow.CP_WALL_THK9 = toNum(idata.cp_at_9clk ?? idata.cp_wall_thk9);
              baseRow.CP_WALL_THK12 = toNum(idata.cp_at_12clk ?? idata.cp_wall_thk12);
              baseRow.SPEC_THK_CHORD = toNum(idata.chord_nominal_thickness ?? idata.spec_thk_chord);
              baseRow.SPEC_THK_BRACE = toNum(idata.brace_nominal_thickness ?? idata.spec_thk_brace);
              baseRow.POSITION = sanitizeText(idata.position ?? "").substring(0, 20);
              baseRow.UTWT = toNum(idata.utwt ?? idata.ut_wall_thickness);
              baseRow.UNDERCUT = toNum(idata.undercut);
            }
          } else if (code === "PHS") {
            baseRow.INSPECTOR = sanitizeText(r.inspector || idata.inspector || "").substring(0, 20);
            baseRow.PROC = sanitizeText(r.procedure || idata.procedure || idata.proc || "").substring(0, 20);
            baseRow.EQUIP = sanitizeText(r.equipment || idata.equipment || idata.calib_equipment_type || idata.equip || "").substring(0, 20);
            baseRow.EQ_ID = sanitizeText(r.equipment_id || idata.equipment_id || idata.serial_number || idata.eq_id || "").substring(0, 20);
            baseRow.SPEC = sanitizeText(r.spec || idata.spec || idata.specification || "").substring(0, 20);
            baseRow.SURF_COND = sanitizeText(idata.surface_condition || r.surf_cond || idata.surf_cond || "").substring(0, 30);
            baseRow.CLEAN_MET = sanitizeText(idata.cleaning_method || r.clean_met || idata.clean_met || "").substring(0, 20);
            baseRow.SCAF = (idata.scaffolding || r.scaf || idata.scaf) ? "Yes" : "";

            const toNum = (val: any) => (val != null && val !== "" && !isNaN(Number(val)) ? Number(val) : "");

            baseRow.LIGHT_METHOD = sanitizeText(idata.lighting_method || idata.light_method || "").substring(0, 20);
            baseRow.FILM_TYPE = sanitizeText(idata.film_type || "").substring(0, 20);
            baseRow.DESCRIPTION = sanitizeText(idata.description || idata.desc || "").substring(0, 50);
            baseRow.WRK_PERMIT_ISSUE_DATE = formatDateStr(idata.wrk_permit_issue_date || idata.work_permit_issued_date || idata.permit_date);
            baseRow.EXPOSURE_NO = toNum(idata.exposure_number ?? idata.exposure_no);
            baseRow.SUBJECT = sanitizeText(idata.subject_of_photo || idata.subject || "").substring(0, 30);
            baseRow.FILM_NO = sanitizeText(idata.film_no || "").substring(0, 20);
            baseRow.FILM_SPEED = sanitizeText(idata.film_speed || "").substring(0, 10);
            baseRow.CAMERA_TYP = sanitizeText(idata.camera_type || idata.camera_typ || "").substring(0, 20);
            baseRow.LENS = sanitizeText(idata.lens || "").substring(0, 10);
            baseRow.SNAP = sanitizeText(idata.snap || "").substring(0, 10);
            baseRow.PHOTO_NO = sanitizeText(idata.photo_no || "").substring(0, 10);
            baseRow.FILM_REF = sanitizeText(idata.film_ref || idata.film_reference || "").substring(0, 20);
          } else if (code === "VDS") {
            const tape = (r.rov_job_id ? videoTapeMapByRovJobId.get(Number(r.rov_job_id)) : null)
              || (r.dive_job_id ? videoTapeMapByDiveJobId.get(Number(r.dive_job_id)) : null)
              || (r.dive_job_id ? videoTapeMapById.get(Number(r.dive_job_id)) : null);
            const videoLog = (tape?.tape_id ? videoLogMapByTapeId.get(Number(tape.tape_id)) : null) || videoLogMapByInspId.get(Number(r.insp_id));

            baseRow.COMP_ID = "";
            baseRow.ID_NO = "";
            baseRow.Q_ID = "";
            baseRow.CODE = "";
            baseRow.COMPDESC = "";
            baseRow.S_NODE = "";
            baseRow.F_NODE = "";
            baseRow.S_LEG = "";
            baseRow.F_LEG = "";
            baseRow.ELV_1 = "";
            baseRow.ELV_2 = "";
            baseRow.DIST = "";
            baseRow.CLK_POS = "";
            baseRow.COMPTYPE = "";

            baseRow.INSP_ID = videoLog?.video_log_id != null ? videoLog.video_log_id : r.insp_id;
            baseRow.INSP_DATE = videoLog?.event_time ? formatDateStr(videoLog.event_time) : formatDateStr(r.inspection_date);
            baseRow.INSP_TIME = videoLog?.event_time ? formatTimeStr(videoLog.event_time) : formatTimeStr(r.inspection_time || idata.time || "");

            baseRow.INSPECTOR = "";
            baseRow.PROC = "";
            baseRow.EQUIP = "";
            baseRow.EQ_ID = "";
            baseRow.SPEC = "";
            baseRow.SURF_COND = "";
            baseRow.CLEAN_MET = "";
            baseRow.SCAF = "";
            baseRow.SUPV = sanitizeText(resolvedSupervisor).substring(0, 20);
            baseRow.DIVR = sanitizeText(resolvedDiver).substring(0, 20);
            baseRow.DIVE_NO = sanitizeText(resolvedDiveNo).substring(0, 10);
            baseRow.ELEVATION = "";
            baseRow.TOP_UND = "";

            baseRow.LIGHT_METHOD = "";
            baseRow.TAPE_TYPE = sanitizeText(tape?.tape_type || idata.tape_type || "").substring(0, 20);
            baseRow.TAPE_NO = sanitizeText(tape?.tape_no || idata.tape_no || "").substring(0, 20);

            const subjectParts = [tape?.remarks, videoLog?.event_type || idata.subject].filter(Boolean);
            baseRow.SUBJECT = sanitizeText(subjectParts.join(" ") || "").substring(0, 30);
            baseRow.TAPE_FOOTAGE = sanitizeText(videoLog?.timecode_start ? formatTimeStr(videoLog.timecode_start) : (idata.tape_footage || "")).substring(0, 30);
            baseRow.TAPE_PERMIT_ISSUE_DATE = "";
          } else if (code === "PGS") {
            const rRovJobId = r.rov_job_id != null ? Number(r.rov_job_id) : (idata.rov_job_id != null ? Number(idata.rov_job_id) : null);
            const rTapeId = r.tape_id != null ? Number(r.tape_id) : (idata.tape_id != null ? Number(idata.tape_id) : null);

            let tape: any = null;
            if (rRovJobId != null && rTapeId != null) {
              tape = videoTapeMapByRovJobAndTapeId.get(`${rRovJobId}_${rTapeId}`);
            }
            if (!tape && rTapeId != null) {
              tape = videoTapeMapById.get(Number(rTapeId));
            }
            if (!tape && rRovJobId != null) {
              tape = videoTapeMapByRovJobId.get(Number(rRovJobId));
            }
            if (!tape && r.dive_job_id) {
              tape = videoTapeMapByDiveJobId.get(Number(r.dive_job_id));
            }

            baseRow.INSP_ID = r.insp_id;
            baseRow.SUPV = sanitizeText(resolvedSupervisor).substring(0, 20);
            baseRow.TAPE_NO = sanitizeText(tape?.tape_no || idata.tape_no || r.tape_no || "").substring(0, 50);

            const rawCounter = r.tape_count_no != null && r.tape_count_no !== ""
              ? r.tape_count_no
              : (idata.tape_count_no != null && idata.tape_count_no !== ""
                ? idata.tape_count_no
                : (idata.counter_no != null && idata.counter_no !== "" ? idata.counter_no : ""));

            const parseCounterVal = (val: any): number | string => {
              if (val == null || val === "") return "";
              if (typeof val === "number" && !isNaN(val)) return Math.round(val);
              const strVal = String(val).trim();
              if (!strVal) return "";
              if (/^\d+$/.test(strVal)) return parseInt(strVal, 10);
              if (!isNaN(Number(strVal))) return Math.round(Number(strVal));
              if (strVal.includes(":")) {
                const parts = strVal.split(":").map(Number);
                if (parts.length === 3 && !parts.some(isNaN)) {
                  return parts[0] * 3600 + parts[1] * 60 + parts[2];
                }
                if (parts.length === 2 && !parts.some(isNaN)) {
                  return parts[0] * 60 + parts[1];
                }
              }
              const numOnly = parseFloat(strVal);
              return !isNaN(numOnly) ? Math.round(numOnly) : "";
            };

            baseRow.COUNTER_NO = parseCounterVal(rawCounter);
            baseRow.I_DATE = formatDateStr(r.inspection_date);
            baseRow.I_TIME = sanitizeText(r.inspection_time || idata.insp_time || idata.time || "").substring(0, 8);
            baseRow.DIVER = sanitizeText(resolvedDiver).substring(0, 20);
            baseRow.DIVE_NO = sanitizeText(resolvedDiveNo).substring(0, 10);
            baseRow.ELV = r.elevation != null && r.elevation !== "" ? Number(r.elevation) : (idata.elevation != null && idata.elevation !== "" ? Number(idata.elevation) : "");
            baseRow.COMP_COND = sanitizeText(idata.component_condition || "").substring(0, 20);
            baseRow.COAT_COND = sanitizeText(idata.coating_condition || "").substring(0, 20);
            baseRow.DESCRIPTION = sanitizeText(idata.description || "").substring(0, 50);

            const hard = idata.marine_growth_hard;
            const soft = idata.marine_growth_soft;
            let mgText = "";
            if (hard != null && hard !== "" && soft != null && soft !== "") {
              const hardStr = String(hard).trim();
              const softStr = String(soft).trim();
              if (hardStr === softStr) {
                mgText = `${hardStr}${hardStr.includes("%") ? "" : "%"} COVERAGE OF HARD AND SOFT GROWTH`;
              } else {
                mgText = `${hardStr}${hardStr.includes("%") ? "" : "%"} COVERAGE OF HARD GROWTH ${softStr}${softStr.includes("%") ? "" : "%"} COVERAGE OF SOFT GROWTH`;
              }
            } else if (hard != null && hard !== "") {
              const hardStr = String(hard).trim();
              mgText = `${hardStr}${hardStr.includes("%") ? "" : "%"} COVERAGE OF HARD GROWTH`;
            } else if (soft != null && soft !== "") {
              const softStr = String(soft).trim();
              mgText = `${softStr}${softStr.includes("%") ? "" : "%"} COVERAGE OF SOFT GROWTH`;
            } else if (idata.marine_growth_pct != null && idata.marine_growth_pct !== "") {
              mgText = `${String(idata.marine_growth_pct).trim()}% COVERAGE`;
            } else if (idata.mg_cond != null && idata.mg_cond !== "") {
              mgText = String(idata.mg_cond).trim();
            }
            baseRow.MG_COND = sanitizeText(mgText).substring(0, 20);

            baseRow.DEBRIS = sanitizeText(idata.debris || "").substring(0, 20);
            baseRow.CP_RDG = idata.cp_rdg != null && idata.cp_rdg !== "" ? Number(idata.cp_rdg) : (idata.cp_reading != null && idata.cp_reading !== "" ? Number(idata.cp_reading) : "");
            baseRow.COMP_FACE = sanitizeText(idata.comp_face || idata.component_face || meta.face || "").substring(0, 6);
            baseRow.COMP_LEVEL = sanitizeText(idata.comp_level || idata.component_level || meta.level || "").substring(0, 20);
            baseRow.COMP_QID = sanitizeText(idata.comp_qid || idata.component_qid || comp?.q_id || meta.q_id || "").substring(0, 16);

            const rawFlooded = String(idata.member_status || idata.flooded || "").trim().toUpperCase();
            baseRow.FLOODED = rawFlooded === "FLOODED" || rawFlooded === "YES" || rawFlooded === "TRUE" ? "YES" : "NO";

            const rawExposed = idata.Exposed_pile ?? idata.exposed_pile ?? idata.pile_exposed;
            const isExposed = rawExposed === true || String(rawExposed).trim().toUpperCase() === "YES" || String(rawExposed).trim().toUpperCase() === "TRUE";
            baseRow.PILE_EXPOSED = isExposed ? "YES" : "NO";

            baseRow.SCOUR_AT_LOC = formatScourAtLoc(idata.scour_location || idata.scour_at_loc || "").substring(0, 10);
            baseRow.SCOUR_AT_NODE = sanitizeText(idata.scour_at_node || "").substring(0, 6);
            baseRow.SCOUR_DEPTH = idata.scour_depth != null && idata.scour_depth !== "" ? Number(idata.scour_depth) : "";
            baseRow.SCOUR_DEPTH_U = sanitizeText(idata.scour_depth_unit || (idata.scour_depth != null && idata.scour_depth !== "" ? "mm" : "")).substring(0, 10);
            baseRow.SCOUR_BURIED = idata.Burial_percent != null && idata.Burial_percent !== "" ? Number(idata.Burial_percent) : (idata.burial_percent != null && idata.burial_percent !== "" ? Number(idata.burial_percent) : (idata.scour_buried != null && idata.scour_buried !== "" ? Number(idata.scour_buried) : ""));
            baseRow.HARD_GROWTH = parseGrowthPercent(idata.marine_growth_hard ?? idata.mgi_hard_growth ?? idata.hard_growth);
            baseRow.SOFT_GROWTH = parseGrowthPercent(idata.marine_growth_soft ?? idata.mgi_soft_growth ?? idata.soft_growth);

            baseRow.HARD_THK12 = idata.mgi_hard_thickness_at_12 != null && idata.mgi_hard_thickness_at_12 !== "" ? Number(idata.mgi_hard_thickness_at_12) : "";
            baseRow.HARD_THK12_U = idata.mgi_hard_thickness_at_12 != null && idata.mgi_hard_thickness_at_12 !== "" ? "mm" : "";
            baseRow.HARD_THK3 = idata.mgi_hard_thickness_at_3 != null && idata.mgi_hard_thickness_at_3 !== "" ? Number(idata.mgi_hard_thickness_at_3) : "";
            baseRow.HARD_THK3_U = idata.mgi_hard_thickness_at_3 != null && idata.mgi_hard_thickness_at_3 !== "" ? "mm" : "";
            baseRow.HARD_THK6 = idata.mgi_hard_thickness_at_6 != null && idata.mgi_hard_thickness_at_6 !== "" ? Number(idata.mgi_hard_thickness_at_6) : "";
            baseRow.HARD_THK6_U = idata.mgi_hard_thickness_at_6 != null && idata.mgi_hard_thickness_at_6 !== "" ? "mm" : "";
            baseRow.HARD_THK9 = idata.mgi_hard_thickness_at_9 != null && idata.mgi_hard_thickness_at_9 !== "" ? Number(idata.mgi_hard_thickness_at_9) : "";
            baseRow.HARD_THK9_U = idata.mgi_hard_thickness_at_9 != null && idata.mgi_hard_thickness_at_9 !== "" ? "mm" : "";

            const rawAnType = sanitizeText(idata.anode_type || idata.an_type || comp?.metadata?.anode_type || comp?.metadata?.type || meta?.anode_type || meta?.type || "");
            const matchedAnTypeId = rawAnType
              ? (anodTypDescToId.get(rawAnType.toLowerCase()) || rawAnType)
              : "";
            baseRow.AN_TYPE = sanitizeText(matchedAnTypeId).substring(0, 10);
            baseRow.AN_DEPLETION = parseAnodeDepletion(idata.anode_depletion ?? idata.anode_depletion_percent ?? idata.an_depletion ?? comp?.metadata?.anode_depletion ?? comp?.metadata?.anode_depletion_percent ?? meta?.anode_depletion ?? meta?.anode_depletion_percent);

            const itypeObj = r.inspection_type_id ? inspTypeMapById.get(Number(r.inspection_type_id)) : null;
            baseRow.INSP_TASK = sanitizeText(itypeObj?.name || r.inspection_type_name || r.inspection_type_code || "").substring(0, 50);
            baseRow.COMMENTS = "";
          } else if (code === "BTS") {
            baseRow.INSPECTOR = "";
            baseRow.PROC = "";
            baseRow.EQUIP = "";
            baseRow.EQ_ID = "";
            baseRow.SPEC = "";
            baseRow.SURF_COND = "";
            baseRow.CLEAN_MET = "";
            baseRow.SCAF = "";

            const toNum = (val: any) => (val != null && val !== "" && !isNaN(Number(val)) ? Number(val) : "");

            baseRow.FACE = sanitizeText(idata.face || idata.platform_face || meta.face || "").substring(0, 20);
            baseRow.LEG1 = sanitizeText(idata.leg1 || idata.start_leg || meta.s_leg || idata.s_leg || "").substring(0, 20);
            baseRow.DEPTH1 = toNum(idata.depth1 ?? idata.depth_1);
            baseRow.LEG2 = sanitizeText(idata.leg2 || idata.end_leg || meta.f_leg || idata.f_leg || "").substring(0, 20);
            baseRow.DEPTH2 = toNum(idata.depth2 ?? idata.depth_2);
            baseRow.MID_POINT = toNum(idata.midpoint ?? idata.mid_point);
            baseRow.DEPTH3 = toNum(idata.depth_midpoint ?? idata["depth_midpoint "] ?? idata.depth3 ?? idata.depth_3);
            baseRow.DIST_LEG = toNum(idata.dist_leg1 ?? idata.dist_leg ?? idata.dist_legs);
            baseRow.DIST_MIDPOINT = toNum(idata.dist_midpoint ?? idata.dist_mid_point);
          }

          let resolvedJobType = "";
          if (r.sow_report_no && sowData) {
            const matchSow = (sowData || []).find((s: any) =>
              (Number(s.structure_id) === Number(r.structure_id) || Number(s.plat_id) === Number(r.structure_id)) &&
              Number(s.jobpack_id) === Number(r.jobpack_id)
            );
            if (matchSow) {
              if (Array.isArray(matchSow.report_numbers)) {
                const rep = matchSow.report_numbers.find((rn: any) => String(rn.number || rn.no || rn.report_no || "").trim() === String(r.sow_report_no).trim());
                if (rep?.job_type) resolvedJobType = rep.job_type;
              }
              if (!resolvedJobType && matchSow.job_type) resolvedJobType = matchSow.job_type;
            }
          }
          if (!resolvedJobType) {
            resolvedJobType = jp?.job_type || "";
          }

          const recTypeForInspType = String(r.inspection_type_code || "").trim().toUpperCase();
          const itypeForInspType = r.inspection_type_id ? inspTypeMapById.get(Number(r.inspection_type_id)) : null;
          const itypeCodeForInspType = String(itypeForInspType?.code || "").trim().toUpperCase();
          const itypeNameForInspType = String(itypeForInspType?.name || "").trim().toUpperCase();
          const isAcfmInsp =
            recTypeForInspType === "ACFMC" ||
            recTypeForInspType === "AFMC" ||
            recTypeForInspType === "AFS" ||
            recTypeForInspType === "ACFM" ||
            recTypeForInspType.includes("ACFM") ||
            recTypeForInspType.includes("AFMC") ||
            itypeCodeForInspType === "ACFMC" ||
            itypeCodeForInspType === "AFMC" ||
            itypeCodeForInspType === "ACFM" ||
            itypeCodeForInspType === "AFS" ||
            itypeCodeForInspType.includes("ACFM") ||
            itypeNameForInspType.includes("ACFM") ||
            idata.acfmc_page !== undefined ||
            idata.chord_weld_brace !== undefined;

          const isSzoneInsp =
            recTypeForInspType === "SZONE" ||
            recTypeForInspType === "SZS" ||
            recTypeForInspType.includes("SZONE") ||
            recTypeForInspType.includes("SPLASH") ||
            itypeCodeForInspType === "SZONE" ||
            itypeCodeForInspType === "SZS" ||
            itypeCodeForInspType.includes("SZONE") ||
            itypeNameForInspType.includes("SPLASH");

          const isBsinsInsp =
            recTypeForInspType === "BSINS" ||
            recTypeForInspType === "BSS" ||
            recTypeForInspType.includes("BSINS") ||
            recTypeForInspType.includes("BOLTED") ||
            itypeCodeForInspType === "BSINS" ||
            itypeCodeForInspType === "BSS" ||
            itypeCodeForInspType.includes("BSINS") ||
            itypeNameForInspType.includes("BOLTED");

          const isRfmdInsp =
            recTypeForInspType === "RFMD" ||
            recTypeForInspType.includes("RFMD") ||
            recTypeForInspType.includes("ROVFMD") ||
            itypeCodeForInspType === "RFMD" ||
            itypeCodeForInspType.includes("RFMD") ||
            idata.member_status !== undefined;

          const isRovDebrisAppend =
            recTypeForInspType === "RGVI" ||
            recTypeForInspType === "RRISI" ||
            recTypeForInspType === "RCOND" ||
            recTypeForInspType === "RCASN" ||
            recTypeForInspType.includes("RGVI") ||
            recTypeForInspType.includes("RRISI") ||
            recTypeForInspType.includes("RCOND") ||
            recTypeForInspType.includes("RCASN") ||
            itypeCodeForInspType === "RGVI" ||
            itypeCodeForInspType === "RRISI" ||
            itypeCodeForInspType === "RCOND" ||
            itypeCodeForInspType === "RCASN" ||
            itypeCodeForInspType.includes("RGVI") ||
            itypeCodeForInspType.includes("RRISI") ||
            itypeCodeForInspType.includes("RCOND") ||
            itypeCodeForInspType.includes("RCASN");

          const isRovScourAppend =
            recTypeForInspType === "RSCOR" ||
            recTypeForInspType.includes("RSCOR") ||
            itypeCodeForInspType === "RSCOR" ||
            itypeCodeForInspType.includes("RSCOR") ||
            Boolean(itypeNameForInspType.includes("SCOUR") && itypeForInspType?.methods?.includes("ROV"));

          const isRovMarineGrowthAppend =
            recTypeForInspType === "RMGI" ||
            recTypeForInspType.includes("RMGI") ||
            itypeCodeForInspType === "RMGI" ||
            itypeCodeForInspType.includes("RMGI") ||
            Boolean(String(itypeForInspType?.name || "").toUpperCase().includes("MARINE") && itypeForInspType?.methods?.includes("ROV"));

          const isRovGviAppend =
            recTypeForInspType === "RGVI" ||
            recTypeForInspType.includes("RGVI") ||
            itypeCodeForInspType === "RGVI" ||
            itypeCodeForInspType.includes("RGVI") ||
            Boolean(String(itypeForInspType?.name || "").toUpperCase().includes("GENERAL VISUAL") && itypeForInspType?.methods?.includes("ROV"));

          const isRovCpAppend =
            recTypeForInspType === "RGVI" ||
            recTypeForInspType === "RSANI" ||
            recTypeForInspType === "RRISI" ||
            recTypeForInspType === "RSZCI" ||
            recTypeForInspType === "RSWNI" ||
            recTypeForInspType === "RCOND" ||
            recTypeForInspType === "RCASN" ||
            recTypeForInspType.includes("RSANI") ||
            recTypeForInspType.includes("RSZCI") ||
            recTypeForInspType.includes("RSWNI") ||
            itypeCodeForInspType === "RGVI" ||
            itypeCodeForInspType === "RSANI" ||
            itypeCodeForInspType === "RRISI" ||
            itypeCodeForInspType === "RSZCI" ||
            itypeCodeForInspType === "RSWNI" ||
            itypeCodeForInspType === "RCOND" ||
            itypeCodeForInspType === "RCASN" ||
            itypeCodeForInspType.includes("RSANI") ||
            itypeCodeForInspType.includes("RSZCI") ||
            itypeCodeForInspType.includes("RSWNI");

          const isRovAnodeAppend =
            recTypeForInspType === "RGVI" ||
            recTypeForInspType === "RSANI" ||
            recTypeForInspType.includes("RSANI") ||
            itypeCodeForInspType === "RGVI" ||
            itypeCodeForInspType === "RSANI" ||
            itypeCodeForInspType.includes("RSANI");

          baseRow.DEFECT = r.has_anomaly === true || Boolean(linkedAnom) ? "YES" : "NO";
          
          const rawDftCodeType = sanitizeText(linkedAnom?.defect_type_code || (["AFS", "CVS", "BSS", "RSS", "MPS", "CCS", "PHS", "VDS", "UTS", "FDS"].includes(code) ? "" : (linkedAnom?.defect_type_code || linkedAnom?.defect_category_code || (linkedAnom ? "AW" : ""))));
          const matchedDftCodeId = rawDftCodeType
            ? (amlyCodDescToId.get(rawDftCodeType.toLowerCase()) ||
               (linkedAnom?.defect_category_code && amlyCodDescToId.get(String(linkedAnom.defect_category_code).trim().toLowerCase())) ||
               (linkedAnom?.defect_code && amlyCodDescToId.get(String(linkedAnom.defect_code).trim().toLowerCase())) ||
               rawDftCodeType)
            : "";
          baseRow.DFT_CODE_TYPE = sanitizeText(matchedDftCodeId).substring(0, 12);

          baseRow.DEFECT_CODE = sanitizeText(linkedAnom?.defect_category_code || linkedAnom?.defect_code || "").substring(0, 50);

          const rawDefectType = sanitizeText(linkedAnom?.priority_code || (["AFS", "CVS", "BSS", "RSS", "MPS", "CCS", "PHS", "VDS", "UTS", "FDS"].includes(code) ? "" : (linkedAnom?.priority_code || linkedAnom?.priority || (linkedAnom ? "P3" : ""))));
          const matchedDefectTypeId = rawDefectType
            ? (amlyTypDescToId.get(rawDefectType.toLowerCase()) ||
               (linkedAnom?.priority && amlyTypDescToId.get(String(linkedAnom.priority).trim().toLowerCase())) ||
               (linkedAnom?.severity && amlyTypDescToId.get(String(linkedAnom.severity).trim().toLowerCase())) ||
               (linkedAnom?.action_priority && amlyTypDescToId.get(String(linkedAnom.action_priority).trim().toLowerCase())) ||
               rawDefectType)
            : "";
          baseRow.DEFECT_TYPE = sanitizeText(matchedDefectTypeId).substring(0, 20);
          baseRow.DEFECT_DESC = sanitizeText(linkedAnom?.defect_description || linkedAnom?.description || "").substring(0, 250);
          baseRow.DFT_REF_NO = sanitizeText(linkedAnom?.anomaly_ref_no || "").substring(0, 30);
          baseRow.RECTIFID = linkedAnom?.is_rectified === true ? "YES" : (["AFS", "CVS", "BSS", "RSS", "MPS", "CCS", "PHS", "VDS", "UTS", "FDS"].includes(code) ? "NO" : (["DBS", "SCS", "MGS", "GVS", "CPS", "ANS", "PGS", "BTS"].includes(code) ? (linkedAnom?.is_rectified ? "YES" : "NO") : (linkedAnom?.status === "CLOSED" ? "YES" : "NO")));
          baseRow.RECTIFID_DESC = sanitizeText(linkedAnom?.rectified_remarks || (["AFS", "CVS", "BSS", "RSS", "MPS", "CCS", "PHS", "VDS", "UTS", "FDS"].includes(code) ? "" : (["DBS", "SCS", "MGS", "GVS", "CPS", "ANS", "PGS", "BTS"].includes(code) ? (linkedAnom?.rectified_remarks || "") : (linkedAnom?.follow_up_notes || "")))).substring(0, 250);
          baseRow.RECT_DATE = linkedAnom?.rectified_date ? formatDateStr(linkedAnom.rectified_date) : "";
          baseRow.INSPNO = formatInspNo(r.jobpack_id || jp?.id);
          baseRow.JOBNAME = sanitizeText(jp?.name || `JP-${r.jobpack_id || 1}`).substring(0, 20);
          baseRow.STATUS = sanitizeText(jp?.status || "OPEN").substring(0, 10).toUpperCase();
          baseRow.INSP_DONE = String(r.status || "").toUpperCase() === "COMPLETED" ? "YES" : "NO";
          baseRow.REC_DATE = formatDateStr(r.md_date || r.inspection_date);
          baseRow.INSP_COND = sanitizeText(r.description || idata.findings || idata.observations || "").substring(0, 1000);
          baseRow.CMNTS = ["BSS", "SZS", "VDS", "DBS", "SCS", "MGS", "GVS", "CPS", "ANS", "PGS", "BTS"].includes(code) ? "" : sanitizeText(r.comments || idata.comments || idata.cmnts || "").substring(0, 4000);
          baseRow.JOB_TYPE = sanitizeText(resolvedJobType).substring(0, 20).toUpperCase();
          baseRow.LAST_MAJOR_INSPNO = ["DBS", "SCS", "MGS", "GVS", "CPS", "ANS", "PGS", "BTS"].includes(code) ? "" : sanitizeText(jp?.last_insp_no || "").substring(0, 11);
          baseRow.INSPTYPE = code === "MPS" ? (isAcfmInsp ? "AFS" : "MPS") : (code === "UTS" ? (isSzoneInsp ? "SZS" : "UTS") : (code === "FDS" ? (isRfmdInsp ? "PGS" : "FDS") : (code === "DBS" ? (isRovDebrisAppend ? "PGS" : "DBS") : (code === "SCS" ? (isRovScourAppend ? "PGS" : "SCS") : (code === "MGS" ? (isRovMarineGrowthAppend ? "PGS" : "MGS") : (code === "GVS" ? (isRovGviAppend ? "PGS" : "GVS") : (code === "CPS" ? (isBsinsInsp ? "BSS" : (isSzoneInsp ? "SZS" : (isRovCpAppend ? "PGS" : "CPS"))) : (code === "ANS" ? (isRovAnodeAppend ? "PGS" : "ANS") : code))))))));
          baseRow.EVAL_BY = sanitizeText(linkedAnom?.reviewed_by || (["ITS", "SZS", "AFS", "CVS", "BSS", "RSS", "MPS", "CCS", "PHS", "VDS", "UTS", "FDS"].includes(code) ? "" : (["DBS", "SCS", "MGS", "GVS", "CPS", "ANS", "PGS", "BTS"].includes(code) ? (linkedAnom?.reviewed_by || "") : (linkedAnom?.evaluated_by || "")))).substring(0, 250);
          baseRow.APPROV_BY = sanitizeText(linkedAnom?.approved_by || "").substring(0, 250);

          if (["SZS", "BSS", "VDS", "DBS", "SCS", "MGS", "GVS", "CPS", "ANS", "PGS", "BTS"].includes(code)) {
            baseRow.CMNTS = "";
          }

          sheetRows.push(baseRow);
        });
      }

      // Value lookup helper resilient to casing differences
      const resolveRowVal = (row: any, col: any) => {
        const k = col.key;
        const h = col.header;
        let val = undefined;
        if (k && row[k] !== undefined) val = row[k];
        else if (h && row[h] !== undefined) val = row[h];
        else if (k && row[String(k).toUpperCase()] !== undefined) val = row[String(k).toUpperCase()];
        else if (h && row[String(h).toUpperCase()] !== undefined) val = row[String(h).toUpperCase()];
        else if (k && row[String(k).toLowerCase()] !== undefined) val = row[String(k).toLowerCase()];
        else if (h && row[String(h).toLowerCase()] !== undefined) val = row[String(h).toLowerCase()];
        return val;
      };

      const formattedBaseName = `${dateFormattedYymmdd}-01-${code}`;
      const txtFileName = `${formattedBaseName}.txt`;
      const xlsxFileName = `${formattedBaseName}.xlsx`;
      const csvFileName = `${formattedBaseName}.csv`;
      
      // Ensure all column headers are strictly lowercase
      const lowerColumns = sheetDef.columns.map((c) => ({
        ...c,
        header: String(c.header || c.key || "").toLowerCase(),
      }));

      // 1. Build Tab-Delimited text content (all headers lowercase)
      const headers = lowerColumns.map((c) => c.header);
      const textLines: string[] = [headers.join("\t")];
      sheetRows.forEach((row) => {
        const rowVals = lowerColumns.map((c) => {
          const val = resolveRowVal(row, c);
          return sanitizeText(cleanCellValue(val));
        });
        textLines.push(rowVals.join("\t"));
      });
      const textContent = textLines.join("\r\n");

      // 2. Build Comma-Delimited CSV content (all headers lowercase)
      const csvLines: string[] = [headers.map((h) => escapeCsvValue(h)).join(",")];
      sheetRows.forEach((row) => {
        const rowVals = lowerColumns.map((c) => {
          const val = resolveRowVal(row, c);
          return escapeCsvValue(cleanCellValue(val));
        });
        csvLines.push(rowVals.join(","));
      });
      const csvContent = csvLines.join("\r\n");

      // 3. Build Individual XLSX Buffer (all headers lowercase)
      const aoaRows: any[][] = [
        headers,
        ...sheetRows.map((row) =>
          lowerColumns.map((c) => {
            const val = resolveRowVal(row, c);
            return cleanCellValue(val);
          })
        ),
      ];

      const singleWb = XLSX.utils.book_new();
      const singleWs = XLSX.utils.aoa_to_sheet(aoaRows);
      singleWs["!cols"] = lowerColumns.map((c) => ({ wch: Math.max(c.width || 14, (c.header || "").length + 2) }));
      const safeSheetName = (sheetDef.sheetName || code).replace(/[\\/?*:[\]]/g, "_").substring(0, 31);
      XLSX.utils.book_append_sheet(singleWb, singleWs, safeSheetName);
      const xlsxBuffer = XLSX.write(singleWb, { type: "buffer", bookType: "xlsx" }) as Buffer;

      tablesOutput.push({
        id: sheetDef.id,
        code,
        sheetName: sheetDef.sheetName,
        xlsxFileName,
        txtFileName,
        csvFileName,
        columns: lowerColumns,
        rows: sheetRows,
        textContent,
        csvContent,
        xlsxBuffer,
      });
    }

    // 9. Write directly to Server / Local Destination Folder if provided
    let serverSavedPath = "";
    if (destinationFolder && destinationFolder.trim().length > 0) {
      try {
        const targetDir = path.resolve(destinationFolder.trim());
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        if (isSingleTableExport && tablesOutput.length === 1) {
          const tbl = tablesOutput[0];
          if (format === "individual_xlsx" || format === "xlsx" || format === "single_xlsx") {
            const filePath = path.join(targetDir, tbl.xlsxFileName);
            fs.writeFileSync(filePath, tbl.xlsxBuffer);
            serverSavedPath = filePath;
          } else if (format === "individual_csv" || format === "csv" || format === "csv_zip") {
            const filePath = path.join(targetDir, tbl.csvFileName);
            fs.writeFileSync(filePath, tbl.csvContent, "utf-8");
            serverSavedPath = filePath;
          } else {
            const filePath = path.join(targetDir, tbl.txtFileName);
            fs.writeFileSync(filePath, tbl.textContent, "utf-8");
            serverSavedPath = filePath;
          }
        } else {
          // Write all individual files to destination directory!
          if (format === "individual_xlsx" || format === "xlsx") {
            // Write individual .xlsx files to destination directory
            tablesOutput.forEach((tbl) => {
              fs.writeFileSync(path.join(targetDir, tbl.xlsxFileName), tbl.xlsxBuffer);
            });
            serverSavedPath = targetDir;
          } else if (format === "individual_csv" || format === "csv" || format === "csv_zip") {
            // Write individual .csv files to destination directory
            tablesOutput.forEach((tbl) => {
              fs.writeFileSync(path.join(targetDir, tbl.csvFileName), tbl.csvContent, "utf-8");
            });
            serverSavedPath = targetDir;
          } else if (format === "single_xlsx") {
            // Consolidated single .xlsx with multiple tabs (all headers lowercase)
            const combinedWb = XLSX.utils.book_new();
            tablesOutput.forEach((tbl) => {
              const tblHeaders = tbl.columns.map((c: any) => String(c.header || c.key || "").toLowerCase());
              const aoaData: any[][] = [
                tblHeaders,
                ...tbl.rows.map((row: any) =>
                  tbl.columns.map((c: any) => {
                    const k = c.key;
                    const h = c.header;
                    let val = undefined;
                    if (k && row[k] !== undefined) val = row[k];
                    else if (h && row[h] !== undefined) val = row[h];
                    else if (k && row[String(k).toUpperCase()] !== undefined) val = row[String(k).toUpperCase()];
                    else if (h && row[String(h).toUpperCase()] !== undefined) val = row[String(h).toUpperCase()];
                    else if (k && row[String(k).toLowerCase()] !== undefined) val = row[String(k).toLowerCase()];
                    else if (h && row[String(h).toLowerCase()] !== undefined) val = row[String(h).toLowerCase()];
                    return cleanCellValue(val);
                  })
                ),
              ];
              const ws = XLSX.utils.aoa_to_sheet(aoaData);
              ws["!cols"] = tbl.columns.map((c: any) => ({ wch: Math.max(c.width || 14, (c.header || "").length + 2) }));
              const safeTabName = (tbl.sheetName || tbl.code).replace(/[\\/?*:[\]]/g, "_").substring(0, 31);
              XLSX.utils.book_append_sheet(combinedWb, ws, safeTabName);
            });
            const combinedFileName = fileName || `${clientProfile.code}_${activeInterface.code}_PACKAGE_${dateFormattedYymmdd}.xlsx`;
            const filePath = path.join(targetDir, combinedFileName);
            const combinedBuf = XLSX.write(combinedWb, { type: "buffer", bookType: "xlsx" }) as Buffer;
            fs.writeFileSync(filePath, combinedBuf);
            serverSavedPath = filePath;
          } else {
            // Default: individual_txt / txt_zip: Write individual tab-delimited .txt files
            tablesOutput.forEach((tbl) => {
              fs.writeFileSync(path.join(targetDir, tbl.txtFileName), tbl.textContent, "utf-8");
            });
            serverSavedPath = targetDir;
          }
        }
      } catch (dirErr) {
        console.warn("[InterfaceExport] Note: Server could not write directly to path:", dirErr);
      }
    }

    // 10. Generate Delivery Output for Browser Download
    // Case A: Single Table Download
    if (isSingleTableExport && tablesOutput.length === 1) {
      const tbl = tablesOutput[0];
      if (format === "individual_xlsx" || format === "xlsx" || format === "single_xlsx") {
        return new NextResponse(new Uint8Array(tbl.xlsxBuffer), {
          status: 200,
          headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="${tbl.xlsxFileName}"`,
            "X-Generated-Filename": tbl.xlsxFileName,
            "X-Record-Count": String(tbl.rows.length),
            "X-Destination-Folder": serverSavedPath || destinationFolder || "",
            "X-Files-Saved-Directly": serverSavedPath ? "true" : "false",
          },
        });
      } else if (format === "individual_csv" || format === "csv" || format === "csv_zip") {
        return new NextResponse(tbl.csvContent, {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${tbl.csvFileName}"`,
            "X-Generated-Filename": tbl.csvFileName,
            "X-Record-Count": String(tbl.rows.length),
            "X-Destination-Folder": serverSavedPath || destinationFolder || "",
            "X-Files-Saved-Directly": serverSavedPath ? "true" : "false",
          },
        });
      } else {
        return new NextResponse(tbl.textContent, {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Content-Disposition": `attachment; filename="${tbl.txtFileName}"`,
            "X-Generated-Filename": tbl.txtFileName,
            "X-Record-Count": String(tbl.rows.length),
            "X-Destination-Folder": serverSavedPath || destinationFolder || "",
            "X-Files-Saved-Directly": serverSavedPath ? "true" : "false",
          },
        });
      }
    }

    // Case B: Full Package (Consolidated Multi-Sheet XLSX)
    if (format === "single_xlsx") {
      const workbook = XLSX.utils.book_new();
      tablesOutput.forEach((tbl) => {
        const tblHeaders = tbl.columns.map((c: any) => String(c.header || c.key || "").toLowerCase());
        const aoaData: any[][] = [
          tblHeaders,
          ...tbl.rows.map((row: any) =>
            tbl.columns.map((c: any) => {
              const k = c.key;
              const h = c.header;
              let val = undefined;
              if (k && row[k] !== undefined) val = row[k];
              else if (h && row[h] !== undefined) val = row[h];
              else if (k && row[String(k).toUpperCase()] !== undefined) val = row[String(k).toUpperCase()];
              else if (h && row[String(h).toUpperCase()] !== undefined) val = row[String(h).toUpperCase()];
              else if (k && row[String(k).toLowerCase()] !== undefined) val = row[String(k).toLowerCase()];
              else if (h && row[String(h).toLowerCase()] !== undefined) val = row[String(h).toLowerCase()];
              return cleanCellValue(val);
            })
          ),
        ];
        const worksheet = XLSX.utils.aoa_to_sheet(aoaData);
        worksheet["!cols"] = tbl.columns.map((c: any) => ({ wch: Math.max(c.width || 14, (c.header || "").length + 2) }));
        const safeTabName = (tbl.sheetName || tbl.code).replace(/[\\/?*:[\]]/g, "_").substring(0, 31);
        XLSX.utils.book_append_sheet(workbook, worksheet, safeTabName);
      });

      const outputFileName = fileName || `${clientProfile.code}_${activeInterface.code}_PACKAGE_${dateFormattedYymmdd}.xlsx`;
      const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

      return new NextResponse(new Uint8Array(excelBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${outputFileName}"`,
          "X-Generated-Filename": outputFileName,
          "X-Record-Count": String(allRecords.length),
          "X-Destination-Folder": serverSavedPath || destinationFolder || "",
          "X-Files-Saved-Directly": serverSavedPath ? "true" : "false",
        },
      });
    }

    // Zip package containing all individual files (xlsx, txt, or csv)
    const zip = new JSZip();
    let zipFileName = fileName;

    if (format === "individual_xlsx" || format === "xlsx") {
      tablesOutput.forEach((tbl) => {
        zip.file(tbl.xlsxFileName, tbl.xlsxBuffer);
      });
      zipFileName = zipFileName || `${clientProfile.code}_${activeInterface.code}_INDIVIDUAL_XLSX_${dateFormattedYymmdd}.zip`;
    } else if (format === "individual_csv" || format === "csv" || format === "csv_zip") {
      tablesOutput.forEach((tbl) => {
        zip.file(tbl.csvFileName, tbl.csvContent);
      });
      zipFileName = zipFileName || `${clientProfile.code}_${activeInterface.code}_INDIVIDUAL_CSV_${dateFormattedYymmdd}.zip`;
    } else {
      // individual_txt / txt_zip
      tablesOutput.forEach((tbl) => {
        zip.file(tbl.txtFileName, tbl.textContent);
      });
      zipFileName = zipFileName || `${clientProfile.code}_${activeInterface.code}_INDIVIDUAL_TXT_${dateFormattedYymmdd}.zip`;
    }

    const zipUint8 = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });

    return new NextResponse(zipUint8, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipFileName}"`,
        "X-Generated-Filename": zipFileName,
        "X-Record-Count": String(allRecords.length),
        "X-Destination-Folder": serverSavedPath || destinationFolder || "",
        "X-Files-Saved-Directly": serverSavedPath ? "true" : "false",
      },
    });
  } catch (error: any) {
    console.error("[InterfaceExport] Critical error:", error);
    return NextResponse.json({ error: error.message || "Export failed" }, { status: 500 });
  }
});
