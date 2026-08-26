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
  selectedInspNos?: string[];
  updateStructureSpecs?: boolean;
  updateComponentSpecs?: boolean;
  insertNewComponents?: boolean;
  migrateAttachments?: boolean;
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

// ─── Timezone-Free Date & Time Helpers ─────────────────────────────────────
export function cleanOracleDate(str: string): string {
  if (!str) {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  const s = String(str).trim();

  // 1. YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }

  // 2. DD-MON-YYYY or DD-MON-YY (e.g. 04-APR-18, 04-APR-2018)
  const monMatch = s.match(/^(\d{1,2})[-/ ]([A-Za-z]{3,4})[-/ ](\d{2,4})/);
  if (monMatch) {
    const day = monMatch[1].padStart(2, '0');
    const monStr = monMatch[2].toUpperCase();
    const yearRaw = monMatch[3];
    const months: Record<string, string> = {
      'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04', 'MAY': '05', 'JUN': '06',
      'JUL': '07', 'AUG': '08', 'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
    };
    let month = '01';
    for (const [k, v] of Object.entries(months)) {
      if (monStr.startsWith(k)) {
        month = v;
        break;
      }
    }
    let year = Number(yearRaw);
    if (yearRaw.length === 2) {
      year = year > 50 ? 1900 + year : 2000 + year;
    }
    return `${year}-${month}-${day}`;
  }

  // 3. DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
  }

  const parsed = Date.parse(s);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatLocalDateOnly(dateVal: any): string | null {
  if (!dateVal) return null;
  if (dateVal instanceof Date) {
    const yyyy = dateVal.getFullYear();
    const mm = String(dateVal.getMonth() + 1).padStart(2, '0');
    const dd = String(dateVal.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  const str = String(dateVal).trim();
  if (!str) return null;
  return cleanOracleDate(str);
}

export function formatTimeOnly(timeVal: any, fallbackDateVal?: any): string {
  if (timeVal instanceof Date) {
    const hh = String(timeVal.getHours()).padStart(2, '0');
    const mm = String(timeVal.getMinutes()).padStart(2, '0');
    const ss = String(timeVal.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  let str = timeVal !== null && timeVal !== undefined ? String(timeVal).trim() : "";
  
  if (str) {
    if (str.includes('T') || str.includes(' ')) {
      const parts = str.split(/[T ]/);
      if (parts.length > 1 && parts[1]) {
        str = parts[1].split('.')[0].split('Z')[0].trim();
      }
    }

    const match = str.match(/(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*(AM|PM)?/i);
    if (match) {
      let hh = parseInt(match[1], 10);
      const mm = match[2];
      const ss = match[3] || "00";
      const ampm = (match[4] || "").toUpperCase();
      if (ampm === "PM" && hh < 12) hh += 12;
      if (ampm === "AM" && hh === 12) hh = 0;
      return `${String(hh).padStart(2, '0')}:${mm}:${ss}`;
    }

    const digits = str.replace(/\D/g, '');
    if (digits.length >= 3) {
      if (digits.length <= 4) {
        const padded = digits.padStart(4, '0');
        const hh = parseInt(padded.substring(0, 2), 10);
        const mm = parseInt(padded.substring(2, 4), 10);
        if (hh < 24 && mm < 60) {
          return `${padded.substring(0, 2)}:${padded.substring(2, 4)}:00`;
        }
      } else {
        const padded = digits.padStart(6, '0');
        const hh = parseInt(padded.substring(0, 2), 10);
        const mm = parseInt(padded.substring(2, 4), 10);
        const ss = parseInt(padded.substring(4, 6), 10);
        if (hh < 24 && mm < 60 && ss < 60) {
          return `${padded.substring(0, 2)}:${padded.substring(2, 4)}:${padded.substring(4, 6)}`;
        }
      }
    }
  }

  if (fallbackDateVal) {
    if (fallbackDateVal instanceof Date) {
      const h = fallbackDateVal.getHours();
      const m = fallbackDateVal.getMinutes();
      const s = fallbackDateVal.getSeconds();
      if (h > 0 || m > 0 || s > 0) {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      }
    } else if (typeof fallbackDateVal === 'string') {
      const fStr = fallbackDateVal.trim();
      const tMatch = fStr.match(/[T ](\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?/);
      if (tMatch) {
        return `${tMatch[1].padStart(2, '0')}:${tMatch[2]}:${tMatch[3] || '00'}`;
      }
    }
  }

  return "00:00:00";
}

export function formatLocalISOString(dateVal: any): string {
  if (!dateVal) return "";
  if (dateVal instanceof Date) {
    const yyyy = dateVal.getFullYear();
    const mm = String(dateVal.getMonth() + 1).padStart(2, '0');
    const dd = String(dateVal.getDate()).padStart(2, '0');
    const hh = String(dateVal.getHours()).padStart(2, '0');
    const min = String(dateVal.getMinutes()).padStart(2, '0');
    const sec = String(dateVal.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${min}:${sec}`;
  }
  
  const str = String(dateVal).trim();
  const dateStr = cleanOracleDate(str);
  const timeStr = formatTimeOnly(null, str);
  return `${dateStr}T${timeStr}`;
}

export function combineDateTime(dateVal: any, timeVal: any): string {
  const dateStr = formatLocalDateOnly(dateVal) || formatLocalDateOnly(new Date())!;
  const timeStr = formatTimeOnly(timeVal, dateVal);
  return `${dateStr}T${timeStr}`;
}

/**
 * Converts legacy Oracle numeric COUNTER_NO (e.g. 12345, 10235, 123456, 45) to "HH:MM:SS" timecode.
 * In Oracle, numeric counter values represent concatenated digits of hours, minutes, and seconds (HHMMSS)
 * where leading zeros were dropped by Oracle's numeric column.
 * e.g. 12345 -> "012345" -> "01:23:45" (1h 23m 45s - not 12345 total seconds)
 *      45    -> "000045" -> "00:00:45"
 *      10235 -> "010235" -> "01:02:35"
 */
export function parseOracleCounterToTimecode(val: any): string {
  if (val === undefined || val === null) return '00:00:00';
  const strVal = String(val).trim();
  if (!strVal || strVal === '0' || strVal === '00:00:00') return '00:00:00';

  if (strVal.includes(':')) {
    const parts = strVal.split(':').map(p => p.trim());
    if (parts.length === 3) {
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:${parts[2].padStart(2, '0')}`;
    } else if (parts.length === 2) {
      return `00:${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    } else if (parts.length === 1) {
      return `00:00:${parts[0].padStart(2, '0')}`;
    }
  }

  const digits = strVal.replace(/\D/g, '');
  if (!digits) return '00:00:00';

  const padded = digits.padStart(6, '0');
  const ss = padded.slice(-2);
  const mm = padded.slice(-4, -2);
  const hh = padded.slice(0, -4).padStart(2, '0');

  return `${hh}:${mm}:${ss}`;
}

export function timecodeToSeconds(timecode: string): number {
  if (!timecode) return 0;
  const parts = timecode.split(':').map(p => parseInt(p, 10) || 0);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parts[0] || 0;
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

    const getCol = (r: any, keys: string[]) => {
      for (const k of keys) {
        const v = r[k] ?? r[k.toLowerCase()] ?? r[k.toUpperCase()];
        if (v !== undefined && v !== null && String(v).trim() !== "") return v;
      }
      return null;
    };

    // Determine unit defaults based on source unit
    const defUnitRaw = String(getCol(pipeRow, ['DEF_UNIT']) || (isImperial ? "I" : "M")).toUpperCase();
    const isImp = defUnitRaw.startsWith("I") || defUnitRaw === "1" || defUnitRaw === "FT";

    const pipeTitle = String(getCol(pipeRow, ['TITLE', 'NAME']) || `PIPELINE-${structureId}`).trim();
    const pipeField = String(getCol(pipeRow, ['PFIELD', 'FIELD']) || "").trim();
    const pipeDesc = String(getCol(pipeRow, ['PDESC', 'DESCRIP', 'DESCRIPTION']) || "").trim();

    // Clean Date (preserve exact local calendar date YYYY-MM-DD without UTC timezone rollback)
    const rawInstDate = getCol(pipeRow, ['INST_DATE', 'I_DATE']);
    const instDateStr = formatLocalDateOnly(rawInstDate);

    const plengthVal = getCol(pipeRow, ['PLENGTH', 'LENGTH']) !== null ? Number(getCol(pipeRow, ['PLENGTH', 'LENGTH'])) : null;
    const endFpVal = getCol(pipeRow, ['END_FP', 'END_KP', 'TO_KP', 'TO_FP']) !== null ? Number(getCol(pipeRow, ['END_FP', 'END_KP', 'TO_KP', 'TO_FP'])) : (plengthVal !== null ? plengthVal : null);

    // Map all technical, location & path specs
    const pgPipeRecord: Record<string, any> = {
      pipe_id: resolvedStructureId,
      title: pipeTitle,
      pfield: pipeField,
      pdesc: pipeDesc,
      ptype: "PIPE",
      def_unit: isImp ? "IMPERIAL" : "METRIC",
      inst_date: instDateStr,
      desg_life: getCol(pipeRow, ['DESG_LIFE', 'DESIGN_LIFE']) !== null ? Number(getCol(pipeRow, ['DESG_LIFE', 'DESIGN_LIFE'])) : null,
      depth: getCol(pipeRow, ['DEPTH', 'WATER_DEPTH']) !== null ? Number(getCol(pipeRow, ['DEPTH', 'WATER_DEPTH'])) : null,
      depth_u: isImp ? "ft" : "m",
      process: getCol(pipeRow, ['PROCESS']) ? String(getCol(pipeRow, ['PROCESS'])).trim() : null,

      // Starts At
      st_loc: getCol(pipeRow, ['ST_LOC', 'START_LOC', 'FROM_LOC']) ? String(getCol(pipeRow, ['ST_LOC', 'START_LOC', 'FROM_LOC'])).trim() : null,
      st_fp: getCol(pipeRow, ['ST_FP', 'ST_KP', 'START_KP', 'START_FP']) !== null ? Number(getCol(pipeRow, ['ST_FP', 'ST_KP', 'START_KP', 'START_FP'])) : (pipeRow.ST_FP !== undefined ? Number(pipeRow.ST_FP) : null),
      st_x: getCol(pipeRow, ['ST_X', 'ST_EAST', 'START_EAST', 'START_X']) !== null ? String(getCol(pipeRow, ['ST_X', 'ST_EAST', 'START_EAST', 'START_X'])).trim() : null,
      st_y: getCol(pipeRow, ['ST_Y', 'ST_NORTH', 'START_NORTH', 'START_Y']) !== null ? String(getCol(pipeRow, ['ST_Y', 'ST_NORTH', 'START_NORTH', 'START_Y'])).trim() : null,

      // Ends At
      end_loc: getCol(pipeRow, ['END_LOC', 'TO_LOC']) ? String(getCol(pipeRow, ['END_LOC', 'TO_LOC'])).trim() : null,
      end_fp: endFpVal,
      end_x: getCol(pipeRow, ['END_X', 'END_EAST', 'TO_EAST', 'TO_X']) !== null ? String(getCol(pipeRow, ['END_X', 'END_EAST', 'TO_EAST', 'TO_X'])).trim() : null,
      end_y: getCol(pipeRow, ['END_Y', 'END_NORTH', 'TO_NORTH', 'TO_Y']) !== null ? String(getCol(pipeRow, ['END_Y', 'END_NORTH', 'TO_NORTH', 'TO_Y'])).trim() : null,

      // Dimensions & Parameters
      plength: plengthVal !== null ? plengthVal : endFpVal,
      plength_u: isImp ? "mile" : "km",
      line_diam: getCol(pipeRow, ['LINE_DIAM', 'DIAMETER', 'DIAM']) !== null ? Number(getCol(pipeRow, ['LINE_DIAM', 'DIAMETER', 'DIAM'])) : null,
      line_diam_u: isImp ? "in" : "mm",
      wall_thk: getCol(pipeRow, ['WALL_THK', 'WALL_THICKNESS', 'THK']) !== null ? Number(getCol(pipeRow, ['WALL_THK', 'WALL_THICKNESS', 'THK'])) : null,
      wall_thk_u: isImp ? "in" : "mm",
      material: getCol(pipeRow, ['MATERIAL', 'MAT']) ? String(getCol(pipeRow, ['MATERIAL', 'MAT'])).trim() : null,

      // Protection & Coatings
      cp_system: getCol(pipeRow, ['CP_SYSTEM', 'CP_SYS']) ? String(getCol(pipeRow, ['CP_SYSTEM', 'CP_SYS'])).trim() : null,
      corr_ctg: getCol(pipeRow, ['CORR_CTG', 'CORROSION_COATING']) ? String(getCol(pipeRow, ['CORR_CTG', 'CORROSION_COATING'])).trim() : null,
      conc_ctg: getCol(pipeRow, ['CONC_CTG', 'CONCRETE_COATING']) ? String(getCol(pipeRow, ['CONC_CTG', 'CONCRETE_COATING'])).trim() : null,
      conc_ctg_per: getCol(pipeRow, ['CONC_CTG_PER', 'CONC_PER', 'CONCRETE_PCT']) !== null ? Number(getCol(pipeRow, ['CONC_CTG_PER', 'CONC_PER', 'CONCRETE_PCT'])) : null,

      // Pressures & Spans
      desg_press: getCol(pipeRow, ['DESG_PRESS', 'DESIGN_PRESSURE']) !== null ? Number(getCol(pipeRow, ['DESG_PRESS', 'DESIGN_PRESSURE'])) : null,
      oper_press: getCol(pipeRow, ['OPER_PRESS', 'OPERATING_PRESSURE']) !== null ? Number(getCol(pipeRow, ['OPER_PRESS', 'OPERATING_PRESSURE'])) : null,
      burial: getCol(pipeRow, ['BURIAL', 'LINE_BURIED', 'BURIAL_PCT']) !== null ? Number(getCol(pipeRow, ['BURIAL', 'LINE_BURIED', 'BURIAL_PCT'])) : null,
      span_cons: getCol(pipeRow, ['SPAN_CONS', 'CONST_SPAN']) !== null ? Number(getCol(pipeRow, ['SPAN_CONS', 'CONST_SPAN'])) : null,
      span_oper: getCol(pipeRow, ['SPAN_OPER', 'OPER_SPAN']) !== null ? Number(getCol(pipeRow, ['SPAN_OPER', 'OPER_SPAN'])) : null,

      an_qty: getCol(pipeRow, ['AN_QTY']) ? Number(getCol(pipeRow, ['AN_QTY'])) : null,
      an_type: getCol(pipeRow, ['AN_TYPE']) ? String(getCol(pipeRow, ['AN_TYPE'])).trim() : null,
      inst_ctr: getCol(pipeRow, ['INST_CTR', 'CONTRACTOR']) ? String(getCol(pipeRow, ['INST_CTR', 'CONTRACTOR'])).trim() : null,
      plegs: getCol(pipeRow, ['PLEGS']) ? String(getCol(pipeRow, ['PLEGS'])).trim() : null,
      cr_user: getCol(pipeRow, ['CR_USER']) ? String(getCol(pipeRow, ['CR_USER'])).trim() : null,
      cr_date: getCol(pipeRow, ['CR_DATE']) ? formatLocalISOString(getCol(pipeRow, ['CR_DATE'])) : null,
    };

    // 1. Ensure parent record in structure table
    const { error: parentErr } = await supabase
      .from("structure")
      .upsert({ str_id: resolvedStructureId, str_type: "PIPELINE" }, { onConflict: "str_id" });

    if (parentErr) {
      logs.push(`[Pipeline Engine] Warning: inserting parent structure: ${parentErr.message}`);
    }

    // 2. Upsert into u_pipeline
    const { data: existingPipe } = await supabase
      .from("u_pipeline")
      .select("pipe_id")
      .eq("pipe_id", resolvedStructureId)
      .maybeSingle();

    if (existingPipe && !ctx.updateStructureSpecs) {
      logs.push(`[Pipeline Engine] Pipeline master specs already exist for ID ${resolvedStructureId}. Preserving existing specs (updateStructureSpecs is disabled).`);
    } else {
      const { error: pipeErr } = await supabase
        .from("u_pipeline")
        .upsert(pgPipeRecord, { onConflict: "pipe_id" });

      if (pipeErr) {
        throw pipeErr;
      }
    }

    // 3. Ensure Default Component exists with KP matching pipeline length
    const resolvedPipeLength = plengthVal !== null ? plengthVal : (endFpVal !== null ? endFpVal : 10.6);
    const { data: existingComp } = await (supabase.from as any)("structure_components")
      .select("id")
      .eq("structure_id", resolvedStructureId)
      .limit(1)
      .maybeSingle();

    const defaultCompMetadata = {
      kp_start: 0,
      kp_end: resolvedPipeLength,
      start_kp: 0,
      end_kp: resolvedPipeLength,
      kp: `0.000 - ${resolvedPipeLength}`,
      kp_u: "km",
      kp_unit: "km",
      start_kp_unit: "km",
      end_kp_unit: "km",
      description: "Default Pipeline Trunkline / Main Segment",
      length: resolvedPipeLength,
      st_loc: pgPipeRecord.st_loc,
      end_loc: pgPipeRecord.end_loc,
      easting: pgPipeRecord.st_x,
      northing: pgPipeRecord.st_y,
      st_x: pgPipeRecord.st_x,
      st_y: pgPipeRecord.st_y,
      end_x: pgPipeRecord.end_x,
      end_y: pgPipeRecord.end_y,
      easting_unit: "m",
      northing_unit: "m",
    };

    if (!existingComp) {
      const defaultCompRecord = {
        structure_id: resolvedStructureId,
        comp_id: 999999,
        id_no: "PIPE-MAIN-01",
        q_id: `PIPE-${resolvedStructureId}`,
        code: "PIPE",
        is_deleted: false,
        metadata: defaultCompMetadata
      };
      await (supabase.from as any)("structure_components").insert(defaultCompRecord);
      logs.push(`[Pipeline Engine] Auto-created default pipeline component with KP Range 0.000 - ${resolvedPipeLength} km`);
    } else if (existingComp.comp_id === 999999 || existingComp.id_no === "PIPE-MAIN-01") {
      await (supabase.from as any)("structure_components")
        .update({ metadata: defaultCompMetadata })
        .eq("id", existingComp.id);
      logs.push(`[Pipeline Engine] Updated default pipeline component with KP Range 0.000 - ${resolvedPipeLength} km`);
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
      comp_id: 999999,
      code: "PIPE",
      id_no: "PIPE-MAIN-01",
      q_id: defaultPipelineQid,
      is_deleted: false,
      metadata: {
        unitSystem: isImperial ? "Imperial" : "Metric",
        type: "PIPELINE",
        description: `Pipeline Main Line (${resolvedStructureId})`
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
        id_no: idNo || qid || `COMP-${oracleCompId}`,
        q_id: qid,
        is_deleted: false,
        metadata: {
          unitSystem: isImperial ? "Imperial" : "Metric",
          oracleCompId: oracleCompId,
          code: code,
          description: descrip || `${code} ${qid}`,
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
    isImperial,
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
    // 1. Query NAVIG table with SELECT * to guarantee all legacy columns are extracted
    const targetInspNos = (ctx.selectedInspNos && ctx.selectedInspNos.length > 0)
      ? ctx.selectedInspNos.map(String)
      : (selectedInspNo ? [String(selectedInspNo)] : []);

    let navigQuery = `SELECT * FROM NAVIG WHERE STR_ID = :strId AND INSP_ID IS NOT NULL AND INSP_ID > 0`;
    const binds: any = { strId: structureId };

    if (targetInspNos.length === 1) {
      navigQuery += ` AND INSPNO = :inspNo`;
      binds.inspNo = targetInspNos[0];
    } else if (targetInspNos.length > 1) {
      const placeholders = targetInspNos.map((_, i) => `:i${i}`).join(', ');
      targetInspNos.forEach((val, i) => { binds[`i${i}`] = val; });
      navigQuery += ` AND INSPNO IN (${placeholders})`;
    }
    navigQuery += ` ORDER BY INSP_ID ASC`;

    let rows: any[] = [];
    try {
      const res = await oracleConn.execute(navigQuery, binds);
      rows = res.rows || [];
    } catch (queryErr: any) {
      logs.push(`[Pipeline Engine] Primary NAVIG query failed (${queryErr.message}). Retrying...`);
      const fbRes = await oracleConn.execute(`SELECT * FROM NAVIG WHERE STR_ID = :strId`, { strId: structureId });
      rows = fbRes.rows || [];
    }

    if (!rows || rows.length === 0) {
      logs.push(`[Pipeline Engine] No records found in Oracle NAVIG table for structure ${structureId}.`);
      report[reportKey].status = "success";
      return;
    }

    report[reportKey].oracleRows = rows.length;
    logs.push(`[Pipeline Engine] Found ${rows.length} NAVIG survey records in Oracle. Unit mode: ${isImperial ? "IMPERIAL" : "METRIC"}. Processing...`);

    // Resolve PostgreSQL inspection_type_id for NAVIG
    let navigTypeId: number | null = null;
    try {
      const { data: tData } = await (supabase.from as any)("inspection_type")
        .select("id")
        .eq("code", "NAVIG")
        .limit(1)
        .maybeSingle();
      if (tData?.id) navigTypeId = Number(tData.id);
    } catch (_) {}

    // Fetch default pipeline component ID for fallback, or auto-create one if none exists
    let defaultCompId = compIdMap.get(0) || compIdMap.get(999999) || null;
    if (!defaultCompId) {
      const { data: cData } = await (supabase.from as any)("structure_components")
        .select("id")
        .eq("structure_id", resolvedStructureId)
        .limit(1)
        .maybeSingle();
      if (cData) defaultCompId = Number(cData.id);
    }

    if (!defaultCompId) {
      logs.push(`[Pipeline Engine] No component found for structure ${resolvedStructureId}. Auto-creating default Pipeline component...`);
      
      let pipeKpEnd = 10.6;
      try {
        const { data: pData } = await (supabase.from as any)("u_pipeline")
          .select("plength, end_fp")
          .eq("pipe_id", resolvedStructureId)
          .maybeSingle();
        if (pData?.plength || pData?.end_fp) {
          pipeKpEnd = Number(pData.plength || pData.end_fp);
        }
      } catch (_) {}

      const defaultCompRecord = {
        structure_id: resolvedStructureId,
        comp_id: 999999,
        id_no: "PIPE-MAIN-01",
        q_id: `PIPE-${resolvedStructureId}`,
        code: "PIPE",
        is_deleted: false,
        metadata: {
          kp_start: 0,
          kp_end: pipeKpEnd,
          kp_u: "km",
          description: "Default Pipeline Trunkline / Main Segment",
          length: pipeKpEnd,
        }
      };

      const { data: createdComp, error: compErr } = await (supabase.from as any)("structure_components")
        .insert(defaultCompRecord)
        .select("id")
        .single();

      if (createdComp) {
        defaultCompId = Number(createdComp.id);
        compIdMap.set(0, defaultCompId);
        compIdMap.set(999999, defaultCompId);
        logs.push(`[Pipeline Engine] Created default pipeline component ID: ${defaultCompId}`);
      } else if (compErr) {
        logs.push(`[Pipeline Engine] Error auto-creating default component: ${compErr.message}`);
      }
    }

    const recordsToInsert: any[] = [];

    for (let idx = 0; idx < rows.length; idx++) {
      const r = rows[idx];
      const oracleInspId = Number(r.INSP_ID || r.insp_id);
      if (!oracleInspId) continue;

      const getVal = (keys: string[]) => {
        for (const k of keys) {
          const v = (r as any)[k] ?? (r as any)[k.toLowerCase()] ?? (r as any)[k.toUpperCase()];
          if (v !== undefined && v !== null && String(v).trim() !== "") return v;
        }
        return null;
      };

      const inspNo = String(getVal(['INSPNO']) || "").trim();
      const compId = Number(getVal(['COMP_ID']) || 0);
      const diveNo = String(getVal(['DIVE_NO']) || "").trim();
      const tapeNo = String(getVal(['TAPE_NO']) || "").trim();

      // Clean Date & Time directly from Oracle (no timezone offsets, pure local dates)
      const rawDate = getVal(['INSP_DATE', 'I_DATE', 'LOG_DATE', 'CR_DATE', 'DATE']);
      const rawTime = getVal(['INSP_TIME', 'I_TIME', 'LOG_TIME', 'TIME', 'CR_TIME', 'TIMECODE']);

      const inspDate = formatLocalDateOnly(rawDate) || formatLocalDateOnly(new Date())!;
      const inspTime = formatTimeOnly(rawTime, rawDate);

      // Parse COUNTER_NO / TIMECODE
      const rawCounter = getVal(['COUNTER_NO', 'COINTER_NO', 'COUNTER', 'TIMECODE', 'TAPE_COUNT_NO', 'COUNT_NO']);
      let formattedTimecode: string | null = null;
      let counterTotalSeconds: number | null = null;
      if (rawCounter !== undefined && rawCounter !== null && String(rawCounter).trim() !== '') {
        formattedTimecode = parseOracleCounterToTimecode(rawCounter);
        counterTotalSeconds = timecodeToSeconds(formattedTimecode);
      }

      // Numeric extraction
      const rawKp = getVal(['FP', 'KP', 'FP_KP', 'C_FP', 'CROSSING_KP', 'FIX_POINT']);
      const kpNum = rawKp !== null && !isNaN(Number(rawKp)) ? Number(rawKp) : 0;

      const rawEast = getVal(['EASTING', 'E_COORD', 'EAST']);
      const eastNum = rawEast !== null && !isNaN(Number(rawEast)) ? Number(rawEast) : null;

      const rawNorth = getVal(['NORTHING', 'N_COORD', 'NORTH']);
      const northNum = rawNorth !== null && !isNaN(Number(rawNorth)) ? Number(rawNorth) : null;

      const rawDepth = getVal(['DEPTH', 'WATER_DEPTH', 'ELEVATION']);
      const depthNum = rawDepth !== null && !isNaN(Number(rawDepth)) ? Number(rawDepth) : null;

      const rawCp = getVal(['CP_RDG', 'CP_READING', 'CP']);
      const cpVal = rawCp !== null && !isNaN(Number(rawCp)) ? Number(rawCp) : null;

      const rawEvent = String(getVal(['EVENT', 'EVENT_NAME', 'EVT']) || "").trim();
      const rawType = String(getVal(['TYPE', 'EVENT_TYPE', 'TYP']) || "").trim();
      const rawPos = String(getVal(['POS', 'POSITION']) || "").trim();
      const rawDescr = String(getVal(['DESC', 'DESCR', 'EVENT_DESC', 'DESCRIPTION', 'FINDINGS']) || "").trim();
      const rawComments = String(getVal(['COMMENTS', 'REMARKS', 'COMMENT', 'REMARK']) || "").trim();

      // Dimensions & Span/Burial/Scour fields
      const rawLength = getVal(['LENGTH', 'LEN', 'SPAN_LEN', 'BURIAL_LEN', 'SCOUR_LEN', 'SCOUR_LENGTH', 'LENGTH_M', 'LENGTH_FT']);
      const lengthNum = rawLength !== null && !isNaN(Number(rawLength)) ? Number(rawLength) : null;

      const rawHeight = getVal(['HEIGHT', 'HGT', 'SPAN_HGT', 'SCOUR_DEPTH', 'SCOUR_HGT', 'SCOUR_HEIGHT', 'DEP_SCOUR', 'HEIGHT_MM', 'HEIGHT_IN']);
      const heightNum = rawHeight !== null && !isNaN(Number(rawHeight)) ? Number(rawHeight) : null;

      const rawCoverage = getVal(['COVERAGE', 'COV', 'COVERAGE_PCT']);
      const coverageNum = rawCoverage !== null && !isNaN(Number(rawCoverage)) ? Number(rawCoverage) : null;

      // Crossing details
      const rawCLin = String(getVal(['C_LIN', 'CLIN', 'C_LINE', 'CROSSING_LINE', 'LINE']) || "").trim();
      const rawCGap = String(getVal(['C_GAP', 'CGAP', 'GAP', 'CROSSING_GAP']) || "").trim();
      const rawCFp = String(getVal(['C_FP', 'CFP', 'CROSSING_KP', 'CROSSING_FP']) || "").trim();
      const rawCSs = String(getVal(['C_SS', 'CSS', 'SUPPORTS', 'CROSSING_SUPPORTS', 'NUM_SUPPORTS']) || "").trim();
      const rawCType = String(getVal(['C_TYPE', 'CTYPE', 'CROSSING_TYPE']) || "").trim();

      // Unit formatting: Length in m / ft, Height (Span/Scour) in mm / in
      let lengthPrimary = "";
      let lengthSecondary = "";
      let lengthM: number | null = null;
      let lengthFt: number | null = null;
      if (lengthNum !== null) {
        if (isImperial) {
          lengthPrimary = `${lengthNum.toFixed(2)}ft`;
          lengthSecondary = `${(lengthNum / 3.28084).toFixed(2)}m`;
          lengthM = Number((lengthNum / 3.28084).toFixed(2));
          lengthFt = lengthNum;
        } else {
          lengthPrimary = `${lengthNum.toFixed(2)}m`;
          lengthSecondary = `${(lengthNum * 3.28084).toFixed(2)}ft`;
          lengthM = lengthNum;
          lengthFt = Number((lengthNum * 3.28084).toFixed(2));
        }
      }

      let heightPrimary = "";
      let heightSecondary = "";
      let heightMm: number | null = null;
      let heightIn: number | null = null;
      if (heightNum !== null) {
        if (isImperial) {
          // Imperial: inches (in)
          heightPrimary = `${heightNum.toFixed(2)}in`;
          heightSecondary = `${(heightNum * 25.4).toFixed(1)}mm`;
          heightMm = Number((heightNum * 25.4).toFixed(1));
          heightIn = heightNum;
        } else {
          // Metric: millimeters (mm) - NEVER meters for scour/span height!
          heightPrimary = `${heightNum.toFixed(1)}mm`;
          heightSecondary = `${(heightNum / 25.4).toFixed(2)}in`;
          heightMm = heightNum;
          heightIn = Number((heightNum / 25.4).toFixed(2));
        }
      }

      // Match with Event Menu defaults for supplementary metadata
      const eventMatched = matchPipelineEventMenu(rawEvent, rawType, rawPos, rawDescr || rawComments);

      // Prioritize actual Oracle fields, fallback to matched defaults
      const finalEventName = rawEvent || eventMatched.eventName || "-";
      const finalEventType = rawType || eventMatched.eventType || "-";
      const finalEventPosition = rawPos || eventMatched.eventPosition || "-";

      let finalEventDescription = rawDescr;
      if (!finalEventDescription) {
        if (lengthNum !== null && heightNum !== null) {
          finalEventDescription = `LENGTH:${lengthPrimary}/${lengthSecondary}  HEIGHT:${heightPrimary}/${heightSecondary}`;
        } else if (lengthNum !== null) {
          finalEventDescription = `LENGTH:${lengthPrimary}/${lengthSecondary}${coverageNum !== null ? ` COVERAGE:${coverageNum}%` : ''}`;
        } else if (heightNum !== null) {
          finalEventDescription = `HEIGHT:${heightPrimary}/${heightSecondary}`;
        } else {
          finalEventDescription = rawComments || eventMatched.eventDescription || "-";
        }
      }

      const finalFindings = rawComments || rawDescr || eventMatched.findings || "-";

      // Foreign key resolution
      const pgJobpackId = jpIdMap.get(inspNo) || null;
      const rovJobKey = `${inspNo}_${diveNo}`;
      const pgRovJobId = rovJobsCache.get(rovJobKey) || (rovJobsCache.size > 0 ? Array.from(rovJobsCache.values())[0] : null);

      const tapeKey = `ROV_${tapeNo}_${diveNo}`;
      const pgTapeId = tapesCache.get(tapeKey) || null;

      const pgCompId = compIdMap.get(compId) || defaultCompId;
      if (!pgCompId) {
        logs.push(`[Pipeline Engine] Warning: Skipping row ${oracleInspId} because component_id could not be resolved.`);
        continue;
      }

      // SOW Report Number Resolution
      const exactSowKey = `${inspNo}_${compId}_NAVIG`;
      const codeSowKey = `code_${inspNo}_NAVIG`;
      const sowReportNo = sowReportMap.get(exactSowKey) || sowReportMap.get(codeSowKey) || sowReportMap.get(`${inspNo}_NAVIG`) || jobpackDefaultPrefixMap.get(inspNo) || "13124";

      // Anomaly detection: ONLY if ANOM_NO is a real reference or DEFECT is explicitly positive/true
      const rawAnomNo = String(getVal(['ANOM_NO', 'ANOMALY_NO']) || "").trim();
      const hasRealAnomNo = (
        rawAnomNo !== "" &&
        rawAnomNo !== "0" &&
        rawAnomNo !== "-" &&
        rawAnomNo.toUpperCase() !== "NO" &&
        rawAnomNo.toUpperCase() !== "N" &&
        rawAnomNo.toUpperCase() !== "NULL" &&
        rawAnomNo.toUpperCase() !== "NONE"
      );

      const rawDefect = getVal(['DEFECT']);
      let hasDefectFlag = false;
      if (rawDefect !== null && rawDefect !== undefined) {
        const dStr = String(rawDefect).trim().toUpperCase();
        if (dStr === "1" || dStr === "YES" || dStr === "Y" || dStr === "TRUE" || (!isNaN(Number(dStr)) && Number(dStr) > 0)) {
          hasDefectFlag = true;
        }
      }

      const hasAnomaly = hasRealAnomNo || hasDefectFlag;

      // Construct comprehensive JSONB inspection_data with all Metric / Imperial survey fields
      const inspectionData: Record<string, any> = {
        // Snake_case keys expected by Workspace Table and Inspection Form
        event_name: finalEventName,
        event_type: finalEventType,
        event_position: finalEventPosition,
        event_description: finalEventDescription,
        comments: rawComments || rawDescr || "",
        remarks: rawComments || rawDescr || "",
        findings: finalFindings,
        finding_type: hasAnomaly ? "Anomaly" : "Complete",
        findingType: hasAnomaly ? "Anomaly" : "Complete",
        actionName: finalEventName,
        eventCategory: finalEventType,

        // CamelCase keys
        eventName: finalEventName,
        eventType: finalEventType,
        eventPosition: finalEventPosition,
        eventDescription: finalEventDescription,

        // Dimensions & Units (Scour and Span height unit in mm / in)
        length: lengthNum,
        length_u: isImperial ? "ft" : "m",
        length_primary: lengthPrimary,
        length_secondary: lengthSecondary,
        length_m: lengthM,
        length_ft: lengthFt,
        lengthValueNum: lengthNum,

        height: heightNum,
        height_u: isImperial ? "in" : "mm",
        height_unit: isImperial ? "in" : "mm",
        height_primary: heightPrimary,
        height_secondary: heightSecondary,
        height_mm: heightMm,
        height_in: heightIn,
        heightValueNum: heightNum,

        // Scour specific fields
        scour_depth: heightNum,
        scour_depth_u: isImperial ? "in" : "mm",
        scour_height: heightNum,
        scour_height_u: isImperial ? "in" : "mm",
        scour_length: lengthNum,
        scour_length_u: isImperial ? "ft" : "m",
        scour_location: rawPos || "SEABED",

        coverage: coverageNum,
        coverage_pct: coverageNum,

        // Crossing Parameters
        crossing_line: rawCLin,
        crossing_gap: rawCGap,
        crossing_kp: rawCFp,
        crossing_supports: rawCSs,
        crossing_type: rawCType,
        c_lin: rawCLin,
        c_gap: rawCGap,
        c_fp: rawCFp,
        c_ss: rawCSs,
        c_type: rawCType,

        // Navigation Parameters
        kp: kpNum,
        fp_kp: kpNum,
        easting: eastNum !== null ? eastNum : "-",
        northing: northNum !== null ? northNum : "-",
        depth: depthNum !== null ? depthNum : "-",
        water_depth: depthNum !== null ? depthNum : "-",
        depth_u: isImperial ? "ft" : "m",
        kp_u: "km",
        coords_u: isImperial ? "ft" : "m",

        // Cathodic Protection
        cp_reading: cpVal !== null ? cpVal : "",
        cp_rdg: cpVal !== null ? cpVal : "",
        cp_reading_mv: cpVal !== null ? cpVal : "",
        cp: cpVal !== null ? cpVal : "",
        cp_u: "mV",

        // Video & Survey Reference
        timecode: formattedTimecode || "00:00:00",
        counter: formattedTimecode || "00:00:00",
        counter_no: formattedTimecode || "00:00:00",
        _meta_timecode: formattedTimecode || "00:00:00",
        dive_no: diveNo,
        tape_no: tapeNo,
        sow_report_no: sowReportNo,

        // Raw Oracle Data Preserved
        oracle_insp_id: oracleInspId,
        raw_event: rawEvent,
        raw_type: rawType,
        raw_pos: rawPos,
        raw_descr: rawDescr,
        raw_comments: rawComments,
        raw_length: rawLength,
        raw_height: rawHeight,
        raw_coverage: rawCoverage,
      };

      if (hasAnomaly) {
        inspectionData.has_anomaly = true;
        inspectionData.anomaly_no = getVal(['ANOM_NO', 'ANOMALY_NO']) || `A-${oracleInspId}`;
        inspectionData.priority = getVal(['PRIORITY', 'SEVERITY']) || "P1";
      }

      const finalIsoDate = `${inspDate}T${inspTime}`;

      recordsToInsert.push({
        structure_id: resolvedStructureId,
        component_id: pgCompId,
        jobpack_id: pgJobpackId,
        inspection_type_id: navigTypeId,
        rov_job_id: pgRovJobId,
        dive_job_id: null,
        tape_id: pgTapeId,
        tape_count_no: counterTotalSeconds !== null ? String(counterTotalSeconds) : null,
        sow_report_no: sowReportNo,
        inspection_type_code: "NAVIG",
        inspection_date: inspDate,
        inspection_time: inspTime,
        cr_date: finalIsoDate,
        cr_user: 'migration',
        elevation: depthNum,
        fp_kp: kpNum !== null ? String(kpNum) : null,
        has_anomaly: hasAnomaly,
        description: finalEventDescription !== "-" ? finalEventDescription : (rawComments || (finalEventName !== "-" ? finalEventName : "ROV Pipeline Navigation Event")),
        inspection_data: inspectionData,
        status: "COMPLETED",
        _oracle_insp_id: oracleInspId,
      });
    }

    // Batch insert into insp_records with multi-tiered sub-chunk & single-row fallback on statement timeout
    let migratedCount = 0;
    const batchSize = 25;

    for (let b = 0; b < recordsToInsert.length; b += batchSize) {
      const batch = recordsToInsert.slice(b, b + batchSize);
      const insertPayload = batch.map(({ _oracle_insp_id, ...rec }) => rec);

      const { data: inserted, error: insErr } = await (supabase.from as any)("insp_records")
        .insert(insertPayload)
        .select("insp_id");

      if (insErr) {
        logs.push(`[Pipeline Engine] Notice: Batch insert at offset ${b} (${insErr.message}). Retrying in small sub-chunks of 5...`);
        // Retry in small sub-chunks of 5 to bypass statement timeouts
        const subChunkSize = 5;
        for (let sc = 0; sc < batch.length; sc += subChunkSize) {
          const subBatch = batch.slice(sc, sc + subChunkSize);
          const subPayload = subBatch.map(({ _oracle_insp_id, ...rec }) => rec);
          const { data: subInserted, error: subErr } = await (supabase.from as any)("insp_records")
            .insert(subPayload)
            .select("insp_id");

          if (subErr) {
            logs.push(`[Pipeline Engine] Notice: Sub-chunk at ${b + sc} (${subErr.message}). Retrying row-by-row...`);
            // Single-row fallback to ensure 100% record migration
            for (let rIdx = 0; rIdx < subBatch.length; rIdx++) {
              const singleRow = subBatch[rIdx];
              const { _oracle_insp_id, ...singlePayload } = singleRow;
              const { data: singleInserted, error: singleErr } = await (supabase.from as any)("insp_records")
                .insert(singlePayload)
                .select("insp_id");

              if (singleErr) {
                logs.push(`[Pipeline Engine] ERROR inserting row ${b + sc + rIdx}: ${singleErr.message}`);
                report[reportKey].errors.push(singleErr.message);
              } else if (singleInserted?.[0]?.insp_id) {
                migratedCount += 1;
                if (_oracle_insp_id) {
                  inspIdCache.set(_oracle_insp_id, Number(singleInserted[0].insp_id));
                }
              }
            }
          } else if (subInserted) {
            migratedCount += subInserted.length;
            subInserted.forEach((newRec: any, idxInSub: number) => {
              const origOracleId = subBatch[idxInSub]._oracle_insp_id;
              if (origOracleId && newRec.insp_id) {
                inspIdCache.set(origOracleId, Number(newRec.insp_id));
              }
            });
          }
        }
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

    logs.push(`[Pipeline Engine] Successfully migrated ${migratedCount} of ${rows.length} ROV NAVIG inspection records!`);
    report[reportKey].status = migratedCount === rows.length ? "success" : "warning";
    report[reportKey].migratedRows = migratedCount;
    report["INSP_ROV"] = {
      status: migratedCount === rows.length ? "success" : "warning",
      oracleRows: rows.length,
      migratedRows: migratedCount,
      errors: report[reportKey].errors
    };

  } catch (err: any) {
    logs.push(`[Pipeline Engine] ERROR in migratePipelineNavigInspections: ${err.message}`);
    report[reportKey].errors.push(err.message);
    report["INSP_ROV"] = {
      status: "failed",
      oracleRows: 0,
      migratedRows: 0,
      errors: [err.message]
    };
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
