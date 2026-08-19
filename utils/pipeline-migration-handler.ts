import { createClient } from "@/utils/supabase/server";
import { getDefaultUnit } from "@/utils/unit-helpers";
import pipelineEventDefaultsConfig from "@/utils/types/pipeline-event-defaults.json";

export interface PipelineMigrationContext {
  oracleConn: any;
  supabase: any;
  structureId: string | number;
  resolvedStructureId: number;
  isImperial: boolean;
  selectedInspNo?: string;
  mappings: Record<string, any[]>;
  logs: string[];
  report: Record<string, { status: string; oracleRows: number; migratedRows: number; errors: string[] }>;
  writeStreamEvent: (evt: any) => Promise<void>;
  compIdMap: Map<number, number>;
  jpIdMap: Map<string, number>;
  rovJobsCache: Map<string, number>;
  diveJobsCache: Map<string, number>;
  tapesCache: Map<string, number>;
  inspIdCache: Map<number, number>;
  jobpackDefaultPrefixMap: Map<string, string>;
  sowReportMap: Map<string, string>;
}

// ─── Pipeline Event Menu Matching ───────────────────────────────────────────
const EVENT_DEFAULTS = (pipelineEventDefaultsConfig?.defaults || {}) as Record<string, any>;

/**
 * Normalizes and matches raw Oracle event strings with standard Pipeline Event Menu definitions
 */
export function matchPipelineEventMenu(
  rawEvent?: string | null,
  rawType?: string | null,
  rawPos?: string | null,
  rawDescr?: string | null
): {
  eventName: string;
  eventType: string;
  eventPosition: string;
  eventDescription: string;
  findings: string;
  findingType: string;
  categoryType: "NORMAL" | "ANOMALY" | "DEBRIS" | "SPAN" | "CP_ANODE";
} {
  const ev = (rawEvent || "").trim().toUpperCase();
  const ty = (rawType || "").trim().toUpperCase();
  const po = (rawPos || "").trim().toUpperCase();
  const de = (rawDescr || "").trim();

  // Try exact lookup from event defaults if composite key matches
  for (const [key, item] of Object.entries(EVENT_DEFAULTS)) {
    const itemEv = String(item.eventName || "").trim().toUpperCase();
    const itemTy = String(item.eventType || "").trim().toUpperCase();
    const itemPo = String(item.eventPosition || "").trim().toUpperCase();

    const evMatch = ev && itemEv.includes(ev);
    const tyMatch = ty && itemTy.includes(ty);
    const poMatch = po && (itemPo.includes(po) || po.includes(itemPo));

    if (evMatch && tyMatch && (poMatch || !po)) {
      return {
        eventName: item.eventName,
        eventType: item.eventType,
        eventPosition: po || item.eventPosition || "-",
        eventDescription: de || item.eventDescription || "",
        findings: item.findings || de || "Satisfactory inspection",
        findingType: item.findingType || "Complete",
        categoryType: getCategoryType(item.eventName, item.eventType, de),
      };
    }
  }

  // Smart Heuristic Classification if no exact composite key match
  let eventName = ev || "SEABED PROFILE";
  let eventType = ty || "-";
  let eventPosition = po || "-";
  let eventDescription = de;
  let findings = de || "Pipeline inspection record";
  let findingType = "Complete";

  const combined = `${ev} ${ty} ${po} ${de}`.toUpperCase();

  if (combined.includes("SPAN") || combined.includes("FREE SPAN")) {
    eventName = "SEABED PROFILE";
    eventType = "SPAN";
    if (combined.includes("START")) eventPosition = "START";
    else if (combined.includes("END")) eventPosition = "END";
    else if (combined.includes("TOUCHDOWN")) eventPosition = "TOUCHDOWN";
    else if (combined.includes("MAX")) eventPosition = "MAX HEIGHT";
  } else if (combined.includes("BURIAL") || combined.includes("BURIED") || combined.includes("TRENCH")) {
    eventName = "SEABED PROFILE";
    eventType = combined.includes("TRENCH") ? "TRENCH" : "BURIAL";
    if (combined.includes("START")) eventPosition = "START";
    else if (combined.includes("END")) eventPosition = "END";
    else if (combined.includes("TRANSITION")) eventPosition = "TRANSITION";
  } else if (combined.includes("ANODE") || combined.includes("DEPLETION")) {
    eventName = "ANODE";
    if (combined.includes("BAR")) eventType = "BAR ANODE DEPLETION";
    else if (combined.includes("BRACELET")) eventType = "BRACELET ANODE DEPLETION";
    else if (combined.includes("COLLAR")) eventType = "COLLAR ANODE DEPLETION";
    else if (combined.includes("SLED")) eventType = "ANODE SLED DEPLETION";
    else if (combined.includes("CABLE")) eventType = "CONTINUITY CABLE";
    else eventType = "BAR ANODE DEPLETION";
  } else if (combined.includes("CP") || combined.includes("STAB") || combined.includes("POTENTIAL")) {
    eventName = "CP STAB";
    eventType = "CP READING";
    if (combined.includes("ANODE")) eventPosition = "STAB ANODE";
    else if (combined.includes("PIPE")) eventPosition = "STAB PIPE";
    else if (combined.includes("JOINT") || combined.includes("FJ")) eventPosition = "FIELD JOINT STAB";
    else if (combined.includes("FLANGE")) eventPosition = "FLANGE STAB";
    else if (combined.includes("RISER")) eventPosition = "RISER STAB";
  } else if (combined.includes("JOINT") || combined.includes("FIELD JOINT") || combined.includes("FJ")) {
    eventName = "FIELD JOINT";
    if (combined.includes("TIN")) eventType = "TIN WRAP";
    else if (combined.includes("TAPE")) eventType = "TAPE WRAP";
    else eventType = "FIELD JOINT";
  } else if (combined.includes("DEBRIS") || combined.includes("GARBAGE") || combined.includes("NET") || combined.includes("ROPE")) {
    eventName = "DEBRIS";
    eventType = combined.includes("PIPE") ? "DEBRIS ON PIPE" : "DEBRIS ON SEABED";
    findingType = "Observation";
  } else if (combined.includes("GROWTH") || combined.includes("MARINE GROWTH") || combined.includes("MGROW")) {
    eventName = "MARINE GROWTH";
    if (combined.includes("HARD") && combined.includes("SOFT")) eventType = "HARD AND SOFT";
    else if (combined.includes("HARD")) eventType = "HARD";
    else eventType = "SOFT";
  } else if (combined.includes("CROSSING") || combined.includes("CROSS")) {
    eventName = "LINE FEATURE";
    eventType = "CROSSING";
  } else if (combined.includes("FLANGE")) {
    eventName = "LINE FEATURE";
    eventType = "FLANGE";
  } else if (combined.includes("VALVE")) {
    eventName = "LINE FEATURE";
    eventType = "VALVE";
  } else if (combined.includes("RISER") || combined.includes("CLAMP")) {
    eventName = "RISER FEATURE";
    eventType = "CLAMPS & SUPPORTS";
  }

  return {
    eventName,
    eventType,
    eventPosition,
    eventDescription,
    findings,
    findingType,
    categoryType: getCategoryType(eventName, eventType, de),
  };
}

function getCategoryType(
  eventName: string,
  eventType: string,
  descr: string
): "NORMAL" | "ANOMALY" | "DEBRIS" | "SPAN" | "CP_ANODE" {
  const c = `${eventName} ${eventType} ${descr}`.toUpperCase();
  if (c.includes("ANOMALY") || c.includes("DEFECT") || c.includes("CRACK") || c.includes("DENT") || c.includes("DAMAGE")) {
    return "ANOMALY";
  }
  if (c.includes("DEBRIS")) return "DEBRIS";
  if (c.includes("SPAN")) return "SPAN";
  if (c.includes("ANODE") || c.includes("CP")) return "CP_ANODE";
  return "NORMAL";
}

// ─── 1. Migrate Pipeline Structure Master & Geodetic Parameters ───────────────
export async function migratePipelineStructureAndGeodetics(ctx: PipelineMigrationContext) {
  const { oracleConn, supabase, structureId, resolvedStructureId, isImperial, logs, report, writeStreamEvent } = ctx;

  await writeStreamEvent({ type: "progress", current: 2, total: 9, label: "Migrating Pipeline Structure & Geodetic parameters...", percent: 20 });

  report["STRUCTURE_PIPELINE"] = { status: "failed", oracleRows: 0, migratedRows: 0, errors: [] };
  logs.push(`[Pipeline Engine] Fetching pipeline structure specs from Oracle U_PIPELINE / v_structure for STR_ID ${structureId}...`);

  try {
    // 1. Fetch U_PIPELINE record
    let pipeRow: any = null;
    try {
      const res = await oracleConn.execute(
        `SELECT * FROM U_PIPELINE WHERE PIPE_ID = :strId`,
        { strId: structureId }
      );
      if (res.rows && res.rows.length > 0) {
        pipeRow = res.rows[0];
      }
    } catch (e: any) {
      logs.push(`[Pipeline Engine] Querying U_PIPELINE failed (${e.message}). Falling back to v_structure...`);
      const vRes = await oracleConn.execute(
        `SELECT * FROM v_structure WHERE STR_ID = :strId`,
        { strId: structureId }
      );
      if (vRes.rows && vRes.rows.length > 0) {
        pipeRow = vRes.rows[0];
      }
    }

    if (!pipeRow) {
      throw new Error(`Pipeline record not found in Oracle for Structure ID ${structureId}`);
    }

    report["STRUCTURE_PIPELINE"].oracleRows = 1;

    // Determine unit defaults based on source unit
    const defUnit = String(pipeRow.DEF_UNIT || (isImperial ? "I" : "M")).toUpperCase();
    const isImp = defUnit.startsWith("I");

    const pipeTitle = String(pipeRow.TITLE || pipeRow.NAME || `PIPELINE-${structureId}`).trim();
    const pipeField = String(pipeRow.PFIELD || pipeRow.FIELD || "").trim();
    const pipeDesc = String(pipeRow.PDESC || pipeRow.DESCRIP || "").trim();

    // Map units for numeric spec fields
    const pgPipeRecord: Record<string, any> = {
      pipe_id: resolvedStructureId,
      title: pipeTitle,
      pfield: pipeField,
      pdesc: pipeDesc,
      ptype: "PIPE",
      def_unit: isImp ? "Imperial" : "Metric",
      inst_date: pipeRow.INST_DATE ? new Date(pipeRow.INST_DATE).toISOString() : null,
      desg_life: pipeRow.DESG_LIFE ? Number(pipeRow.DESG_LIFE) : null,
      st_north: pipeRow.ST_NORTH !== undefined ? Number(pipeRow.ST_NORTH) : null,
      st_east: pipeRow.ST_EAST !== undefined ? Number(pipeRow.ST_EAST) : null,
      depth: pipeRow.DEPTH !== undefined ? Number(pipeRow.DEPTH) : null,
      depth_u: isImp ? "ft" : "m",
      line_diam: pipeRow.LINE_DIAM !== undefined ? Number(pipeRow.LINE_DIAM) : null,
      line_diam_u: isImp ? "in" : "mm",
      wall_thk: pipeRow.WALL_THK !== undefined ? Number(pipeRow.WALL_THK) : null,
      wall_thk_u: isImp ? "in" : "mm",
      plength: pipeRow.PLENGTH !== undefined ? Number(pipeRow.PLENGTH) : null,
      plength_u: isImp ? "mile" : "km",
      burial: pipeRow.BURIAL !== undefined ? Number(pipeRow.BURIAL) : null,
      burial_u: isImp ? "ft" : "m",
      conc_ctg: pipeRow.CONC_CTG !== undefined ? Number(pipeRow.CONC_CTG) : null,
      conc_ctg_u: isImp ? "in" : "mm",
      oper_press: pipeRow.OPER_PRESS !== undefined ? Number(pipeRow.OPER_PRESS) : null,
      oper_press_u: isImp ? "psi" : "bar",
      an_qty: pipeRow.AN_QTY ? Number(pipeRow.AN_QTY) : null,
      an_type: pipeRow.AN_TYPE ? String(pipeRow.AN_TYPE) : null,
      inst_ctr: pipeRow.INST_CTR ? String(pipeRow.INST_CTR) : null,
      process: pipeRow.PROCESS ? String(pipeRow.PROCESS) : null,
      plegs: pipeRow.PLEGS ? String(pipeRow.PLEGS) : null,
      cr_user: pipeRow.CR_USER ? String(pipeRow.CR_USER) : null,
      cr_date: pipeRow.CR_DATE ? new Date(pipeRow.CR_DATE).toISOString() : null,
    };

    // 1. Ensure parent record in structure table
    const { error: parentErr } = await supabase
      .from("structure")
      .upsert({ str_id: resolvedStructureId, str_type: "PIPELINE" }, { onConflict: "str_id" });

    if (parentErr) {
      logs.push(`[Pipeline Engine] Warning: inserting parent structure: ${parentErr.message}`);
    }

    // 2. Upsert into u_pipeline
    const { error: pipeErr } = await supabase
      .from("u_pipeline")
      .upsert(pgPipeRecord, { onConflict: "pipe_id" });

    if (pipeErr) {
      throw pipeErr;
    }

    logs.push(`[Pipeline Engine] Successfully migrated pipeline master "${pipeTitle}" (ID: ${resolvedStructureId}, Units: ${isImp ? "Imperial" : "Metric"})!`);
    report["STRUCTURE_PIPELINE"].status = "success";
    report["STRUCTURE_PIPELINE"].migratedRows = 1;

    // 3. Migrate Geodetic Parameters from Oracle PIPE_GEO (fallback to U_PIPEGEO)
    try {
      logs.push(`[Pipeline Engine] Checking Oracle PIPE_GEO for geodetic parameters (STR_ID: ${structureId})...`);
      let geoRes: any = null;
      try {
        geoRes = await oracleConn.execute(
          `SELECT * FROM PIPE_GEO WHERE STR_ID = :strId`,
          { strId: structureId }
        );
      } catch (err1: any) {
        try {
          geoRes = await oracleConn.execute(
            `SELECT * FROM PIPE_GEO WHERE PIPE_ID = :strId`,
            { strId: structureId }
          );
        } catch (err2: any) {
          try {
            geoRes = await oracleConn.execute(
              `SELECT * FROM U_PIPEGEO WHERE STR_ID = :strId`,
              { strId: structureId }
            );
          } catch (err3: any) {
            logs.push(`[Pipeline Engine] Note on PIPE_GEO / U_PIPEGEO queries: ${err3.message}`);
          }
        }
      }

      if (geoRes && geoRes.rows && geoRes.rows.length > 0) {
        const geoRow = geoRes.rows[0];
        const geoRecord = {
          str_id: resolvedStructureId,
          geo_proj_nam: geoRow.GEO_PROJ_NAM || geoRow.PROJ_NAM || geoRow.PROJECTION || "Timbalai 1948 RSO Borneo Feet (BRS0)",
          geo_datum: geoRow.GEO_DATUM || geoRow.DATUM || "Timbalai 1948",
          geo_elli_sph: geoRow.GEO_ELLI_SPH || geoRow.ELLIPSOID || geoRow.SPHEROID || "Everest 1830 Modified",
          geo_units: geoRow.GEO_UNITS || geoRow.UNITS || (isImp ? "Feet" : "Meters"),
          geo_dir: geoRow.GEO_DIR || geoRow.DATUM_SHIFT || "WGS-84 To Timbalai",
          geo_dx: geoRow.GEO_DX !== undefined ? Number(geoRow.GEO_DX) : (geoRow.DX !== undefined ? Number(geoRow.DX) : 0),
          geo_dx_u: isImp ? "ft" : "m",
          geo_dy: geoRow.GEO_DY !== undefined ? Number(geoRow.GEO_DY) : (geoRow.DY !== undefined ? Number(geoRow.DY) : 0),
          geo_dy_u: isImp ? "ft" : "m",
          geo_dz: geoRow.GEO_DZ !== undefined ? Number(geoRow.GEO_DZ) : (geoRow.DZ !== undefined ? Number(geoRow.DZ) : 0),
          geo_dz_u: isImp ? "ft" : "m",
          cr_user: geoRow.CR_USER ? String(geoRow.CR_USER) : null,
          cr_date: geoRow.CR_DATE ? new Date(geoRow.CR_DATE).toISOString() : null,
          workunit: geoRow.WORKUNIT ? String(geoRow.WORKUNIT) : null,
        };

        const { error: geoErr } = await (supabase.from as any)("u_pipegeo")
          .upsert(geoRecord, { onConflict: "str_id" });

        if (geoErr) {
          logs.push(`[Pipeline Engine] Warning: inserting u_pipegeo: ${geoErr.message}`);
        } else {
          logs.push(`[Pipeline Engine] Successfully migrated Geodetic Parameters from PIPE_GEO (${geoRecord.geo_proj_nam}, Datum: ${geoRecord.geo_datum})!`);
        }
      } else {
        logs.push(`[Pipeline Engine] No PIPE_GEO record found for pipeline STR_ID ${structureId}. Creating default geodetic template.`);
        const defaultGeo = {
          str_id: resolvedStructureId,
          geo_proj_nam: "Timbalai 1948 RSO Borneo Feet (BRS0)",
          geo_datum: "Timbalai 1948",
          geo_elli_sph: "Everest 1830 Modified",
          geo_units: isImp ? "Feet" : "Meters",
          geo_dir: "WGS-84 To Timbalai",
          geo_dx: 0,
          geo_dx_u: isImp ? "ft" : "m",
          geo_dy: 0,
          geo_dy_u: isImp ? "ft" : "m",
          geo_dz: 0,
          geo_dz_u: isImp ? "ft" : "m",
        };
        await (supabase.from as any)("u_pipegeo").upsert(defaultGeo, { onConflict: "str_id" });
      }
    } catch (geoErr: any) {
      logs.push(`[Pipeline Engine] Note on PIPE_GEO query: ${geoErr.message}`);
    }

  } catch (err: any) {
    logs.push(`[Pipeline Engine] ERROR migrating pipeline structure: ${err.message}`);
    report["STRUCTURE_PIPELINE"].errors.push(err.message);
    throw err;
  }
}

// ─── 2. Migrate Pipeline Components ──────────────────────────────────────────
export async function migratePipelineComponents(ctx: PipelineMigrationContext) {
  const { oracleConn, supabase, structureId, resolvedStructureId, isImperial, compIdMap, logs, report, writeStreamEvent } = ctx;

  await writeStreamEvent({ type: "progress", current: 4, total: 9, label: "Migrating Pipeline Components...", percent: 45 });

  logs.push(`[Pipeline Engine] Querying pipeline components from Oracle ALLCOMPID for STR_ID ${structureId}...`);

  try {
    const compRes = await oracleConn.execute(
      `SELECT c.COMP_ID, c.STR_ID, c.CODE, c.ID_NO, c.Q_ID, c.DEL, c.DESCRIP 
       FROM ALLCOMPID c 
       WHERE c.STR_ID = :strId AND (c.DEL IS NULL OR c.DEL = 0)`,
      { strId: structureId }
    );

    const compRows = compRes.rows || [];
    logs.push(`[Pipeline Engine] Found ${compRows.length} component(s) in Oracle ALLCOMPID.`);

    let migratedComps = 0;
    const compsToInsert: any[] = [];

    // Ensure a default Pipeline Main Component exists
    const defaultPipelineQid = `PIPE-${resolvedStructureId}`;
    const defaultPipeComp = {
      structure_id: resolvedStructureId,
      code: "PIPE",
      q_id: defaultPipelineQid,
      name: `Pipeline Main Line (${resolvedStructureId})`,
      is_deleted: false,
      metadata: {
        unitSystem: isImperial ? "Imperial" : "Metric",
        type: "PIPELINE",
      },
    };

    const { data: mainCompData, error: mainCompErr } = await supabase
      .from("structure_components")
      .upsert(defaultPipeComp, { onConflict: "structure_id,q_id" })
      .select("id, q_id");

    if (!mainCompErr && mainCompData && mainCompData.length > 0) {
      const defaultId = Number(mainCompData[0].id);
      compIdMap.set(999999, defaultId);
      compIdMap.set(0, defaultId);
    }

    for (const r of compRows) {
      const oracleCompId = Number(r.COMP_ID || r[0]);
      const code = String(r.CODE || r[2] || "COMP").toUpperCase().trim();
      const qid = String(r.Q_ID || r[4] || `${code}-${oracleCompId}`).trim();
      const idNo = String(r.ID_NO || r[3] || "").trim();
      const descrip = String(r.DESCRIP || r[6] || "").trim();

      const pgComp = {
        structure_id: resolvedStructureId,
        comp_id: oracleCompId,
        code: code,
        id_no: idNo,
        q_id: qid,
        name: descrip || `${code} ${qid}`,
        is_deleted: false,
        metadata: {
          unitSystem: isImperial ? "Imperial" : "Metric",
          oracleCompId: oracleCompId,
          code: code,
        },
      };

      compsToInsert.push(pgComp);
    }

    if (compsToInsert.length > 0) {
      // Chunk insert
      const chunkSize = 100;
      for (let i = 0; i < compsToInsert.length; i += chunkSize) {
        const chunk = compsToInsert.slice(i, i + chunkSize);
        const { data: inserted, error: insErr } = await supabase
          .from("structure_components")
          .insert(chunk)
          .select("id, comp_id, q_id");

        if (insErr) {
          logs.push(`[Pipeline Engine] Warning inserting components: ${insErr.message}`);
        } else if (inserted) {
          migratedComps += inserted.length;
          inserted.forEach((c: any) => {
            if (c.comp_id) {
              compIdMap.set(Number(c.comp_id), Number(c.id));
            }
          });
        }
      }
    }

    logs.push(`[Pipeline Engine] Successfully migrated ${migratedComps} pipeline components!`);
  } catch (err: any) {
    logs.push(`[Pipeline Engine] Warning during pipeline components migration: ${err.message}`);
  }
}

// ─── 3. Migrate ROV Pipeline Navigation Inspections (NAVIG) ───────────────────
export async function migratePipelineNavigInspections(ctx: PipelineMigrationContext) {
  const {
    oracleConn,
    supabase,
    structureId,
    resolvedStructureId,
    selectedInspNo,
    compIdMap,
    jpIdMap,
    rovJobsCache,
    tapesCache,
    inspIdCache,
    sowReportMap,
    jobpackDefaultPrefixMap,
    logs,
    report,
    writeStreamEvent,
  } = ctx;

  const reportKey = "INSP_ROV_NAVIG";
  report[reportKey] = { status: "failed", oracleRows: 0, migratedRows: 0, errors: [] };

  await writeStreamEvent({ type: "progress", current: 6, total: 9, label: "Migrating ROV Pipeline Navigation Surveys (NAVIG)...", percent: 65 });

  logs.push(`[Pipeline Engine] Fetching ROV survey records from Oracle NAVIG table (STR_ID: ${structureId})...`);

  try {
    // 1. Query NAVIG table columns
    let navigQuery = `
      SELECT 
        n.INSP_ID, n.STR_ID, n.INSPNO, n.COMP_ID, n.INSP_DATE, n.INSP_TIME,
        n.DIVE_NO, n.TAPE_NO, n.COUNTER, n.TIMECODE,
        n.FP_KP, n.KP, n.EASTING, n.E_COORD, n.NORTHING, n.N_COORD,
        n.DEPTH, n.WATER_DEPTH, n.ELEVATION,
        n.CP_RDG, n.CP_READING, n.EVENT, n.EVENT_NAME, n.TYPE, n.EVENT_TYPE,
        n.POS, n.POSITION, n.DESCR, n.EVENT_DESC, n.DESCRIPTION,
        n.ANOM_NO, n.DEFECT, n.SEVERITY, n.PRIORITY,
        n.CORR_CTG, n.AN_QTY, n.REMARKS, n.COMMENTS
      FROM NAVIG n
      WHERE n.STR_ID = :strId AND n.INSP_ID IS NOT NULL AND n.INSP_ID > 0
    `;

    if (selectedInspNo) {
      navigQuery += ` AND n.INSPNO = :inspNo`;
    }
    navigQuery += ` ORDER BY n.INSP_ID ASC`;

    const binds: any = { strId: structureId };
    if (selectedInspNo) binds.inspNo = selectedInspNo;

    let rows: any[] = [];
    try {
      const res = await oracleConn.execute(navigQuery, binds);
      rows = res.rows || [];
    } catch (queryErr: any) {
      logs.push(`[Pipeline Engine] Full NAVIG query failed (${queryErr.message}). Trying fallback SELECT * FROM NAVIG...`);
      let fallbackQuery = `SELECT * FROM NAVIG WHERE STR_ID = :strId AND INSP_ID IS NOT NULL AND INSP_ID > 0`;
      if (selectedInspNo) fallbackQuery += ` AND INSPNO = :inspNo`;
      const fbRes = await oracleConn.execute(fallbackQuery, binds);
      rows = fbRes.rows || [];
    }

    if (!rows || rows.length === 0) {
      logs.push(`[Pipeline Engine] No records found in Oracle NAVIG table for structure ${structureId}.`);
      report[reportKey].status = "success";
      return;
    }

    report[reportKey].oracleRows = rows.length;
    logs.push(`[Pipeline Engine] Found ${rows.length} NAVIG survey records in Oracle. Processing & matching Event Menus in Metric units...`);

    // Fetch default pipeline component ID for fallback
    let defaultCompId = compIdMap.get(0) || compIdMap.get(999999) || null;
    if (!defaultCompId) {
      const { data: cData } = await supabase
        .from("structure_components")
        .select("id")
        .eq("structure_id", resolvedStructureId)
        .limit(1)
        .maybeSingle();
      if (cData) defaultCompId = Number(cData.id);
    }

    const recordsToInsert: any[] = [];

    for (let idx = 0; idx < rows.length; idx++) {
      const r = rows[idx];
      const oracleInspId = Number(r.INSP_ID || r.insp_id);
      if (!oracleInspId) continue;

      const inspNo = String(r.INSPNO || r.inspno || "").trim();
      const compId = Number(r.COMP_ID || r.comp_id || 0);
      const diveNo = r.DIVE_NO !== undefined ? String(r.DIVE_NO).trim() : "";
      const tapeNo = r.TAPE_NO !== undefined ? String(r.TAPE_NO).trim() : "";

      // Clean Date & Time
      let inspDate: string = new Date().toISOString().split("T")[0];
      if (r.INSP_DATE) {
        try {
          const d = new Date(r.INSP_DATE);
          if (!isNaN(d.getTime())) inspDate = d.toISOString().split("T")[0];
        } catch (_) {}
      }

      let inspTime = "12:00:00";
      if (r.INSP_TIME) {
        const tStr = String(r.INSP_TIME).trim();
        if (tStr.includes(":")) inspTime = tStr.length === 5 ? `${tStr}:00` : tStr;
      }

      // Metric numeric extraction
      const rawKp = r.FP_KP !== undefined ? r.FP_KP : (r.KP !== undefined ? r.KP : null);
      const kpNum = rawKp !== null && !isNaN(Number(rawKp)) ? Number(rawKp) : 0;

      const rawEast = r.EASTING !== undefined ? r.EASTING : (r.E_COORD !== undefined ? r.E_COORD : null);
      const eastNum = rawEast !== null && !isNaN(Number(rawEast)) ? Number(rawEast) : null;

      const rawNorth = r.NORTHING !== undefined ? r.NORTHING : (r.N_COORD !== undefined ? r.N_COORD : null);
      const northNum = rawNorth !== null && !isNaN(Number(rawNorth)) ? Number(rawNorth) : null;

      const rawDepth = r.DEPTH !== undefined ? r.DEPTH : (r.WATER_DEPTH !== undefined ? r.WATER_DEPTH : (r.ELEVATION !== undefined ? r.ELEVATION : null));
      const depthNum = rawDepth !== null && !isNaN(Number(rawDepth)) ? Number(rawDepth) : null;

      const rawCp = r.CP_RDG !== undefined ? r.CP_RDG : (r.CP_READING !== undefined ? r.CP_READING : null);
      const cpVal = rawCp !== null && !isNaN(Number(rawCp)) ? Number(rawCp) : null;

      const rawEvent = r.EVENT || r.EVENT_NAME || "";
      const rawType = r.TYPE || r.EVENT_TYPE || "";
      const rawPos = r.POS || r.POSITION || "";
      const rawDescr = r.DESCR || r.EVENT_DESC || r.DESCRIPTION || r.REMARKS || "";

      // Match with Event Menu defaults
      const eventMatched = matchPipelineEventMenu(rawEvent, rawType, rawPos, rawDescr);

      // Foreign key resolution
      const pgJobpackId = jpIdMap.get(inspNo) || null;
      const rovJobKey = `${inspNo}_${diveNo}`;
      const pgRovJobId = rovJobsCache.get(rovJobKey) || (rovJobsCache.size > 0 ? Array.from(rovJobsCache.values())[0] : null);

      const tapeKey = `ROV_${tapeNo}_${diveNo}`;
      const pgTapeId = tapesCache.get(tapeKey) || null;

      const pgCompId = compIdMap.get(compId) || defaultCompId;

      // SOW Report Number Resolution
      const exactSowKey = `${inspNo}_${compId}_NAVIG`;
      const codeSowKey = `code_${inspNo}_NAVIG`;
      const sowReportNo = sowReportMap.get(exactSowKey) || sowReportMap.get(codeSowKey) || jobpackDefaultPrefixMap.get(inspNo) || "13124";

      const hasAnomaly = !!(r.ANOM_NO || r.DEFECT || eventMatched.categoryType === "ANOMALY");

      // Construct comprehensive JSONB inspection_data with all Metric survey fields
      const inspectionData: Record<string, any> = {
        // Event fields matched with pipeline event menu
        eventName: eventMatched.eventName,
        eventType: eventMatched.eventType,
        eventPosition: eventMatched.eventPosition,
        eventDescription: eventMatched.eventDescription,
        findings: eventMatched.findings,
        findingType: eventMatched.findingType,

        // Metric Navigation Parameters
        kp: kpNum,
        fp_kp: kpNum,
        easting: eastNum !== null ? eastNum : "-",
        northing: northNum !== null ? northNum : "-",
        depth: depthNum !== null ? depthNum : "-",
        water_depth: depthNum !== null ? depthNum : "-",
        depth_u: "m",
        kp_u: "km",
        coords_u: "m",

        // Cathodic Protection
        cp_reading: cpVal !== null ? cpVal : "",
        cp_rdg: cpVal !== null ? cpVal : "",
        cp_u: "mV",

        // Video & Survey Reference
        timecode: r.TIMECODE || r.COUNTER || "-",
        counter: r.COUNTER || r.TIMECODE || "-",
        dive_no: diveNo,
        tape_no: tapeNo,
        sow_report_no: sowReportNo,

        // Raw Oracle Data Preserved
        oracle_insp_id: oracleInspId,
        raw_event: rawEvent,
        raw_type: rawType,
        raw_pos: rawPos,
        raw_descr: rawDescr,
        raw_record: r,
      };

      if (hasAnomaly) {
        inspectionData.has_anomaly = true;
        inspectionData.anomaly_no = r.ANOM_NO || `A-${oracleInspId}`;
        inspectionData.priority = r.PRIORITY || r.SEVERITY || "P1";
      }

      recordsToInsert.push({
        structure_id: resolvedStructureId,
        component_id: pgCompId,
        jobpack_id: pgJobpackId,
        rov_job_id: pgRovJobId,
        dive_job_id: null,
        tape_id: pgTapeId,
        sow_report_no: sowReportNo,
        inspection_type_code: "NAVIG",
        date: inspDate,
        time: inspTime,
        elevation: depthNum !== null ? `${depthNum}` : null,
        fp_kp: kpNum,
        has_anomaly: hasAnomaly,
        remarks: eventMatched.findings || rawDescr,
        description: eventMatched.eventDescription || rawDescr,
        inspection_data: inspectionData,
        status: "COMPLETED",
        _oracle_insp_id: oracleInspId,
      });
    }

    // Batch insert into insp_records
    let migratedCount = 0;
    const batchSize = 100;

    for (let b = 0; b < recordsToInsert.length; b += batchSize) {
      const batch = recordsToInsert.slice(b, b + batchSize);
      const insertPayload = batch.map(({ _oracle_insp_id, ...rec }) => rec);

      const { data: inserted, error: insErr } = await supabase
        .from("insp_records")
        .insert(insertPayload)
        .select("insp_id");

      if (insErr) {
        logs.push(`[Pipeline Engine] ERROR inserting NAVIG batch ${b}: ${insErr.message}`);
        report[reportKey].errors.push(insErr.message);
      } else if (inserted) {
        migratedCount += inserted.length;
        inserted.forEach((newRec: any, idxInBatch: number) => {
          const origOracleId = batch[idxInBatch]._oracle_insp_id;
          if (origOracleId && newRec.insp_id) {
            inspIdCache.set(origOracleId, Number(newRec.insp_id));
          }
        });
      }
    }

    logs.push(`[Pipeline Engine] Successfully migrated ${migratedCount} ROV NAVIG inspection records!`);
    report[reportKey].status = "success";
    report[reportKey].migratedRows = migratedCount;

  } catch (err: any) {
    logs.push(`[Pipeline Engine] ERROR in migratePipelineNavigInspections: ${err.message}`);
    report[reportKey].errors.push(err.message);
  }
}

// ─── 4. Migrate Pipeline Defects & Anomalies ──────────────────────────────────
export async function migratePipelineAnomalies(ctx: PipelineMigrationContext) {
  const { oracleConn, supabase, structureId, inspIdCache, logs, report, writeStreamEvent } = ctx;

  const reportKey = "ANOMALY";
  await writeStreamEvent({ type: "progress", current: 7, total: 9, label: "Migrating Pipeline Defects & Anomalies...", percent: 80 });

  logs.push(`[Pipeline Engine] Querying u_defect for pipeline structure STR_ID ${structureId}...`);

  try {
    const res = await oracleConn.execute(
      `SELECT * FROM u_defect WHERE STR_ID = :strId AND INSP_ID IS NOT NULL`,
      { strId: structureId }
    );

    const rows = res.rows || [];
    logs.push(`[Pipeline Engine] Found ${rows.length} defect(s) in Oracle u_defect.`);

    let migratedCount = 0;
    for (const r of rows) {
      const oracleInspId = Number(r.INSP_ID);
      const pgInspId = inspIdCache.get(oracleInspId);
      if (!pgInspId) continue;

      const defectType = String(r.DEFECT_TYPE || r.DEFECT_CODE || r.DEFECT || "COATING DAMAGE").trim();
      const rawPriority = String(r.PRIORITY || r.SEVERITY || "P1").trim().toUpperCase();
      const prioCode = rawPriority.includes("1") ? "P1" : (rawPriority.includes("2") ? "P2" : (rawPriority.includes("3") ? "P3" : "P1"));

      const anomRecord = {
        inspection_id: pgInspId,
        anomaly_ref_no: r.ANOM_NO || `ANOM-${pgInspId}`,
        defect_type_code: defectType,
        priority_code: prioCode,
        severity: prioCode,
        status: String(r.STATUS || "OPEN").toUpperCase(),
        notes: r.DESCR || r.REMARKS || "",
        follow_up_notes: r.RECTIFICATION || r.ACTION || "",
      };

      const { error: anomErr } = await supabase
        .from("insp_anomalies")
        .upsert(anomRecord as any, { onConflict: "inspection_id" });

      if (!anomErr) {
        migratedCount++;
        await supabase
          .from("insp_records")
          .update({ has_anomaly: true })
          .eq("insp_id", pgInspId);
      }
    }

    logs.push(`[Pipeline Engine] Successfully linked ${migratedCount} anomalies to pipeline inspection records!`);
  } catch (err: any) {
    logs.push(`[Pipeline Engine] Warning migrating pipeline anomalies: ${err.message}`);
  }
}

// ─── 5. Migrate Pipeline Attachments ──────────────────────────────────────────
export async function migratePipelineAttachments(ctx: PipelineMigrationContext) {
  const { oracleConn, supabase, structureId, inspIdCache, compIdMap, logs, writeStreamEvent } = ctx;

  await writeStreamEvent({ type: "progress", current: 8, total: 9, label: "Migrating Pipeline Attachments & Media...", percent: 90 });

  logs.push(`[Pipeline Engine] Querying U_ATTACH_1 for pipeline media (STR_ID: ${structureId})...`);

  try {
    const res = await oracleConn.execute(
      `SELECT * FROM U_ATTACH_1 WHERE STR_ID = :strId`,
      { strId: structureId }
    );

    const rows = res.rows || [];
    logs.push(`[Pipeline Engine] Found ${rows.length} attachment(s) in Oracle U_ATTACH_1.`);

    let migratedCount = 0;
    for (const r of rows) {
      const oracleInspId = Number(r.INSP_ID || 0);
      const oracleCompId = Number(r.COMP_ID || 0);

      let sourceType: "inspection" | "component" | "structure" = "structure";
      let sourceId = ctx.resolvedStructureId;

      if (oracleInspId && inspIdCache.has(oracleInspId)) {
        sourceType = "inspection";
        sourceId = inspIdCache.get(oracleInspId)!;
      } else if (oracleCompId && compIdMap.has(oracleCompId)) {
        sourceType = "component";
        sourceId = compIdMap.get(oracleCompId)!;
      }

      const fileName = String(r.A_FILENAME || r.FILENAME || r.NAME || `file_${r.ATTACH_ID || migratedCount + 1}`).trim();
      const fileType = String(r.A_FILETYPE || r.FILETYPE || "image/jpeg").trim();

      const attachRecord = {
        source_id: sourceId,
        source_type: sourceType,
        file_name: fileName,
        mime_type: fileType,
        file_path: r.A_FILEPATH || r.FILEPATH || "",
        caption: r.A_CAPTION || r.CAPTION || r.DESCRIPTION || "",
      };

      const { error: attErr } = await supabase
        .from("attachment")
        .insert(attachRecord as any);

      if (!attErr) migratedCount++;
    }

    logs.push(`[Pipeline Engine] Successfully migrated ${migratedCount} pipeline attachments!`);
  } catch (err: any) {
    logs.push(`[Pipeline Engine] Warning migrating pipeline attachments: ${err.message}`);
  }
}
