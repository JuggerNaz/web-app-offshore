import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { withTenant } from "@/utils/tenant-auth";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import fs from "fs";
import path from "path";
import { INITIAL_CLIENT_PROFILES, ClientProfile, ClientInterfaceDef, TemplateSheet } from "@/utils/interface-templates";

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

    // Resolve client & interface definition
    const clientProfile: ClientProfile = INITIAL_CLIENT_PROFILES.find((c) => c.id === clientId) || INITIAL_CLIENT_PROFILES[0];
    const activeInterface: ClientInterfaceDef = customInterface || clientProfile.interfaces.find((i) => i.id === interfaceId) || clientProfile.interfaces[0];

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
    let rawJpQuery = (supabase as any).from("jobpack").select("*");
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
      { data: compData },
      { data: compTypesData },
      { data: diveJobsData },
      { data: rovJobsData },
      { data: videoTapesData },
      { data: videoLogsData },
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
        .limit(2000),
      (supabase as any)
        .from("insp_rov_jobs")
        .select("*")
        .limit(2000),
      (supabase as any)
        .from("insp_video_tapes")
        .select("*")
        .limit(5000),
      (supabase as any)
        .from("insp_video_logs")
        .select("*")
        .limit(10000),
    ]);

    const compMap = new Map<number, any>();
    const compMapByCompId = new Map<number, any>();
    const compMapByQid = new Map<string, any>();
    (compData || []).forEach((c: any) => {
      if (c.id != null) compMap.set(Number(c.id), c);
      if (c.comp_id != null) compMapByCompId.set(Number(c.comp_id), c);
      if (c.q_id) compMapByQid.set(String(c.q_id).trim().toUpperCase(), c);
    });

    const compTypeMap = new Map<string, string>();
    (compTypesData || []).forEach((ct: any) => {
      if (ct.code) {
        compTypeMap.set(String(ct.code).trim().toUpperCase(), ct.descrip || ct.name || "");
      }
    });

    const diveJobMap = new Map<number, any>();
    (diveJobsData || []).forEach((dj: any) => {
      if (dj.dive_job_id != null) diveJobMap.set(Number(dj.dive_job_id), dj);
      if (dj.id != null) diveJobMap.set(Number(dj.id), dj);
    });

    const rovJobMap = new Map<number, any>();
    (rovJobsData || []).forEach((rj: any) => {
      if (rj.rov_job_id != null) rovJobMap.set(Number(rj.rov_job_id), rj);
      if (rj.id != null) rovJobMap.set(Number(rj.id), rj);
    });

    const videoTapeMapByDiveJobId = new Map<number, any>();
    const videoTapeMapById = new Map<number, any>();
    (videoTapesData || []).forEach((vt: any) => {
      if (vt.tape_id != null) videoTapeMapById.set(Number(vt.tape_id), vt);
      if (vt.dive_job_id != null && !videoTapeMapByDiveJobId.has(Number(vt.dive_job_id))) {
        videoTapeMapByDiveJobId.set(Number(vt.dive_job_id), vt);
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

    // 3.5 Fetch Inspection Types
    const { data: inspTypesData } = await (supabase as any)
      .from("inspection_type")
      .select("id, code, name, metadata");

    const inspTypeMapById = new Map<number, any>();
    const inspTypeMapByCode = new Map<string, any>();
    (inspTypesData || []).forEach((it: any) => {
      if (it.id != null) inspTypeMapById.set(Number(it.id), it);
      if (it.code) inspTypeMapByCode.set(String(it.code).trim().toUpperCase(), it);
    });

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
    if (sowReportNos && sowReportNos.length > 0) {
      inspQuery = inspQuery.in("sow_report_no", sowReportNos);
    } else if (sowReportNo && sowReportNo !== "ALL") {
      inspQuery = inspQuery.eq("sow_report_no", sowReportNo);
    }
    if (!singleTableCode && !singleTableId && inspectionTypes.length > 0 && !inspectionTypes.includes("ALL")) {
      inspQuery = inspQuery.in("inspection_type_code", inspectionTypes);
    }

    const { data: recordsData, error: recordsError } = await inspQuery.limit(5000);
    if (recordsError) {
      console.error("[Interface Export] Error querying insp_records:", recordsError);
    }
    const allRecords = recordsData || [];

    // Fetch any missing components referenced in allRecords
    const missingCompIdSet = new Set<number>();
    const missingQidSet = new Set<string>();

    allRecords.forEach((r: any) => {
      const cId = Number(r.component_id || r.inspection_data?.component_id || r.inspection_data?.comp_id);
      if (!isNaN(cId) && cId > 0 && !compMap.has(cId) && !compMapByCompId.has(cId)) {
        missingCompIdSet.add(cId);
      }
      const qVal = String(r.q_id || r.component_qid || r.inspection_data?.q_id || r.inspection_data?.component_qid || r.inspection_data?.component || "").trim().toUpperCase();
      if (qVal && !compMapByQid.has(qVal)) {
        missingQidSet.add(qVal);
      }
    });

    if (missingCompIdSet.size > 0) {
      const missingIds = Array.from(missingCompIdSet);
      const [{ data: byIdComps }, { data: byCompIdComps }] = await Promise.all([
        (supabase as any).from("structure_components").select("*").in("id", missingIds),
        (supabase as any).from("structure_components").select("*").in("comp_id", missingIds),
      ]);
      (byIdComps || []).forEach((c: any) => {
        if (c.id != null) compMap.set(Number(c.id), c);
        if (c.comp_id != null) compMapByCompId.set(Number(c.comp_id), c);
        if (c.q_id) compMapByQid.set(String(c.q_id).trim().toUpperCase(), c);
      });
      (byCompIdComps || []).forEach((c: any) => {
        if (c.id != null) compMap.set(Number(c.id), c);
        if (c.comp_id != null) compMapByCompId.set(Number(c.comp_id), c);
        if (c.q_id) compMapByQid.set(String(c.q_id).trim().toUpperCase(), c);
      });
    }

    if (missingQidSet.size > 0) {
      const missingQids = Array.from(missingQidSet);
      const { data: byQidComps } = await (supabase as any)
        .from("structure_components")
        .select("*")
        .in("q_id", missingQids);
      (byQidComps || []).forEach((c: any) => {
        if (c.id != null) compMap.set(Number(c.id), c);
        if (c.comp_id != null) compMapByCompId.set(Number(c.comp_id), c);
        if (c.q_id) compMapByQid.set(String(c.q_id).trim().toUpperCase(), c);
      });
    }

    // 5. Fetch Anomalies
    let anomQuery = (supabase as any)
      .from("insp_anomalies")
      .select("*");

    if (activeStrIds.length > 0) {
      anomQuery = anomQuery.in("structure_id", activeStrIds);
    }
    const { data: anomaliesData } = await anomQuery.limit(5000);
    const allAnomalies = anomaliesData || [];
    const anomMapByInspId = new Map<number, any>();
    allAnomalies.forEach((a: any) => {
      if (a.inspection_id != null) anomMapByInspId.set(Number(a.inspection_id), a);
    });

    // 6. Fetch Pipeline Events / Geo
    const { data: pipeGeoData } = await (supabase as any)
      .from("pipe_geo")
      .select("*")
      .in("str_id", activeStrIds.length > 0 ? activeStrIds : [0])
      .limit(2000);

    // 7. Fetch Attachments linked to matching inspection records
    const targetInspIds = allRecords.map((r: any) => Number(r.insp_id)).filter((id: number) => !isNaN(id) && id > 0);
    let attachmentsList: any[] = [];

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
      if (typeof val === "boolean") return val ? "Yes" : "No";
      return String(val).replace(/[\r\n\t]+/g, " ").trim();
    };

    const formatInspNo = (jobpackId: any): string => {
      const numId = Number(jobpackId) || 0;
      return String(numId + 10000).padStart(11, "0");
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

    // 8. Determine templates to process (all templates or single table)
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
        if (code === "AFS") {
          validCodes.push("AFMC", "ACFMC", "ACFM", "AFS", "ACFM SURVEY");
        }
        if (code === "CVS") {
          validCodes.push("CVINS", "CVI", "CLPIN", "CVS", "CLOSE VISUAL");
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
        if (code === "SCS") {
          validCodes.push("SCOUR", "SCR", "RSCOR", "SCS", "SCOUR_SURVEY", "SCOUR_INSP", "SCOUR INSPECTION", "SCOUR SURVEY");
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
              idata.span_height !== undefined ||
              idata.riserbend_elevation !== undefined ||
              idata.marine_growth_soft !== undefined ||
              idata.marine_growth_hard !== undefined ||
              idata.wall_thickness !== undefined ||
              recType === "RISER" ||
              recType === "RSS" ||
              recType.includes("RISER") ||
              itypeCode === "RISER" ||
              itypeCode === "RSS" ||
              itypeCode.includes("RISER") ||
              itypeName.includes("RISER")
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
            if (
              idata.distance_debris !== undefined ||
              idata.length_debris !== undefined ||
              idata.width_debris !== undefined ||
              idata.height_debris !== undefined ||
              idata.side_facing !== undefined ||
              idata.debris_item !== undefined ||
              idata.size_of_debris !== undefined ||
              idata.db_cp_pulled !== undefined ||
              idata.damage_caused !== undefined ||
              idata.debris_removed !== undefined ||
              recType === "PL_DB" ||
              recType === "DEBRIS" ||
              recType === "DBS" ||
              recType === "RGVI" ||
              recType === "RRISI" ||
              recType === "RCOND" ||
              recType === "RCASN" ||
              recType.includes("DEBRIS") ||
              recType.includes("PL_DB") ||
              recType.includes("RGVI") ||
              recType.includes("RRISI") ||
              recType.includes("RCOND") ||
              recType.includes("RCASN") ||
              itypeCode === "PL_DB" ||
              itypeCode === "DEBRIS" ||
              itypeCode === "DBS" ||
              itypeCode === "RGVI" ||
              itypeCode === "RRISI" ||
              itypeCode === "RCOND" ||
              itypeCode === "RCASN" ||
              itypeCode.includes("DEBRIS") ||
              itypeCode.includes("PL_DB") ||
              itypeCode.includes("RGVI") ||
              itypeCode.includes("RRISI") ||
              itypeCode.includes("RCOND") ||
              itypeCode.includes("RCASN") ||
              itypeName.includes("DEBRIS")
            ) {
              return true;
            }
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

          if (recType.includes("PGS") && ["ANS", "CPS", "DBS", "FDS", "GVS", "MGS", "SCS"].includes(code)) return true;
          if (recType.includes("SZS") && ["CPS", "UTS"].includes(code)) return true;
          if (recType.includes("BSS") && ["CPS"].includes(code)) return true;
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

            let midPointVal: any = "";
            let startLegVal: any = "";
            let endLegVal: any = "";
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
              const loc = String(idata.scour_location || idata.location || "").trim().toUpperCase();
              const isStart = loc.includes("START") || loc.includes("LEG 1") || loc.includes("LEG1");
              const isEnd = loc.includes("END") || loc.includes("LEG 2") || loc.includes("LEG2");
              const isMid = loc.includes("MID") || loc === "MIDPOINT";

              const depth = idata.scour_depth ?? idata.depth;
              const expPile = idata.exposed_pile ?? idata.Exposed_pile;
              const isExpPile = expPile === true || expPile === "true" || expPile === "True" || expPile === "TRUE" || expPile === "yes" || expPile === "Yes" || expPile === "YES" || expPile === 1 || expPile === "1";

              if (isMid && depth != null && depth !== "") {
                midPointVal = depth;
              } else if (idata.mid_point != null && idata.mid_point !== "") {
                midPointVal = idata.mid_point;
              }

              if (isStart) {
                if (depth != null && depth !== "") depth1Val = depth;
                if (isExpPile) expPileLeg1Val = "YES";
                if (idata.leg_name || idata.leg1 || idata.start_leg) {
                  startLegVal = idata.leg_name || idata.leg1 || idata.start_leg;
                }
              }
              if (idata.depth1 != null && idata.depth1 !== "") depth1Val = idata.depth1;
              if (idata.exp_pile_leg1 != null && idata.exp_pile_leg1 !== "") expPileLeg1Val = idata.exp_pile_leg1;

              if (isEnd) {
                if (depth != null && depth !== "") depth2Val = depth;
                if (isExpPile) expPileLeg2Val = "YES";
                if (idata.leg_name || idata.leg2 || idata.end_leg) {
                  endLegVal = idata.leg_name || idata.leg2 || idata.end_leg;
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
                startLegVal,
                endLegVal,
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
          const recCompId = Number(r.component_id || idata.component_id || idata.comp_id);
          const recQid = String(r.q_id || r.component_qid || idata.q_id || idata.component_qid || idata.component || "").trim().toUpperCase();
          const comp = (!isNaN(recCompId) && recCompId > 0 ? (compMap.get(recCompId) || compMapByCompId.get(recCompId)) : null)
            || (recQid ? compMapByQid.get(recQid) : null)
            || r.structure_components
            || r.component;
          const jp = jobpackMap.get(Number(r.jobpack_id));
          const meta = comp?.metadata || {};
          const dj = r.dive_job_id ? diveJobMap.get(Number(r.dive_job_id)) : null;
          const linkedAnom = anomMapByInspId.get(Number(r.insp_id)) || (allAnomalies || []).find((a: any) => a.inspection_id === r.insp_id);
          const recCompCodeUpper = String(comp?.code || meta.code || meta.comp_code || idata.comp_code || idata.code || "").trim().toUpperCase();
          const recCompTypeDesc = compTypeMap.get(recCompCodeUpper) || meta.comptype || meta.comp_type || comp?.type || idata.comptype || (code === "UCS" || code === "CCS" ? "CALIBRATION" : "MEMBER");
          const resolvedDiveNo = dj?.dive_no || dj?.job_no || dj?.name || idata.dive_no || r.dive_no || (r.dive_job_id ? String(r.dive_job_id) : "");
          const isCalib = code === "UCS" || code === "CCS";

          const baseRow: any = {
            STR_ID: r.structure_id || strObj?.plat_id || 1,
            TITLE: sanitizeText(strObj?.title || `Platform ${r.structure_id}`).substring(0, 20),
            PFIELD: sanitizeText(strObj?.pfield || "").substring(0, 20),
            PDESC: sanitizeText(strObj?.pdesc || "").substring(0, 50),
            DEF_UNIT: sanitizeText(strObj?.def_unit || "Metric").substring(0, 10),
            COMP_ID: isCalib ? "" : (comp?.comp_id != null ? comp.comp_id : (comp?.id != null ? comp.id : (r.component_id || idata.comp_id || idata.component_id || ""))),
            ID_NO: isCalib ? "" : sanitizeText(comp?.id_no || meta.id_no || idata.id_no || "").substring(0, 25),
            Q_ID: isCalib ? "" : sanitizeText(comp?.q_id || meta.q_id || r.q_id || r.component_qid || idata.q_id || idata.component_qid || idata.component || "").substring(0, 16),
            CODE: isCalib ? "" : sanitizeText(comp?.code || meta.code || meta.comp_code || idata.comp_code || idata.code || "").substring(0, 2).toUpperCase(),
            COMPDESC: isCalib ? "" : sanitizeText(meta.description || meta.desc || meta.compdesc || comp?.description || comp?.name || idata.compdesc || idata.component_description || idata.description || comp?.q_id || idata.q_id || "").substring(0, 40),
            S_NODE: isCalib ? "" : sanitizeText(meta.s_node || meta.start_node || idata.s_node || idata.start_node || "").substring(0, 6),
            F_NODE: isCalib ? "" : sanitizeText(meta.f_node || meta.end_node || idata.f_node || idata.end_node || "").substring(0, 6),
            S_LEG: isCalib ? "" : sanitizeText(meta.s_leg || meta.start_leg || idata.s_leg || idata.start_leg || "").substring(0, 2),
            F_LEG: isCalib ? "" : sanitizeText(meta.f_leg || meta.end_leg || idata.f_leg || idata.end_leg || "").substring(0, 2),
            ELV_1: isCalib ? "" : (meta.elv_1 != null && meta.elv_1 !== "" ? Number(meta.elv_1) : (meta.start_elevation != null && meta.start_elevation !== "" ? Number(meta.start_elevation) : (idata.elv_1 != null && idata.elv_1 !== "" ? Number(idata.elv_1) : (idata.start_elevation != null && idata.start_elevation !== "" ? Number(idata.start_elevation) : "")))),
            ELV_2: isCalib ? "" : (meta.elv_2 != null && meta.elv_2 !== "" ? Number(meta.elv_2) : (meta.end_elevation != null && meta.end_elevation !== "" ? Number(meta.end_elevation) : (idata.elv_2 != null && idata.elv_2 !== "" ? Number(idata.elv_2) : (idata.end_elevation != null && idata.end_elevation !== "" ? Number(idata.end_elevation) : "")))),
            DIST: isCalib ? "" : (meta.dist != null && meta.dist !== "" ? Number(meta.dist) : (meta.distance != null && meta.distance !== "" ? Number(meta.distance) : (idata.dist != null && idata.dist !== "" ? Number(idata.dist) : (idata.distance != null && idata.distance !== "" ? Number(idata.distance) : "")))),
            CLK_POS: isCalib ? "" : (meta.clk_pos != null && meta.clk_pos !== "" ? (String(meta.clk_pos).toUpperCase() === "N/A" ? 0 : Number(meta.clk_pos)) : (meta.clock_position != null && meta.clock_position !== "" ? (String(meta.clock_position).toUpperCase() === "N/A" ? 0 : Number(meta.clock_position)) : (idata.clk_pos != null && idata.clk_pos !== "" ? (String(idata.clk_pos).toUpperCase() === "N/A" ? 0 : Number(idata.clk_pos)) : (idata.clock_position != null && idata.clock_position !== "" ? (String(idata.clock_position).toUpperCase() === "N/A" ? 0 : Number(idata.clock_position)) : 0)))),
            COMPTYPE: isCalib ? "" : sanitizeText(recCompTypeDesc).substring(0, 30),
            INSP_ID: r.insp_id,
            INSP_DATE: formatDateStr(r.inspection_date),
            INSP_TIME: sanitizeText(r.inspection_time || idata.insp_time || idata.time || "").substring(0, 8),
            INSPECTOR: sanitizeText(r.inspector || idata.inspector || idata.diver_name || dj?.diver_name || "").substring(0, 20),
            PROC: sanitizeText(r.procedure || idata.procedure || idata.proc || "").substring(0, 20),
            EQUIP: sanitizeText(r.equipment || idata.equipment || idata.calib_equipment_type || idata.equip || "").substring(0, 20),
            EQ_ID: sanitizeText(r.equipment_id || idata.equipment_id || idata.serial_number || idata.eq_id || "").substring(0, 20),
            SPEC: sanitizeText(r.spec || idata.spec || idata.specification || "").substring(0, 20),
            SURF_COND: sanitizeText(r.surf_cond || idata.surface_condition || idata.surf_cond || "").substring(0, 30),
            CLEAN_MET: sanitizeText(r.clean_met || idata.cleaning_method || idata.clean_met || "").substring(0, 20),
            SCAF: (idata.scaffolding || r.scaf || idata.scaf) ? "Yes" : "",
            SUPV: sanitizeText(dj?.dive_supervisor || dj?.supervisor || idata.supervisor || "").substring(0, 20),
            DIVR: sanitizeText(dj?.diver_name || idata.diver_name || idata.diver || "").substring(0, 20),
            DIVE_NO: sanitizeText(resolvedDiveNo).substring(0, 10),
            ELEVATION: isCalib ? "" : (r.elevation != null && r.elevation !== "" ? Number(r.elevation) : (idata.elevation != null && idata.elevation !== "" ? Number(idata.elevation) : "")),
            TOP_UND: isCalib ? "" : sanitizeText(meta.top_und || (Number(r.elevation || idata.elevation || 0) < 0 ? "SUBSEA" : "TOPSIDE")).substring(0, 8),
          };

          if (code === "ANS") {
            baseRow.CP_RDG = idata.cp_reading != null ? Number(idata.cp_reading) : -950;
            baseRow.ANODE_OUTPUT = idata.anode_output != null ? Number(idata.anode_output) : 450;
            baseRow.MG_THICK = idata.mg_thick != null ? Number(idata.mg_thick) : 15;
            baseRow.MEMB_CP = idata.memb_cp != null ? Number(idata.memb_cp) : -920;
            baseRow.LENGTH = idata.length != null ? Number(idata.length) : 800;
            baseRow.CIRC_C1 = sanitizeText(idata.circ_c1 || "120");
            baseRow.CIRC_C2 = sanitizeText(idata.circ_c2 || "120");
            baseRow.CIRC_C3 = sanitizeText(idata.circ_c3 || "120");
            baseRow.TYPE = sanitizeText(idata.anode_type || "Aluminium Stand-Off");
            baseRow.SECURED = idata.secured !== false ? "Yes" : "No";
            baseRow.DEPLETION = idata.depletion != null ? Number(idata.depletion) : 25;
            baseRow.TOPSTUB_CP = idata.topstub_cp != null ? Number(idata.topstub_cp) : -940;
            baseRow.BOTSTUB_CP = idata.botstub_cp != null ? Number(idata.botstub_cp) : -945;
            baseRow.AVG_PIT = idata.avg_pit != null ? Number(idata.avg_pit) : 0;
            baseRow.MAX_PIT = idata.max_pit != null ? Number(idata.max_pit) : 0;
            baseRow.AVG_DIA_PIT = idata.avg_dia_pit != null ? Number(idata.avg_dia_pit) : 0;
            baseRow.MAX_DIA_PIT = idata.max_dia_pit != null ? Number(idata.max_dia_pit) : 0;
          } else if (code === "CPS") {
            baseRow.CALIB_BLK = sanitizeText(idata.calib_block || "CB-001");
            baseRow.PRE_DIV = idata.pre_dive_cp ? Number(idata.pre_dive_cp) : -945;
            baseRow.IN_WATER1 = idata.in_water1 ? Number(idata.in_water1) : -950;
            baseRow.IN_WATER2 = idata.in_water2 ? Number(idata.in_water2) : -952;
            baseRow.IN_WATER3 = idata.in_water3 ? Number(idata.in_water3) : -948;
            baseRow.POST_DIVE = idata.post_dive_cp ? Number(idata.post_dive_cp) : -946;
            baseRow.CP_IN = idata.cp_in ? Number(idata.cp_in) : -950;
            baseRow.CP_OUT = idata.cp_out ? Number(idata.cp_out) : -940;
          } else if (code === "GVS") {
            baseRow.COAT_COND = sanitizeText(idata.coating_condition || "Intact");
            baseRow.COMP_COND = sanitizeText(idata.component_condition || "Satisfactory");
            baseRow.MARINE_GROW = idata.marine_growth_pct != null ? Number(idata.marine_growth_pct) : 80;
          } else if (code === "MGS") {
            baseRow.CP_RDG = idata.cp_reading != null ? Number(idata.cp_reading) : -950;
            baseRow.HARD_GROWTH = idata.hard_growth != null ? Number(idata.hard_growth) : 60;
            baseRow.SOFT_GROWTH = idata.soft_growth != null ? Number(idata.soft_growth) : 40;
            baseRow.COATING_DAMAGE = idata.coating_damage ? "Yes" : "No";
            baseRow.PHYSICAL_DAMAGE = idata.physical_damage ? "Yes" : "No";
            baseRow.HARD_THK3 = idata.hard_thk3 != null ? Number(idata.hard_thk3) : 15;
            baseRow.HARD_THK6 = idata.hard_thk6 != null ? Number(idata.hard_thk6) : 18;
            baseRow.HARD_THK9 = idata.hard_thk9 != null ? Number(idata.hard_thk9) : 14;
            baseRow.HARD_THK12 = idata.hard_thk12 != null ? Number(idata.hard_thk12) : 16;
            baseRow.SOFT_THK3 = idata.soft_thk3 != null ? Number(idata.soft_thk3) : 22;
            baseRow.SOFT_THK6 = idata.soft_thk6 != null ? Number(idata.soft_thk6) : 25;
            baseRow.SOFT_THK9 = idata.soft_thk9 != null ? Number(idata.soft_thk9) : 20;
            baseRow.SOFT_THK12 = idata.soft_thk12 != null ? Number(idata.soft_thk12) : 24;
            baseRow.CIRCUM_PFIVE = 450;
            baseRow.CIRCUM_NFIVE = 445;
            baseRow.CIRCUM_ZERO = 448;
            baseRow.NOM_DIA = 400;
            baseRow.HARD_CIRCUM = "Yes";
            baseRow.SOFT_CIRCUM = "Yes";
            baseRow.GROWTH_CIRCUM = 85;
            baseRow.EFF_THK = 35;
            baseRow.MG_PROFILE = 50;
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

            baseRow.FRAME_RDG = toNum(merged.frameRdgVal ?? idata.frame_rdg ?? idata.mud_mat_height);
            baseRow.BOTTM_RDG = toNum(merged.bottmRdgVal ?? idata.bottm_rdg ?? idata.bottom_reading);
            baseRow.SCOUR_RDG = toNum(merged.scourRdgVal ?? idata.scour_rdg ?? idata.scour_reading);
            baseRow.SCOUR_SIZE = sanitizeText(merged.scourSizeVal || idata.scour_size || "").substring(0, 20);
            baseRow.MID_POINT = toNum(merged.midPointVal ?? idata.mid_point ?? (String(idata.scour_location || "").toUpperCase().includes("MID") ? idata.scour_depth : ""));
            baseRow.LEG1 = sanitizeText(merged.startLegVal || idata.leg1 || idata.start_leg || meta.s_leg || meta.start_leg || comp?.s_leg || "").substring(0, 20);
            baseRow.LEG2 = sanitizeText(merged.endLegVal || idata.leg2 || idata.end_leg || meta.f_leg || meta.end_leg || comp?.f_leg || "").substring(0, 20);
            baseRow.EXP_PILE_LEG1 = sanitizeText(merged.expPileLeg1Val || idata.exp_pile_leg1 || (String(idata.scour_location || "").toUpperCase().includes("START") && (idata.exposed_pile || idata.Exposed_pile) ? "YES" : "NO")).substring(0, 3);
            baseRow.EXP_PILE_LEG2 = sanitizeText(merged.expPileLeg2Val || idata.exp_pile_leg2 || (String(idata.scour_location || "").toUpperCase().includes("END") && (idata.exposed_pile || idata.Exposed_pile) ? "YES" : "NO")).substring(0, 3);
            baseRow.DEPTH1 = toNum(merged.depth1Val ?? idata.depth1 ?? (String(idata.scour_location || "").toUpperCase().includes("START") ? idata.scour_depth : ""));
            baseRow.DEPTH2 = toNum(merged.depth2Val ?? idata.depth2 ?? (String(idata.scour_location || "").toUpperCase().includes("END") ? idata.scour_depth : ""));
          } else if (code === "DBS") {
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

            if (isRovDebrisAppend) {
              baseRow.SIDE = "";
              baseRow.DISTANC = "";
              baseRow.CP_CURR = "";
              baseRow.DAMAGE = "";
              baseRow.REMOVED = "";
              baseRow.LENGTH = "";
              baseRow.HEIGHT = "";
              baseRow.WIDTH = "";
              baseRow.ITEM = sanitizeText(idata.debris || idata.debris_item || idata.item || idata.material || "").substring(0, 20);
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
              baseRow.ITEM = sanitizeText(idata.debris_item || idata.debris || idata.item || "").substring(0, 20);
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
            const dj = r.dive_job_id ? diveJobMap.get(Number(r.dive_job_id)) : null;
            const tape = r.dive_job_id ? videoTapeMapByDiveJobId.get(Number(r.dive_job_id)) : null;
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
            baseRow.SUPV = sanitizeText(dj?.dive_supervisor || dj?.supervisor || "").substring(0, 20);
            baseRow.DIVR = sanitizeText(dj?.diver_name || "").substring(0, 20);
            baseRow.DIVE_NO = sanitizeText(dj?.dive_no || dj?.job_no || (r.dive_job_id ? String(r.dive_job_id) : "")).substring(0, 10);
            baseRow.ELEVATION = "";
            baseRow.TOP_UND = "";

            baseRow.LIGHT_METHOD = "";
            baseRow.TAPE_TYPE = sanitizeText(tape?.tape_type || idata.tape_type || "").substring(0, 20);
            baseRow.TAPE_NO = sanitizeText(tape?.tape_no || idata.tape_no || "").substring(0, 20);

            const subjectParts = [tape?.remarks, videoLog?.event_type || idata.subject].filter(Boolean);
            baseRow.SUBJECT = sanitizeText(subjectParts.join(" ") || "").substring(0, 30);
            baseRow.TAPE_FOOTAGE = sanitizeText(videoLog?.timecode_start ? formatTimeStr(videoLog.timecode_start) : (idata.tape_footage || "")).substring(0, 30);
            baseRow.TAPE_PERMIT_ISSUE_DATE = "";
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

          baseRow.DEFECT = r.has_anomaly === true || Boolean(linkedAnom) ? "Yes" : "No";
          baseRow.DFT_CODE_TYPE = sanitizeText(linkedAnom?.defect_type_code || (["AFS", "CVS", "BSS", "RSS", "MPS", "CCS", "PHS", "VDS", "UTS", "FDS"].includes(code) ? "" : (linkedAnom?.defect_type_code || linkedAnom?.defect_category_code || (linkedAnom ? "AW" : "")))).substring(0, 12);
          baseRow.DEFECT_CODE = sanitizeText(linkedAnom?.defect_category_code || linkedAnom?.defect_code || "").substring(0, 50);
          baseRow.DEFECT_TYPE = sanitizeText(linkedAnom?.priority_code || (["AFS", "CVS", "BSS", "RSS", "MPS", "CCS", "PHS", "VDS", "UTS", "FDS"].includes(code) ? "" : (linkedAnom?.priority_code || linkedAnom?.priority || (linkedAnom ? "P3" : "")))).substring(0, 20);
          baseRow.DEFECT_DESC = sanitizeText(linkedAnom?.defect_description || linkedAnom?.description || "").substring(0, 250);
          baseRow.DFT_REF_NO = sanitizeText(linkedAnom?.anomaly_ref_no || "").substring(0, 30);
          baseRow.RECTIFID = linkedAnom?.is_rectified === true ? "Yes" : (["AFS", "CVS", "BSS", "RSS", "MPS", "CCS", "PHS", "VDS", "UTS", "FDS"].includes(code) ? "No" : (code === "DBS" || code === "SCS" ? (linkedAnom?.is_rectified ? "Yes" : "No") : (linkedAnom?.status === "CLOSED" ? "Yes" : "No")));
          baseRow.RECTIFID_DESC = sanitizeText(linkedAnom?.rectified_remarks || (["AFS", "CVS", "BSS", "RSS", "MPS", "CCS", "PHS", "VDS", "UTS", "FDS"].includes(code) ? "" : (code === "DBS" || code === "SCS" ? (linkedAnom?.rectified_remarks || "") : (linkedAnom?.follow_up_notes || "")))).substring(0, 250);
          baseRow.RECT_DATE = linkedAnom?.rectified_date ? formatDateStr(linkedAnom.rectified_date) : "";
          baseRow.INSPNO = formatInspNo(r.jobpack_id || jp?.id);
          baseRow.JOBNAME = sanitizeText(jp?.name || `JP-${r.jobpack_id || 1}`).substring(0, 20);
          baseRow.STATUS = sanitizeText(jp?.status || "OPEN").substring(0, 10).toUpperCase();
          baseRow.INSP_DONE = String(r.status || "").toUpperCase() === "COMPLETED" ? "Yes" : (String(r.status || "").toUpperCase() === "INCOMPLETE" ? "No" : "No");
          baseRow.REC_DATE = formatDateStr(r.md_date || r.inspection_date);
          baseRow.INSP_COND = sanitizeText(r.description || idata.findings || idata.observations || "").substring(0, 1000);
          baseRow.CMNTS = code === "BSS" || code === "SZS" || code === "VDS" || code === "DBS" || code === "SCS" ? "" : sanitizeText(r.comments || idata.comments || idata.cmnts || "").substring(0, 4000);
          baseRow.JOB_TYPE = sanitizeText(resolvedJobType).substring(0, 20);
          baseRow.LAST_MAJOR_INSPNO = code === "DBS" || code === "SCS" ? "" : sanitizeText(jp?.last_insp_no || "").substring(0, 11);
          baseRow.INSPTYPE = code === "MPS" ? (isAcfmInsp ? "AFS" : "MPS") : (code === "UTS" ? (isSzoneInsp ? "SZS" : "UTS") : (code === "FDS" ? (isRfmdInsp ? "PGS" : "FDS") : (code === "DBS" ? (isRovDebrisAppend ? "PGS" : "DBS") : (code === "SCS" ? (isRovScourAppend ? "PGS" : "SCS") : code))));
          baseRow.EVAL_BY = sanitizeText(linkedAnom?.reviewed_by || (["ITS", "SZS", "AFS", "CVS", "BSS", "RSS", "MPS", "CCS", "PHS", "VDS", "UTS", "FDS"].includes(code) ? "" : (code === "DBS" || code === "SCS" ? (linkedAnom?.reviewed_by || "") : (linkedAnom?.evaluated_by || "")))).substring(0, 250);
          baseRow.APPROV_BY = sanitizeText(linkedAnom?.approved_by || "").substring(0, 250);

          if (code === "SZS" || code === "BSS" || code === "VDS" || code === "DBS" || code === "SCS") {
            baseRow.CMNTS = "";
          }

          sheetRows.push(baseRow);
        });
      }

      const formattedBaseName = `${dateFormattedYymmdd}-01-${code}`;
      const txtFileName = `${formattedBaseName}.txt`;
      const xlsxFileName = `${formattedBaseName}.xlsx`;
      const csvFileName = `${formattedBaseName}.csv`;
      
      // 1. Build Tab-Delimited text content
      const headers = sheetDef.columns.map((c) => c.header);
      const textLines: string[] = [headers.join("\t")];
      sheetRows.forEach((row) => {
        const rowVals = sheetDef.columns.map((c) => {
          const val = row[c.key] ?? row[c.header];
          return sanitizeText(cleanCellValue(val));
        });
        textLines.push(rowVals.join("\t"));
      });
      const textContent = textLines.join("\r\n");

      // 2. Build Comma-Delimited CSV content
      const csvLines: string[] = [sheetDef.columns.map((c) => escapeCsvValue(c.header)).join(",")];
      sheetRows.forEach((row) => {
        const rowVals = sheetDef.columns.map((c) => {
          const val = row[c.key] ?? row[c.header];
          return escapeCsvValue(cleanCellValue(val));
        });
        csvLines.push(rowVals.join(","));
      });
      const csvContent = csvLines.join("\r\n");

      // 3. Build Individual XLSX Buffer (Always print the column header for each column as the first row even if 0 records exist)
      const aoaRows: any[][] = [
        headers,
        ...sheetRows.map((row) =>
          sheetDef.columns.map((c) => {
            const val = row[c.key] ?? row[c.header];
            return cleanCellValue(val);
          })
        ),
      ];

      const singleWb = XLSX.utils.book_new();
      const singleWs = XLSX.utils.aoa_to_sheet(aoaRows);
      singleWs["!cols"] = sheetDef.columns.map((c) => ({ wch: Math.max(c.width || 14, (c.header || "").length + 2) }));
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
        columns: sheetDef.columns,
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
            // Consolidated single .xlsx with multiple tabs
            const combinedWb = XLSX.utils.book_new();
            tablesOutput.forEach((tbl) => {
              const tblHeaders = tbl.columns.map((c: any) => c.header);
              const aoaData: any[][] = [
                tblHeaders,
                ...tbl.rows.map((row: any) =>
                  tbl.columns.map((c: any) => {
                    const val = row[c.key] ?? row[c.header];
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
        const tblHeaders = tbl.columns.map((c: any) => c.header);
        const aoaData: any[][] = [
          tblHeaders,
          ...tbl.rows.map((row: any) =>
            tbl.columns.map((c: any) => {
              const val = row[c.key] ?? row[c.header];
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
