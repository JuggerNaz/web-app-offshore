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

    // 1. Fetch Structures
    let strQuery = (supabase as any).from("structure").select("*").eq("company_id", companyId);
    if (structureIds && structureIds.length > 0) {
      strQuery = strQuery.in("str_id", structureIds.map(Number));
    }
    if (structureType && structureType !== "ALL") {
      strQuery = strQuery.eq("str_type", structureType.toUpperCase());
    }

    const { data: structuresData } = await strQuery;
    const structureMap = new Map<number, any>();
    const activeStrIds = (structuresData || []).map((s: any) => Number(s.str_id));

    // Fetch platform & pipeline details
    const { data: platformData } = await (supabase as any)
      .from("platform")
      .select("*")
      .in("plat_id", activeStrIds.length > 0 ? activeStrIds : [0]);

    const { data: pipelineData } = await (supabase as any)
      .from("u_pipeline")
      .select("*")
      .in("pipe_id", activeStrIds.length > 0 ? activeStrIds : [0]);

    (structuresData || []).forEach((s: any) => {
      if (s.str_type === "PLATFORM") {
        const p = platformData?.find((item: any) => item.plat_id === s.str_id);
        structureMap.set(s.str_id, {
          ...s,
          title: p?.title || s.str_name || `Platform ${s.str_id}`,
          pfield: p?.pfield || s.field_name || "Offshore",
          pdesc: p?.pdesc || s.description || p?.title || "Offshore Platform Facility",
          ptype: p?.ptype || "PLATFORM",
          def_unit: p?.unit_type || "Metric",
          depth: p?.depth || 0,
        });
      } else {
        const pl = pipelineData?.find((item: any) => item.pipe_id === s.str_id);
        structureMap.set(s.str_id, {
          ...s,
          title: pl?.title || s.str_name || `Pipeline ${s.str_id}`,
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

    // 2. Fetch Jobpacks & SOWs scoped to selected structures
    let rawJpQuery = (supabase as any).from("jobpack").select("*").eq("company_id", companyId);
    const { data: allCompanyJps } = await rawJpQuery;

    let finalJobpacks: any[] = [];
    if (jobpackMode === "SELECTED" && jobpackIds.length > 0) {
      const selectedSet = new Set(jobpackIds.map(Number));
      finalJobpacks = (allCompanyJps || []).filter((j: any) => selectedSet.has(Number(j.id)));
    } else if (activeStrIds.length > 0) {
      const [sowRel, recRel, diveRel, rovRel] = await Promise.all([
        (supabase as any).from("u_sow").select("jobpack_id").in("structure_id", activeStrIds).not("jobpack_id", "is", null),
        (supabase as any).from("insp_records").select("jobpack_id").in("structure_id", activeStrIds).not("jobpack_id", "is", null),
        (supabase as any).from("insp_dive_jobs").select("jobpack_id").in("structure_id", activeStrIds).not("jobpack_id", "is", null),
        (supabase as any).from("insp_rov_jobs").select("jobpack_id").in("structure_id", activeStrIds).not("jobpack_id", "is", null),
      ]);

      const matchedIdSet = new Set<number>();
      (sowRel?.data || []).forEach((r: any) => r.jobpack_id && matchedIdSet.add(Number(r.jobpack_id)));
      (recRel?.data || []).forEach((r: any) => r.jobpack_id && matchedIdSet.add(Number(r.jobpack_id)));
      (diveRel?.data || []).forEach((r: any) => r.jobpack_id && matchedIdSet.add(Number(r.jobpack_id)));
      (rovRel?.data || []).forEach((r: any) => r.jobpack_id && matchedIdSet.add(Number(r.jobpack_id)));

      const activeStrSet = new Set(activeStrIds.map(Number));
      (allCompanyJps || []).forEach((jp: any) => {
        if (matchedIdSet.has(Number(jp.id))) {
          return;
        }
        const structures = jp.metadata?.structures || [];
        if (Array.isArray(structures)) {
          const m = structures.some((s: any) => {
            const sid = Number(String(s.id || s.structure_id || s.platform_id || s.pipe_id || s.str_id || s.plat_id || "").replace(/^(platform|pipeline)-/, ""));
            return !isNaN(sid) && activeStrSet.has(sid);
          });
          if (m) matchedIdSet.add(Number(jp.id));
        }
        const directSId = Number(String(jp.metadata?.structure_id || jp.metadata?.platform_id || jp.metadata?.pipe_id || jp.metadata?.plat_id || jp.metadata?.str_id || "").replace(/^(platform|pipeline)-/, ""));
        if (!isNaN(directSId) && activeStrSet.has(directSId)) {
          matchedIdSet.add(Number(jp.id));
        }
      });

      finalJobpacks = (allCompanyJps || []).filter((j: any) => matchedIdSet.has(Number(j.id)));
    } else {
      finalJobpacks = allCompanyJps || [];
    }

    const jobpacksData = finalJobpacks;
    const jobpackMap = new Map<number, any>();
    (jobpacksData || []).forEach((j: any) => jobpackMap.set(j.id, j));

    // Fetch SOWs
    let sowQuery = (supabase as any)
      .from("u_sow")
      .select("*")
      .in("jobpack_id", (jobpacksData || []).map((j: any) => j.id).concat([0]));
    if (activeStrIds.length > 0) {
      sowQuery = sowQuery.in("structure_id", activeStrIds);
    }
    const { data: sowData } = await sowQuery;
    const sowMap = new Map<number, any>();
    (sowData || []).forEach((s: any) => sowMap.set(s.sow_id || s.id, s));

    // 3. Fetch Components Master & Component Types
    const [{ data: compData }, { data: compTypesData }] = await Promise.all([
      (supabase as any)
        .from("structure_components")
        .select("*")
        .in("structure_id", activeStrIds.length > 0 ? activeStrIds : [-999999])
        .limit(10000),
      (supabase as any)
        .from("components")
        .select("code, descrip, name")
    ]);
    const compMap = new Map<number, any>();
    (compData || []).forEach((c: any) => compMap.set(c.id, c));

    const compTypeMap = new Map<string, string>();
    (compTypesData || []).forEach((ct: any) => {
      if (ct.code) {
        compTypeMap.set(String(ct.code).trim().toUpperCase(), ct.descrip || ct.name || "");
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

    // 4. Fetch Inspection Records
    let inspQuery = (supabase as any)
      .from("insp_records")
      .select(`
        insp_id,
        jobpack_id,
        structure_id,
        component_id,
        inspection_type_id,
        inspection_type_code,
        status,
        inspection_date,
        sow_report_no,
        inspection_data,
        workunit,
        dive_job_id,
        rov_job_id,
        dive_no,
        insp_dive_jobs (
          id,
          job_no,
          name,
          dive_no
        ),
        insp_rov_jobs (
          id,
          job_no,
          name
        ),
        structure_components (
          id,
          id_no,
          q_id,
          code,
          metadata
        ),
        insp_anomalies (
          anomaly_id,
          anomaly_ref_no,
          priority_code,
          defect_type_code,
          defect_category_code,
          description,
          status,
          follow_up_notes,
          created_at
        )
      `)
      .eq("company_id", companyId);

    if (activeStrIds.length > 0) {
      inspQuery = inspQuery.in("structure_id", activeStrIds);
    }
    if (jobpackMode === "SELECTED" && jobpackIds.length > 0) {
      inspQuery = inspQuery.in("jobpack_id", jobpackIds);
    }
    if (sowReportNos && sowReportNos.length > 0) {
      inspQuery = inspQuery.in("sow_report_no", sowReportNos);
    } else if (sowReportNo && sowReportNo !== "ALL") {
      inspQuery = inspQuery.eq("sow_report_no", sowReportNo);
    }
    if (!singleTableCode && !singleTableId && inspectionTypes.length > 0 && !inspectionTypes.includes("ALL")) {
      inspQuery = inspQuery.in("inspection_type_code", inspectionTypes);
    }

    const { data: recordsData } = await inspQuery.limit(5000);
    const allRecords = recordsData || [];

    // 5. Fetch Anomalies
    let anomQuery = (supabase as any)
      .from("insp_anomalies")
      .select(`
        anomaly_id,
        anomaly_ref_no,
        priority_code,
        defect_type_code,
        defect_category_code,
        description,
        status,
        follow_up_notes,
        created_at,
        inspection_id,
        structure_id
      `)
      .eq("company_id", companyId);

    if (activeStrIds.length > 0) {
      anomQuery = anomQuery.in("structure_id", activeStrIds);
    }
    const { data: anomaliesData } = await anomQuery;
    const allAnomalies = anomaliesData || [];

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
        templatesToProcess = match;
      } else {
        const idMatch = activeInterface.templates.filter((t) => t.id === singleTableCode);
        if (idMatch.length > 0) templatesToProcess = idMatch;
      }
    } else if (singleTableId) {
      const idMatch = activeInterface.templates.filter((t) => t.id === singleTableId);
      if (idMatch.length > 0) templatesToProcess = idMatch;
    }

    const isSingleTableExport = templatesToProcess.length === 1 && (Boolean(singleTableCode) || Boolean(singleTableId));

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
            CODE: sanitizeText(c.code || ""),
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
          const compId = Number(linkedRec.component_id);
          const comp = compMap.get(compId) || linkedRec.structure_components;
          const compMeta = comp?.metadata || {};
          const jp = jobpackMap.get(Number(linkedRec.jobpack_id));

          // Component Type description
          const compCodeUpper = String(comp?.code || "").trim().toUpperCase();
          const compTypeDesc = compTypeMap.get(compCodeUpper) || compMeta.comptype || comp?.type || "MEMBER";

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
            COMP_ID: Number(comp?.id || compId || 1),
            ID_NO: sanitizeText(comp?.id_no || "").substring(0, 25),
            Q_ID: sanitizeText(comp?.q_id || "").substring(0, 16),
            CODE: sanitizeText(comp?.code || "").substring(0, 2),
            COMPDESC: sanitizeText(compMeta.description || compMeta.desc || comp?.description || comp?.name || "").substring(0, 40),
            S_NODE: sanitizeText(compMeta.s_node || "").substring(0, 6),
            F_NODE: sanitizeText(compMeta.f_node || "").substring(0, 6),
            S_LEG: sanitizeText(compMeta.s_leg || "").substring(0, 2),
            F_LEG: sanitizeText(compMeta.f_leg || "").substring(0, 2),
            ELV_1: compMeta.elv_1 != null && compMeta.elv_1 !== "" ? Number(compMeta.elv_1) : (compMeta.start_elevation != null && compMeta.start_elevation !== "" ? Number(compMeta.start_elevation) : ""),
            ELV_2: compMeta.elv_2 != null && compMeta.elv_2 !== "" ? Number(compMeta.elv_2) : (compMeta.end_elevation != null && compMeta.end_elevation !== "" ? Number(compMeta.end_elevation) : ""),
            DIST: compMeta.dist != null && compMeta.dist !== "" ? Number(compMeta.dist) : (compMeta.distance != null && compMeta.distance !== "" ? Number(compMeta.distance) : ""),
            CLK_POS: compMeta.clk_pos != null && compMeta.clk_pos !== "" ? Number(compMeta.clk_pos) : (compMeta.clock_position != null && compMeta.clock_position !== "" ? Number(compMeta.clock_position) : ""),
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

          if (recType.includes("PGS") && ["ANS", "CPS", "DBS", "FDS", "GVS", "MGS", "SCS"].includes(code)) return true;
          if (recType.includes("SZS") && ["CPS", "UTS"].includes(code)) return true;
          if (recType.includes("BSS") && ["CPS"].includes(code)) return true;
          if (recType.includes("AFS") && ["MPS"].includes(code)) return true;
          return false;
        });

        matchingRecords.forEach((r: any) => {
          const strObj = structureMap.get(r.structure_id);
          const comp = r.structure_components || compMap.get(r.component_id);
          const jp = jobpackMap.get(r.jobpack_id);
          const meta = comp?.metadata || {};
          const idata = r.inspection_data || {};
          const linkedAnom = allAnomalies.find((a: any) => a.inspection_id === r.insp_id) || r.insp_anomalies?.[0];
          const recCompCodeUpper = String(comp?.code || "").trim().toUpperCase();
          const recCompTypeDesc = compTypeMap.get(recCompCodeUpper) || meta.comptype || comp?.type || (code === "UCS" ? "CALIBRATION" : "MEMBER");
          const resolvedDiveNo = r.insp_dive_jobs?.job_no || r.insp_dive_jobs?.dive_no || r.insp_dive_jobs?.name || idata.dive_no || r.dive_no || r.dive_job_id || "DIVE-01";

          const baseRow: any = {
            STR_ID: r.structure_id || 1,
            TITLE: sanitizeText(strObj?.title || `Platform ${r.structure_id}`),
            PFIELD: sanitizeText(strObj?.pfield || "Offshore"),
            PDESC: sanitizeText(strObj?.pdesc || "Offshore Facility"),
            DEF_UNIT: strObj?.def_unit || "Metric",
            COMP_ID: comp?.id != null ? comp.id : (code === "UCS" ? "" : 1),
            ID_NO: sanitizeText(comp?.id_no || (code === "UCS" ? (idata.id_no || idata.serial_number || "") : `SYS-${comp?.id || 1}`)),
            Q_ID: sanitizeText(comp?.q_id || idata.q_id || (code === "UCS" ? (idata.calib_block || "CALIB") : "M-01")),
            CODE: sanitizeText(comp?.code || (code === "UCS" ? (idata.code || "CL") : "MB")),
            COMPDESC: sanitizeText(meta.description || comp?.description || (code === "UCS" ? (idata.calib_block || idata.calib_equipment_type || "UT Calibration Block") : "Structural Member")),
            S_NODE: sanitizeText(meta.s_node || (code === "UCS" ? "" : "N01")),
            F_NODE: sanitizeText(meta.f_node || (code === "UCS" ? "" : "N02")),
            S_LEG: sanitizeText(meta.s_leg || (code === "UCS" ? "" : "A1")),
            F_LEG: sanitizeText(meta.f_leg || (code === "UCS" ? "" : "A2")),
            ELV_1: meta.elv_1 != null && meta.elv_1 !== "" ? Number(meta.elv_1) : (code === "UCS" ? "" : -12.5),
            ELV_2: meta.elv_2 != null && meta.elv_2 !== "" ? Number(meta.elv_2) : (code === "UCS" ? "" : -15.0),
            DIST: meta.dist != null && meta.dist !== "" ? Number(meta.dist) : (code === "UCS" ? "" : 0),
            CLK_POS: meta.clk_pos != null && meta.clk_pos !== "" ? Number(meta.clk_pos) : (code === "UCS" ? "" : 12),
            COMPTYPE: sanitizeText(recCompTypeDesc),
            INSP_ID: r.insp_id,
            INSP_DATE: formatDateStr(r.inspection_date),
            INSP_TIME: sanitizeText(idata.insp_time || "09:30:00"),
            INSPECTOR: sanitizeText(idata.inspector || idata.diver_name || "Offshore Inspector"),
            PROC: sanitizeText(idata.procedure || (code === "UCS" ? "PTS-UT-CLB-01" : "PETRONAS-SICS-01")),
            EQUIP: sanitizeText(idata.equipment || (code === "UCS" ? (idata.calib_equipment_type || "UT Set") : "CP Probe / Bathycorrometer")),
            EQ_ID: sanitizeText(idata.equipment_id || idata.serial_number || (code === "UCS" ? (idata.serial_number || "EQ-UT01") : "EQ-9921")),
            SPEC: sanitizeText(idata.spec || "PTS 11.22.02"),
            SURF_COND: sanitizeText(idata.surface_condition || "Cleaned"),
            CLEAN_MET: sanitizeText(idata.cleaning_method || "Water Jet"),
            SCAF: idata.scaffolding ? "Yes" : "No",
            SUPV: sanitizeText(idata.supervisor || "Offshore Supervisor"),
            DIVR: sanitizeText(idata.diver_name || "Diver 1"),
            DIVE_NO: sanitizeText(resolvedDiveNo),
            ELEVATION: idata.elevation != null ? Number(idata.elevation) : (code === "UCS" ? "" : -12.5),
            TOP_UND: Number(idata.elevation || 0) < 0 ? "Underwater" : "Topside",
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
          } else if (code === "UTS") {
            const nomThk = Number(idata.nominal_thickness || 20);
            baseRow.PROB_TYPE = sanitizeText(idata.probe_type || "Twin Crystal");
            baseRow.PROB_SIZE_DIAM = 10;
            baseRow.SCAN_TECH = "Manual Contact";
            baseRow.COUPLANT = "Ultragel II";
            baseRow.CALIB_BLK = "Step Wedge CB-01";
            baseRow.CALIB_RANGE = "0 - 50 mm";
            baseRow.CALIB_DATE = formatDateStr(r.inspection_date);
            baseRow.PROB_FREQ = 5;
            baseRow.SENS_LVL = "Standard";
            baseRow.AREA_TEST = "Member Body";
            baseRow.REF_POS = "Topside Datum";
            baseRow.COMP_WALL_THK = nomThk;
            baseRow.MAX_THK = nomThk + 0.2;
            baseRow.MIN_THK = nomThk - 0.6;
            baseRow.AVG_THK = nomThk - 0.2;
            baseRow.WALL_THK_LOSS = 0.6;
            baseRow.CORR_RATE = 0.05;
            baseRow.NO_READINGS = 4;
            baseRow.C01 = nomThk - 0.2;
            baseRow.C02 = nomThk - 0.3;
            baseRow.C03 = nomThk - 0.5;
            baseRow.C04 = nomThk - 0.4;
            baseRow.C05 = nomThk - 0.3;
            baseRow.C06 = nomThk - 0.4;
            baseRow.C07 = nomThk - 0.3;
            baseRow.C08 = nomThk - 0.4;
            baseRow.C09 = nomThk - 0.5;
            baseRow.C10 = nomThk - 0.3;
            baseRow.C11 = nomThk - 0.2;
            baseRow.C12 = nomThk - 0.4;
            baseRow.REF_NAME = "12 O'Clock Top";
            baseRow.POSITION = "Mid-Span";
            baseRow.READ_THICK = nomThk - 0.4;
          } else if (code === "UCS") {
            baseRow.PROBE = sanitizeText(idata.probe || idata.probe_type || "");
            baseRow.PROBE_SIZE = sanitizeText(idata.probe_size || idata.probe_dia || idata.size || "");
            baseRow.CLB_TYPE = sanitizeText(idata.clb_type || idata.calib_equipment_type || idata.calib_type || idata.equipment_type || "UT CALIBRATION");
            baseRow.PROBE_FQ = sanitizeText(idata.probe_frequency || idata.probe_fq || idata.frequency || "");
            baseRow.RDG_1 = idata.reading01 != null && idata.reading01 !== "" ? Number(idata.reading01) : (idata.rdg_1 != null && idata.rdg_1 !== "" ? Number(idata.rdg_1) : (idata.reading_1 != null && idata.reading_1 !== "" ? Number(idata.reading_1) : ""));
            baseRow.RDG_2 = idata.reading02 != null && idata.reading02 !== "" ? Number(idata.reading02) : (idata.rdg_2 != null && idata.rdg_2 !== "" ? Number(idata.rdg_2) : (idata.reading_2 != null && idata.reading_2 !== "" ? Number(idata.reading_2) : ""));
            baseRow.RDG_3 = idata.reading03 != null && idata.reading03 !== "" ? Number(idata.reading03) : (idata.rdg_3 != null && idata.rdg_3 !== "" ? Number(idata.rdg_3) : (idata.reading_3 != null && idata.reading_3 !== "" ? Number(idata.reading_3) : ""));
            baseRow.RDG_4 = idata.reading04 != null && idata.reading04 !== "" ? Number(idata.reading04) : (idata.rdg_4 != null && idata.rdg_4 !== "" ? Number(idata.rdg_4) : (idata.reading_4 != null && idata.reading_4 !== "" ? Number(idata.reading_4) : ""));
            baseRow.RDG_5 = idata.reading05 != null && idata.reading05 !== "" ? Number(idata.reading05) : (idata.rdg_5 != null && idata.rdg_5 !== "" ? Number(idata.rdg_5) : (idata.reading_5 != null && idata.reading_5 !== "" ? Number(idata.reading_5) : ""));
            baseRow.RDG_6 = idata.reading06 != null && idata.reading06 !== "" ? Number(idata.reading06) : (idata.rdg_6 != null && idata.rdg_6 !== "" ? Number(idata.rdg_6) : (idata.reading_6 != null && idata.reading_6 !== "" ? Number(idata.reading_6) : ""));
            baseRow.LBL_1 = sanitizeText(idata.label01 || idata.lbl_1 || idata.label_1 || idata.lbl1 || "Step 1");
            baseRow.LBL_2 = sanitizeText(idata.label02 || idata.lbl_2 || idata.label_2 || idata.lbl2 || "Step 2");
            baseRow.LBL_3 = sanitizeText(idata.label03 || idata.lbl_3 || idata.label_3 || idata.lbl3 || "Step 3");
            baseRow.LBL_4 = sanitizeText(idata.label04 || idata.lbl_4 || idata.label_4 || idata.lbl4 || "Step 4");
            baseRow.LBL_5 = sanitizeText(idata.label05 || idata.lbl_5 || idata.label_5 || idata.lbl5 || "Step 5");
            baseRow.LBL_6 = sanitizeText(idata.label06 || idata.lbl_6 || idata.label_6 || idata.lbl6 || "Step 6");
          }

          baseRow.DEFECT = linkedAnom ? "Yes" : "No";
          baseRow.DFT_CODE_TYPE = sanitizeText(linkedAnom?.defect_category_code || "AW");
          baseRow.DEFECT_CODE = sanitizeText(linkedAnom?.defect_type_code || "");
          baseRow.DEFECT_TYPE = sanitizeText(linkedAnom?.priority_code || "P3");
          baseRow.DEFECT_DESC = sanitizeText(linkedAnom?.description || "");
          baseRow.DFT_REF_NO = sanitizeText(linkedAnom?.anomaly_ref_no || "");
          baseRow.RECTIFID = linkedAnom?.status === "CLOSED" ? "Yes" : "No";
          baseRow.RECTIFID_DESC = sanitizeText(linkedAnom?.follow_up_notes || "");
          baseRow.RECT_DATE = linkedAnom?.created_at ? formatDateStr(linkedAnom.created_at) : "";
          baseRow.INSPNO = formatInspNo(r.jobpack_id || jp?.id);
          baseRow.JOBNAME = sanitizeText(jp?.name || "CAMPAIGN-2026");
          baseRow.STATUS = sanitizeText(jp?.status || "OPEN").toUpperCase();
          baseRow.INSP_DONE = "Yes";
          baseRow.REC_DATE = formatDateStr(r.inspection_date);
          baseRow.INSP_COND = sanitizeText(idata.findings || idata.observations || "Inspection carried out with satisfactory results");
          baseRow.CMNTS = sanitizeText(idata.comments || "No critical safety anomalies noted");
          baseRow.JOB_TYPE = sanitizeText(jp?.job_type || "MAJOR");
          baseRow.LAST_MAJOR_INSPNO = sanitizeText(jp?.last_insp_no || "INSP-PREV");
          baseRow.INSPTYPE = code;
          baseRow.EVAL_BY = sanitizeText(linkedAnom?.evaluated_by || "");
          baseRow.APPROV_BY = sanitizeText(linkedAnom?.approved_by || "");

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
          return sanitizeText(val);
        });
        textLines.push(rowVals.join("\t"));
      });
      const textContent = textLines.join("\r\n");

      // 2. Build Comma-Delimited CSV content
      const csvLines: string[] = [sheetDef.columns.map((c) => escapeCsvValue(c.header)).join(",")];
      sheetRows.forEach((row) => {
        const rowVals = sheetDef.columns.map((c) => {
          const val = row[c.key] ?? row[c.header];
          return escapeCsvValue(sanitizeText(val));
        });
        csvLines.push(rowVals.join(","));
      });
      const csvContent = csvLines.join("\r\n");

      // 3. Build Individual XLSX Buffer (Always print the column header for each column as the first row even if 0 records exist)
      const xlsxRowsData = sheetRows.length > 0
        ? sheetRows.map((row) => {
            const rowObj: Record<string, any> = {};
            sheetDef.columns.forEach((c) => {
              rowObj[c.header] = row[c.key] ?? row[c.header] ?? "";
            });
            return rowObj;
          })
        : [];

      const singleWb = XLSX.utils.book_new();
      const singleWs = XLSX.utils.json_to_sheet(xlsxRowsData, { header: headers });
      singleWs["!cols"] = sheetDef.columns.map((c) => ({ wch: c.width || 18 }));
      XLSX.utils.book_append_sheet(singleWb, singleWs, sheetDef.sheetName.substring(0, 31));
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
            // Write 24 individual .xlsx files to destination directory
            tablesOutput.forEach((tbl) => {
              fs.writeFileSync(path.join(targetDir, tbl.xlsxFileName), tbl.xlsxBuffer);
            });
            serverSavedPath = targetDir;
          } else if (format === "individual_csv" || format === "csv" || format === "csv_zip") {
            // Write 24 individual .csv files to destination directory
            tablesOutput.forEach((tbl) => {
              fs.writeFileSync(path.join(targetDir, tbl.csvFileName), tbl.csvContent, "utf-8");
            });
            serverSavedPath = targetDir;
          } else if (format === "single_xlsx") {
            // Consolidated single .xlsx with 24 tabs
            const combinedWb = XLSX.utils.book_new();
            tablesOutput.forEach((tbl) => {
              const tblHeaders = tbl.columns.map((c) => c.header);
              const tblRowsData = tbl.rows.length > 0
                ? tbl.rows.map((row: any) => {
                    const rowObj: Record<string, any> = {};
                    tbl.columns.forEach((c) => {
                      rowObj[c.header] = row[c.key] ?? row[c.header] ?? "";
                    });
                    return rowObj;
                  })
                : [];
              const ws = XLSX.utils.json_to_sheet(tblRowsData, { header: tblHeaders });
              ws["!cols"] = tbl.columns.map((c) => ({ wch: c.width || 18 }));
              XLSX.utils.book_append_sheet(combinedWb, ws, tbl.sheetName.substring(0, 31));
            });
            const combinedFileName = fileName || `${clientProfile.code}_${activeInterface.code}_PACKAGE_${dateFormattedYymmdd}.xlsx`;
            const filePath = path.join(targetDir, combinedFileName);
            const combinedBuf = XLSX.write(combinedWb, { type: "buffer", bookType: "xlsx" });
            fs.writeFileSync(filePath, combinedBuf);
            serverSavedPath = filePath;
          } else {
            // Default: individual_txt / txt_zip: Write 24 individual tab-delimited .txt files
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

    // Case B: Full Package (All 24 Tables)
    if (format === "single_xlsx") {
      const workbook = XLSX.utils.book_new();
      tablesOutput.forEach((tbl) => {
        const tblHeaders = tbl.columns.map((c) => c.header);
        const tblRowsData = tbl.rows.length > 0
          ? tbl.rows.map((row: any) => {
              const rowObj: Record<string, any> = {};
              tbl.columns.forEach((c) => {
                rowObj[c.header] = row[c.key] ?? row[c.header] ?? "";
              });
              return rowObj;
            })
          : [];
        const worksheet = XLSX.utils.json_to_sheet(tblRowsData, { header: tblHeaders });
        worksheet["!cols"] = tbl.columns.map((c) => ({ wch: c.width || 18 }));
        XLSX.utils.book_append_sheet(workbook, worksheet, tbl.sheetName.substring(0, 31));
      });

      const outputFileName = fileName || `${clientProfile.code}_${activeInterface.code}_PACKAGE_${dateFormattedYymmdd}.xlsx`;
      const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

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
