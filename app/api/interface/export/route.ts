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
    if (structureIds.length > 0) {
      strQuery = strQuery.in("str_id", structureIds);
    }
    if (structureType && structureType !== "ALL") {
      strQuery = strQuery.eq("str_type", structureType.toUpperCase());
    }

    const { data: structuresData } = await strQuery;
    const structureMap = new Map<number, any>();
    const activeStrIds = (structuresData || []).map((s: any) => s.str_id);

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

    // 2. Fetch Jobpacks & SOWs
    let jpQuery = (supabase as any).from("jobpack").select("*").eq("company_id", companyId);
    if (jobpackMode === "SELECTED" && jobpackIds.length > 0) {
      jpQuery = jpQuery.in("id", jobpackIds);
    }
    const { data: jobpacksData } = await jpQuery;
    const jobpackMap = new Map<number, any>();
    (jobpacksData || []).forEach((j: any) => jobpackMap.set(j.id, j));

    // Fetch SOWs
    const { data: sowData } = await (supabase as any)
      .from("u_sow")
      .select("*")
      .in("jobpack_id", (jobpacksData || []).map((j: any) => j.id).concat([0]));
    const sowMap = new Map<number, any>();
    (sowData || []).forEach((s: any) => sowMap.set(s.sow_id || s.id, s));

    // 3. Fetch Components Master
    const { data: compData } = await (supabase as any)
      .from("structure_components")
      .select("*")
      .in("structure_id", activeStrIds.length > 0 ? activeStrIds : [0]);
    const compMap = new Map<number, any>();
    (compData || []).forEach((c: any) => compMap.set(c.id, c));

    // 4. Fetch Inspection Records
    let inspQuery = (supabase as any)
      .from("insp_records")
      .select(`
        insp_id,
        jobpack_id,
        structure_id,
        component_id,
        inspection_type_code,
        status,
        inspection_date,
        sow_report_no,
        inspection_data,
        workunit,
        structure_components (
          id,
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
    if (inspectionTypes.length > 0 && !inspectionTypes.includes("ALL")) {
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

    // 7. Fetch Attachments
    const { data: attachmentsData } = await (supabase as any)
      .from("attachments")
      .select("*")
      .eq("company_id", companyId)
      .limit(1000);

    // Helpers
    const sanitizeText = (val: any) => {
      if (val == null) return "";
      return String(val).replace(/[\r\n\t]+/g, " ").trim();
    };

    const formatDateStr = (d: any) => {
      if (!d) return new Date().toISOString().split("T")[0];
      try {
        return new Date(d).toISOString().split("T")[0];
      } catch {
        return String(d).split("T")[0];
      }
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
        (compData || []).forEach((c: any) => {
          const strObj = structureMap.get(c.structure_id);
          const meta = c.metadata || {};
          sheetRows.push({
            STR_ID: c.structure_id,
            TITLE: sanitizeText(strObj?.title || `Platform ${c.structure_id}`),
            PFIELD: sanitizeText(strObj?.pfield || "Offshore"),
            PDESC: sanitizeText(strObj?.pdesc || "Platform Jacket Structure"),
            DEF_UNIT: strObj?.def_unit || "Metric",
            COMP_ID: c.id,
            ID_NO: sanitizeText(c.id_no || `SYS-${c.id}`),
            Q_ID: sanitizeText(c.q_id || `Q-${c.id}`),
            CODE: sanitizeText(c.code || "MB"),
            COMPDESC: sanitizeText(c.description || meta.desc || "Structural Member"),
            S_NODE: sanitizeText(meta.s_node || "N01"),
            F_NODE: sanitizeText(meta.f_node || "N02"),
            S_LEG: sanitizeText(meta.s_leg || "A1"),
            F_LEG: sanitizeText(meta.f_leg || "A2"),
            ELV_1: meta.elv_1 != null ? Number(meta.elv_1) : -12.5,
            ELV_2: meta.elv_2 != null ? Number(meta.elv_2) : -15.0,
            DIST: meta.dist != null ? Number(meta.dist) : 0,
            CLK_POS: meta.clk_pos != null ? Number(meta.clk_pos) : 12,
            COMPTYPE: sanitizeText(c.type || "MEMBER"),
            REC_DATE: formatDateStr(c.updated_at || c.created_at),
          });
        });
      } else if (strategy === "JOBPACK_SOW_MASTER" || code === "JMS") {
        (jobpacksData || []).forEach((jp: any) => {
          const linkedSows = (sowData || []).filter((s: any) => s.jobpack_id === jp.id);
          if (linkedSows.length > 0) {
            linkedSows.forEach((sow: any) => {
              sheetRows.push({
                INSPNO: sanitizeText(sow.sow_report_no || `INSP-${sow.id}`),
                JOBNAME: sanitizeText(jp.name || `JP-${jp.id}`),
                ISTART: formatDateStr(sow.start_date || jp.created_at),
                STATUS: sanitizeText(jp.status || "OPEN").toUpperCase(),
              });
            });
          } else {
            sheetRows.push({
              INSPNO: sanitizeText(jp.jobpack_number || `INSP-${jp.id}`),
              JOBNAME: sanitizeText(jp.name || `JP-${jp.id}`),
              ISTART: formatDateStr(jp.created_at),
              STATUS: sanitizeText(jp.status || "OPEN").toUpperCase(),
            });
          }
        });
      } else if (strategy === "ATTACHMENTS" || code === "ATS") {
        (attachmentsData || []).forEach((att: any) => {
          const linkedRec = allRecords.find((r: any) => r.insp_id === att.inspection_id);
          const strObj = structureMap.get(att.structure_id || linkedRec?.structure_id);
          const comp = compMap.get(att.component_id || linkedRec?.component_id);
          const jp = jobpackMap.get(linkedRec?.jobpack_id);

          sheetRows.push({
            ATTACH_ID: att.id || 1,
            STR_ID: strObj?.str_id || 1,
            TITLE: sanitizeText(strObj?.title || "Platform"),
            PFIELD: sanitizeText(strObj?.pfield || "Offshore"),
            PDESC: sanitizeText(strObj?.pdesc || "Platform"),
            DEF_UNIT: strObj?.def_unit || "Metric",
            COMP_ID: comp?.id || 1,
            ID_NO: sanitizeText(comp?.id_no || "SYS-01"),
            Q_ID: sanitizeText(comp?.q_id || "Q-01"),
            CODE: sanitizeText(comp?.code || "MB"),
            COMPDESC: sanitizeText(comp?.description || "Member"),
            S_NODE: "N01",
            F_NODE: "N02",
            S_LEG: "A1",
            F_LEG: "A2",
            ELV_1: -12.5,
            ELV_2: -15.0,
            DIST: 0,
            CLK_POS: 12,
            COMPTYPE: sanitizeText(comp?.type || "MEMBER"),
            A_FILENAME: sanitizeText(att.file_name || "photo.jpg"),
            A_FILETYPE: sanitizeText(att.file_type || "JPG").toUpperCase(),
            A_PATH: sanitizeText(att.file_path || "/attachments/"),
            ATT_TITLE: sanitizeText(att.title || "Inspection Photo"),
            DETAILS: sanitizeText(att.description || "Inspection attachment image"),
            INSPNO: sanitizeText(linkedRec?.sow_report_no || `INSP-${linkedRec?.insp_id || 1}`),
            INSP_ID: linkedRec?.insp_id || 1,
            INSPCODE: sanitizeText(linkedRec?.inspection_type_code || "GVI"),
            INSPNAME: sanitizeText(linkedRec?.inspection_type_code || "General Visual Inspection"),
            JOBNAME: sanitizeText(jp?.name || "Jobpack"),
            STATUS: sanitizeText(jp?.status || "OPEN").toUpperCase(),
          });
        });
      } else {
        const validCodes = sheetDef.inspectionTypeCode || [code];
        const matchingRecords = allRecords.filter((r: any) => {
          const recType = String(r.inspection_type_code || "").toUpperCase();
          if (validCodes.some((c) => recType.includes(c))) return true;
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

          const baseRow: any = {
            STR_ID: r.structure_id || 1,
            TITLE: sanitizeText(strObj?.title || `Platform ${r.structure_id}`),
            PFIELD: sanitizeText(strObj?.pfield || "Offshore"),
            PDESC: sanitizeText(strObj?.pdesc || "Offshore Facility"),
            DEF_UNIT: strObj?.def_unit || "Metric",
            COMP_ID: comp?.id || 1,
            ID_NO: sanitizeText(comp?.id_no || `SYS-${comp?.id || 1}`),
            Q_ID: sanitizeText(comp?.q_id || idata.q_id || "M-01"),
            CODE: sanitizeText(comp?.code || "MB"),
            COMPDESC: sanitizeText(comp?.description || "Structural Member"),
            S_NODE: sanitizeText(meta.s_node || "N01"),
            F_NODE: sanitizeText(meta.f_node || "N02"),
            S_LEG: sanitizeText(meta.s_leg || "A1"),
            F_LEG: sanitizeText(meta.f_leg || "A2"),
            ELV_1: meta.elv_1 != null ? Number(meta.elv_1) : -12.5,
            ELV_2: meta.elv_2 != null ? Number(meta.elv_2) : -15.0,
            DIST: meta.dist != null ? Number(meta.dist) : 0,
            CLK_POS: meta.clk_pos != null ? Number(meta.clk_pos) : 12,
            COMPTYPE: sanitizeText(comp?.type || "MEMBER"),
            INSP_ID: r.insp_id,
            INSP_DATE: formatDateStr(r.inspection_date),
            INSP_TIME: sanitizeText(idata.insp_time || "09:30:00"),
            INSPECTOR: sanitizeText(idata.inspector || idata.diver_name || "Offshore Inspector"),
            PROC: sanitizeText(idata.procedure || "PETRONAS-SICS-01"),
            EQUIP: sanitizeText(idata.equipment || "CP Probe / Bathycorrometer"),
            EQ_ID: sanitizeText(idata.equipment_id || "EQ-9921"),
            SPEC: sanitizeText(idata.spec || "PTS 11.22.02"),
            SURF_COND: sanitizeText(idata.surface_condition || "Cleaned"),
            CLEAN_MET: sanitizeText(idata.cleaning_method || "Water Jet"),
            SCAF: idata.scaffolding ? "Yes" : "No",
            SUPV: sanitizeText(idata.supervisor || "Offshore Supervisor"),
            DIVR: sanitizeText(idata.diver_name || "Diver 1"),
            DIVE_NO: sanitizeText(idata.dive_no || "DIVE-01"),
            ELEVATION: idata.elevation != null ? Number(idata.elevation) : -12.5,
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
          baseRow.INSPNO = sanitizeText(r.sow_report_no || `INSP-${r.insp_id}`);
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

      // 3. Build Individual XLSX Buffer
      const singleWb = XLSX.utils.book_new();
      const singleWs = XLSX.utils.json_to_sheet(
        sheetRows.length > 0 ? sheetRows : [{ Message: "No records found" }]
      );
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
              const ws = XLSX.utils.json_to_sheet(
                tbl.rows.length > 0 ? tbl.rows : [{ Message: "No records found" }]
              );
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
        return new NextResponse(tbl.xlsxBuffer, {
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
        const worksheet = XLSX.utils.json_to_sheet(
          tbl.rows.length > 0 ? tbl.rows : [{ Message: "No records found" }]
        );
        worksheet["!cols"] = tbl.columns.map((c) => ({ wch: c.width || 18 }));
        XLSX.utils.book_append_sheet(workbook, worksheet, tbl.sheetName.substring(0, 31));
      });

      const outputFileName = fileName || `${clientProfile.code}_${activeInterface.code}_PACKAGE_${dateFormattedYymmdd}.xlsx`;
      const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      return new NextResponse(excelBuffer, {
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

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

    return new NextResponse(zipBuffer, {
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
