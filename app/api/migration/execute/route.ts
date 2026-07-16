import { NextRequest, NextResponse } from "next/server";
import { getOracleConnection, OracleConnectionConfig } from "@/utils/oracle-db";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { getDefaultUnit } from "@/utils/unit-helpers";
import specUiConfig from "@/utils/spec-ui-config.json";
import { getStorageHandler } from "@/utils/storage-factory";
import fs from "fs";
import path from "path";
import { EXECUTIVE_SUMMARY_TOC } from "@/app/dashboard/reports/executive-summary/constants";


export const maxDuration = 300; // Allow 5 minutes for this route (Vercel/Next.js config)

function setNestedProperty(obj: Record<string, any>, path: string, value: any) {
  if (!path.includes('.')) {
    obj[path] = value;
    return;
  }

  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (current[key] === undefined || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  current[parts[parts.length - 1]] = value;
}

async function getOracleTableColumns(oracleConn: any, tableName: string): Promise<Set<string>> {
  const cols = new Set<string>();
  try {
    const result = await oracleConn.execute(
      `SELECT COLUMN_NAME FROM USER_TAB_COLUMNS WHERE TABLE_NAME = :tName`,
      { tName: tableName.toUpperCase() }
    );
    if (result.rows) {
      result.rows.forEach((r: any) => {
        const cName = r.COLUMN_NAME || r[0] || (typeof r === 'string' ? r : null);
        if (cName) cols.add(String(cName).toUpperCase());
      });
    }
  } catch (err) {
    console.warn(`Could not get columns for ${tableName}:`, err);
  }
  return cols;
}

function cleanOracleDate(str: string): string {
  const s = str.trim().toUpperCase();
  if (!s) {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  const parsed = Date.parse(s);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  const match = s.match(/^(\d{1,2})[-/]([A-Z]{2,3})(?:[-/](\d{2,4}))?$/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const monStr = match[2];
    const yearStr = match[3];

    const months: Record<string, string> = {
      'JA': '01', 'JAN': '01',
      'FE': '02', 'FEB': '02',
      'MA': '03', 'MAR': '03',
      'AP': '04', 'APR': '04',
      'MY': '05', 'MAY': '05',
      'JN': '06', 'JUN': '06',
      'JL': '07', 'JUL': '07',
      'AU': '08', 'AUG': '08',
      'SE': '09', 'SEP': '09',
      'OC': '10', 'OCT': '10',
      'NO': '11', 'NOV': '11',
      'DE': '12', 'DEC': '12'
    };

    let month = '01';
    for (const key of Object.keys(months)) {
      if (monStr.startsWith(key)) {
        month = months[key];
        break;
      }
    }

    let year = new Date().getFullYear();
    if (yearStr) {
      if (yearStr.length === 2) {
        const yr = Number(yearStr);
        year = yr > 50 ? 1900 + yr : 2000 + yr;
      } else {
        year = Number(yearStr);
      }
    }

    return `${year}-${month}-${day}`;
  }

  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatLocalISOString(dateVal: any): string {
  if (!dateVal) return "";
  if (dateVal instanceof Date) {
    const yyyy = dateVal.getFullYear();
    const mm = String(dateVal.getMonth() + 1).padStart(2, '0');
    const dd = String(dateVal.getDate()).padStart(2, '0');
    const hh = String(dateVal.getHours()).padStart(2, '0');
    const min = String(dateVal.getMinutes()).padStart(2, '0');
    const sec = String(dateVal.getSeconds()).padStart(2, '0');
    const ms = String(dateVal.getMilliseconds()).padStart(3, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${min}:${sec}.${ms}`;
  }
  
  const str = String(dateVal).trim();
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ](\d{1,2}):(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?)?/);
  if (isoMatch) {
    const yyyy = isoMatch[1];
    const mm = isoMatch[2].padStart(2, '0');
    const dd = isoMatch[3].padStart(2, '0');
    const hh = (isoMatch[4] || "00").padStart(2, '0');
    const min = (isoMatch[5] || "00").padStart(2, '0');
    const sec = (isoMatch[6] || "00").padStart(2, '0');
    const ms = (isoMatch[7] || "000").padEnd(3, '0').slice(0, 3);
    return `${yyyy}-${mm}-${dd}T${hh}:${min}:${sec}.${ms}`;
  }

  const parsed = Date.parse(str);
  if (isNaN(parsed)) {
    return str;
  }
  const d = new Date(parsed);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const sec = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${sec}.${ms}`;
}

function formatLocalDateOnly(dateVal: any): string | null {
  if (!dateVal) return null;
  if (dateVal instanceof Date) {
    const yyyy = dateVal.getFullYear();
    const mm = String(dateVal.getMonth() + 1).padStart(2, '0');
    const dd = String(dateVal.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  const str = String(dateVal).trim();
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }
  const parsed = Date.parse(str);
  if (isNaN(parsed)) {
    return cleanOracleDate(str);
  }
  const d = new Date(parsed);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getObjProperty(obj: any, propName: string): any {
  if (!obj) return null;
  const upperKey = propName.toUpperCase();
  if (obj[upperKey] !== undefined) return obj[upperKey];
  const lowerKey = propName.toLowerCase();
  if (obj[lowerKey] !== undefined) return obj[lowerKey];
  return obj[propName];
}

function parseOracleMgiProfile(profileStr: string): any[] {
  if (!profileStr) return [];
  const parts = profileStr.split(';').map(p => p.trim()).filter(Boolean);
  return parts.map(part => {
    const hashIdx = part.indexOf('#');
    if (hashIdx === -1) return null;
    const elevStr = part.substring(0, hashIdx).trim();
    const thickStr = part.substring(hashIdx + 1).trim();
    const elev = Number(elevStr);
    const thick = Number(thickStr);
    if (isNaN(elev) || isNaN(thick)) return null;
    
    let from_elevation: string | number = elev;
    if (elev === 0) {
      from_elevation = "MSL";
    } else if (elev === -1000) {
      from_elevation = "Mudline";
    }
    
    return {
      from_elevation,
      max_thickness: thick
    };
  }).filter(Boolean);
}

function getThresholdsSignature(thresholds: any[]): string {
  const getNumericElevation = (val: any): number => {
    if (val === "MSL") return 0;
    if (val === "Mudline") return -1000;
    const num = Number(val);
    return isNaN(num) ? -99999 : num;
  };
  
  const sorted = [...thresholds].sort((a, b) => {
    const elA = getNumericElevation(a.from_elevation);
    const elB = getNumericElevation(b.from_elevation);
    return elB - elA;
  });
  
  return JSON.stringify(sorted.map(t => ({
    from_elevation: t.from_elevation,
    max_thickness: Number(t.max_thickness)
  })));
}


function parseDivingChapter(inspCond: string): string | null {
  if (!inspCond) return null;
  const match = inspCond.match(/chapter\s*(?:number|no)?\s*:?\s*(\d+)/i);
  if (match) return match[1].trim();
  
  const simpleMatch = inspCond.match(/ch\s*(\d+)/i);
  if (simpleMatch) return simpleMatch[1].trim();
  
  return null;
}

function combineDateTime(dateVal: any, timeVal: any): string {
  if (!dateVal) {
    const d = new Date();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return `${dateStr}T${formatTimeOnly(timeVal)}`;
  }

  let dateStr = "";
  if (dateVal instanceof Date) {
    dateStr = `${dateVal.getFullYear()}-${String(dateVal.getMonth() + 1).padStart(2, '0')}-${String(dateVal.getDate()).padStart(2, '0')}`;
  } else {
    const str = String(dateVal).trim();
    const datePartOnly = str.split('T')[0].split(' ')[0].trim();
    const parsed = Date.parse(datePartOnly);
    if (!isNaN(parsed)) {
      const d = new Date(parsed);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      dateStr = `${yyyy}-${mm}-${dd}`;
    } else {
      dateStr = cleanOracleDate(datePartOnly);
    }
  }

  const timeStr = formatTimeOnly(timeVal);
  return `${dateStr}T${timeStr}`;
}

function formatTimeOnly(timeVal: any): string {
  if (timeVal === null || timeVal === undefined) return "00:00:00";
  
  if (timeVal instanceof Date) {
    const hh = String(timeVal.getHours()).padStart(2, '0');
    const mm = String(timeVal.getMinutes()).padStart(2, '0');
    const ss = String(timeVal.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  let str = String(timeVal).trim();
  if (!str) return "00:00:00";

  // If it's a full ISO string or has a 'T'
  if (str.includes('T')) {
    const timePart = str.split('T')[1].split('.')[0].split('Z')[0];
    return timePart;
  }

  // Try to match HH:MM:SS or HH:MM
  const match = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    const hh = match[1].padStart(2, '0');
    const mm = match[2];
    const ss = match[3] || "00";
    return `${hh}:${mm}:${ss}`;
  }

  // Handle HHMMSS or HHMM raw digits format
  const digits = str.replace(/\D/g, '');
  if (digits.length > 0) {
    if (digits.length <= 4) {
      const padded = digits.padStart(4, '0');
      return `${padded.substring(0, 2)}:${padded.substring(2, 4)}:00`;
    } else {
      const padded = digits.padStart(6, '0');
      return `${padded.substring(0, 2)}:${padded.substring(2, 4)}:${padded.substring(4, 6)}`;
    }
  }
  
  return "00:00:00";
}

function getRovMovementType(remarks: string): string {
  const clean = remarks.toLowerCase().trim();
  
  // 1. Exact / Direct matches
  if (clean === 'rov recovered' || clean.includes('rov recovered')) return 'Rov Recovered';
  if (clean === 'rov leaving the worksite' || clean.includes('rov leaving') || clean.includes('leaving the worksite')) return 'Rov Leaving the Worksite';
  if (clean === 'rov launched' || clean.includes('rov launched') || clean === 'rov launch') return 'Rov Launched';
  if (clean === 'rov at the worksite' || clean.includes('rov at worksite') || clean.includes('at the worksite')) return 'Rov at the Worksite';
  if (clean === 'rov on hire' || clean.includes('rov on hire') || clean === 'on hire') return 'Rov On Hire';
  
  // 2. Specific 'Leaving' checks
  if (clean.includes('leave') || clean.includes('leaving') || clean.includes('left') || clean.includes('transit')) {
    return 'Rov Leaving the Worksite';
  }
  
  // 3. Specific 'Recovered' checks
  if (clean.includes('recover') || clean.includes('deck') || clean.includes('onboard') || clean.includes('retrieved')) {
    return 'Rov Recovered';
  }
  
  // 4. Specific 'Launched' checks
  if (clean.includes('launch') || clean.includes('deploy') || clean.includes('in water') || clean.includes('water')) {
    return 'Rov Launched';
  }
  
  // 5. Specific 'At Worksite' checks
  if (clean.includes('worksite') || clean.includes('arrive') || clean.includes('at the') || clean.includes('reached')) {
    return 'Rov at the Worksite';
  }
  
  // 6. Specific 'On Hire' checks
  if (clean.includes('hire') || clean.includes('mobil')) {
    return 'Rov On Hire';
  }
  
  // Fallback
  return 'Rov at the Worksite';
}

function getDiveMovementType(remarks: string): string {
  const clean = remarks.toLowerCase().trim();
  
  // 1. Exact or direct matches
  if (clean === 'left surface' || clean.includes('left surface') || clean.includes('leave surface')) return 'Left Surface';
  if (clean === 'arrived bottom' || clean.includes('arrived bottom') || clean.includes('arrive bottom')) return 'Arrived Bottom';
  if (clean === 'diver at worksite' || clean.includes('diver at worksite') || clean.includes('diver at') || clean.includes('at worksite')) return 'Diver at Worksite';
  if (clean === 'diver left worksite' || clean.includes('diver left worksite') || clean.includes('left worksite') || clean.includes('leave worksite')) return 'Diver Left Worksite';
  if (clean === 'left bottom' || clean.includes('left bottom') || clean.includes('leave bottom')) return 'Left Bottom';
  if (clean === 'arrived surface' || clean.includes('arrived surface') || clean.includes('arrive surface') || clean.includes('back to surface') || clean.includes('on surface')) return 'Arrived Surface';
  
  // 2. Specific 'Left Worksite' checks
  if (clean.includes('left worksite') || clean.includes('leave worksite') || clean.includes('leaving worksite') || clean.includes('diver left')) {
    return 'Diver Left Worksite';
  }
  
  // 3. Specific 'Left Bottom' checks
  if (clean.includes('left bottom') || clean.includes('leave bottom') || clean.includes('leaving bottom') || clean.includes('ascend') || clean.includes('ascending') || clean.includes('ascent')) {
    return 'Left Bottom';
  }
  
  // 4. Specific 'Left Surface' checks
  if (clean.includes('left surface') || clean.includes('leave surface') || clean.includes('leaving surface') || clean.includes('descend') || clean.includes('descending')) {
    return 'Left Surface';
  }
  
  // 5. Specific 'Arrived Bottom' checks
  if (clean.includes('arrive bottom') || clean.includes('arrived bottom') || clean.includes('reached bottom') || clean.includes('bottom')) {
    return 'Arrived Bottom';
  }
  
  // 6. Specific 'Arrived Surface' checks
  if (clean.includes('arrive surface') || clean.includes('arrived surface') || clean.includes('surface') || clean.includes('deck') || clean.includes('onboard')) {
    return 'Arrived Surface';
  }
  
  // 7. Specific 'At Worksite' checks
  if (clean.includes('worksite') || clean.includes('at worksite') || clean.includes('diver at') || clean.includes('arrive worksite') || clean.includes('arrived worksite')) {
    return 'Diver at Worksite';
  }
  
  // Fallback
  return 'Diver at Worksite';
}

function parseComments(comments: string): { subject?: string; chapter?: string; tape?: string; findings?: string } {
  if (!comments) return {};

  const result: { subject?: string; chapter?: string; tape?: string; findings?: string } = {};

  const subjectMatch = comments.match(/subject\s*(?:data)?:\s*([^;]+)/i);
  if (subjectMatch) result.subject = subjectMatch[1].trim();

  const chapterMatch = comments.match(/chapter\s*(?:number|no)?:\s*([^;]+)/i);
  if (chapterMatch) result.chapter = chapterMatch[1].trim();

  const tapeMatch = comments.match(/tape\s*(?:type)?:\s*([^;]+)/i);
  if (tapeMatch) result.tape = tapeMatch[1].trim();

  const findingsMatch = comments.match(/findings?:\s*([^;]+)/i);
  if (findingsMatch) result.findings = findingsMatch[1].trim();

  return result;
}

async function setRlsStatus(disable: boolean, logs: string[]): Promise<boolean> {
  let databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    try {
      const fs = require('fs');
      const path = require('path');
      const envPath = path.resolve(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        const dbUrlMatch = envContent.match(/^\s*DATABASE_URL\s*=\s*(.*)/m);
        if (dbUrlMatch) {
          databaseUrl = dbUrlMatch[1].trim();
        }
      }
    } catch (e) {
      // ignore
    }
  }

  if (!databaseUrl) {
    logs.push(`WARNING: No active DATABASE_URL found in environment or .env.local. Skipping automatic RLS bypass.`);
    return false;
  }

  const { Client } = require('pg');
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    const action = disable ? 'DISABLE' : 'ENABLE';
    logs.push(`Direct PG Connection: Attempting to ${action} RLS on relational tables...`);
    
    const tables = [
      'insp_rov_jobs',
      'insp_dive_jobs',
      'insp_rov_movements',
      'insp_dive_movements',
      'insp_video_tapes',
      'insp_video_logs',
      'insp_records',
      'insp_anomalies',
      'attachment',
      'u_sow',
      'inspection_type',
      'structure_components',
      'comment',
      'u_lib_mast',
      'u_lib_list',
      'u_lib_combo',
      'mgi_profiles',
      'jobpack',
      'u_executive_summaries'
    ];

    for (const table of tables) {
      await client.query(`ALTER TABLE public.${table} ${action} ROW LEVEL SECURITY;`);
      if (disable) {
        // Also grant permissions during disable for anonymous inserts
        await client.query(`GRANT ALL ON public.${table} TO anon, authenticated;`);
      }
    }

    if (disable) {
      await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;`);
    }

    logs.push(`Direct PG Connection: Successfully ${action}D RLS and permissions on all tables.`);
    return true;
  } catch (err: any) {
    logs.push(`WARNING: Direct PG Connection to bypass RLS failed: ${err.message}`);
    return false;
  } finally {
    try {
      await client.end();
    } catch (e) {}
  }
}

function getMimeType(fileType: string): string {
  if (!fileType) return "application/octet-stream";

  const clean = fileType.trim().toLowerCase().replace(/^\./, "");

  if (clean.includes("/")) {
    return clean; // Already structured as a mime type
  }

  const mimeMap: Record<string, string> = {
    "pdf": "application/pdf",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "jpe": "image/jpeg",
    "gif": "image/gif",
    "bmp": "image/bmp",
    "webp": "image/webp",
    "tiff": "image/tiff",
    "tif": "image/tiff",
    "svg": "image/svg+xml",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xls": "application/vnd.ms-excel",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "ppt": "application/vnd.ms-powerpoint",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "txt": "text/plain",
    "csv": "text/csv",
    "rtf": "application/rtf",
    "htm": "text/html",
    "html": "text/html",
    "zip": "application/zip",
    "rar": "application/x-rar-compressed",
    "7z": "application/x-7z-compressed",
    "mp4": "video/mp4",
    "avi": "video/x-msvideo",
    "mov": "video/quicktime",
    "wmv": "video/x-ms-wmv",
    "mkv": "video/x-matroska",
    "webm": "video/webm",
    "mpg": "video/mpeg",
    "mpeg": "video/mpeg",
    "ogg": "video/ogg"
  };

  return mimeMap[clean] || `application/${clean}`;
}

function isBooleanColumn(pgCol: string): boolean {
  const lastPart = pgCol.split('.').pop() || pgCol;
  const pgColLower = lastPart.toLowerCase();

  if (pgColLower.startsWith('is_') ||
    pgColLower.endsWith('_flag') ||
    ['del', 'deleted', 'active', 'enabled', 'primary', 'stiffening', 'liner_reqd'].includes(pgColLower)) {
    return true;
  }

  // Statically detect spec-defined booleans
  if (specUiConfig && specUiConfig.components) {
    for (const comp of specUiConfig.components) {
      const field = comp.fields?.find((f: any) => f.name?.toLowerCase() === pgColLower);
      if (field && field.type === "boolean") {
        return true;
      }
    }
  }

  return false;
}

function coerceValue(pgCol: string, val: any): any {
  if (val instanceof Date) {
    return formatLocalISOString(val);
  }

  if (isBooleanColumn(pgCol)) {
    if (val === null || val === undefined) {
      return false; // Default to false (represents 0 or NO) as requested
    }

    const valStr = typeof val === 'string' ? val.trim() : String(val).trim();
    if (valStr === '') {
      return false; // Default to false for empty
    }

    const valLower = valStr.toLowerCase();
    if (val === 1 || val === true || valLower === '1' || valLower === 'true' || valLower === 'y' || valLower === 'yes') {
      return true;
    }

    // Everything else (0, '0', false, 'false', 'no', 'n') converts to false
    return false;
  }

  return val;
}

function fillRecordUnits(rec: Record<string, any>, isImp: boolean, compCode?: string) {
  // 1. Loop through all top-level keys in the record
  Object.keys(rec).forEach(key => {
    if (key.endsWith("_unit")) {
      const valField = key.replace("_unit", "");
      if (rec[valField] !== undefined && rec[valField] !== null && rec[valField] !== "") {
        if (!rec[key]) {
          const cat = valField.includes("weight") || valField.includes("wt") ? "weight" : "length";
          rec[key] = getDefaultUnit(cat, isImp, valField, compCode) || (isImp ? "ft" : "m");
        }
      }
    }
  });

  // 2. Scan metadata if present
  if (rec.metadata && typeof rec.metadata === 'object' && !Array.isArray(rec.metadata)) {
    const m = rec.metadata;
    Object.keys(m).forEach(key => {
      if (key.endsWith("_unit")) {
        const valField = key.replace("_unit", "");
        if (m[valField] !== undefined && m[valField] !== null && m[valField] !== "") {
          if (!m[key]) {
            const cat = valField.includes("kp") ? "DISTANCE" : (valField.includes("weight") || valField.includes("wt") ? "weight" : "length");
            m[key] = getDefaultUnit(cat, isImp, valField, compCode) || (isImp ? "ft" : "m");
          }
        }
      }
    });

    // 3. Scan metadata.additionalInfo if present
    if (m.additionalInfo && typeof m.additionalInfo === 'object' && !Array.isArray(m.additionalInfo)) {
      const add = m.additionalInfo;
      let componentConfig: any = null;
      if (compCode) {
        componentConfig = specUiConfig.components.find(
          (c: any) => c.code?.toLowerCase() === compCode.toLowerCase()
        );
      }

      Object.keys(add).forEach(key => {
        if (key.endsWith("_unit")) {
          const valField = key.replace("_unit", "");
          if (add[valField] !== undefined && add[valField] !== null && add[valField] !== "") {
            if (!add[key]) {
              const fieldConfig = componentConfig?.fields?.find((f: any) => f.name === valField);
              const category = fieldConfig?.unitcategory || null;
              const resolvedCategory = category || (valField.includes("weight") || valField.includes("wt") ? "weight" : "length");
              add[key] = getDefaultUnit(resolvedCategory, isImp, valField, compCode) || (isImp ? "ft" : "m");
            }
          }
        }
      });
    }
  }
}

interface MigrationPayload {
  config: OracleConnectionConfig;
  structureId: string;
  mappings: Record<string, { oracleCol: string; pgCol: string }[]>;
  selectedInspNo?: string;
  legacyAttachmentPath?: string;
  componentsOnly?: boolean;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const transformStream = new TransformStream();
  const writer = transformStream.writable.getWriter();

  const writeStreamEvent = async (event: any) => {
    try {
      await writer.write(encoder.encode(JSON.stringify(event) + "\n"));
    } catch (err) {
      console.error("Failed to write to stream:", err);
    }
  };

  // Read and validate payload synchronously
  let payload: MigrationPayload;
  try {
    payload = await request.json();
  } catch (err: any) {
    return NextResponse.json({ error: "Invalid payload format" }, { status: 400 });
  }

  const { config, structureId, mappings, selectedInspNo: rawSelectedInspNo, legacyAttachmentPath, componentsOnly } = payload;
  const selectedInspNo = rawSelectedInspNo || (payload as any).inspNo;
  if (!config || !structureId || !mappings) {
    return NextResponse.json({ error: "Missing required payload parameters" }, { status: 400 });
  }

  // Resolve companyId for the logged-in user
  const authSupabase = createClient();
  const { data: { user }, error: authError } = await authSupabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const headerCompanyId = request.headers.get("x-company-id");
  let resolvedCompanyId = headerCompanyId;
  if (!resolvedCompanyId) {
    const { data: membership } = await (authSupabase as any)
      .from("company_memberships")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    resolvedCompanyId = membership?.company_id || undefined;
  }

  if (!resolvedCompanyId) {
    return NextResponse.json({ error: "No active company membership found" }, { status: 403 });
  }

  // Run the migration asynchronously
  (async () => {
    let oracleConn: any;
    const logs: string[] = [];
    const rawReport: Record<string, any> = {};

    // Override logs.push to automatically stream log lines in real time!
    const originalPush = logs.push.bind(logs);
    logs.push = (...items: string[]) => {
      items.forEach(item => {
        writeStreamEvent({ type: "log", message: item }).catch(console.error);
      });
      return originalPush(...items);
    };

    // Override report assignments to stream report updates in real time!
    const report = new Proxy(rawReport, {
      set(target, prop: string, value) {
        target[prop] = value;
        writeStreamEvent({
          type: "table_report",
          table: prop,
          status: value.status,
          oracleRows: value.oracleRows,
          migratedRows: value.migratedRows,
          errors: value.errors,
          filesCopied: value.filesCopied
        }).catch(console.error);
        return true;
      }
    });

    try {
      let resolvedStructureId = Number(structureId);
      let structureTitle = "";

      // Automatically DISABLE Row Level Security (RLS) for dynamic unauthenticated migration execution
      await setRlsStatus(true, logs);

      const useAdmin = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
      const baseSupabase = useAdmin ? createAdminClient() : createClient();

      // Proxy client to automatically inject company_id into all inserts, upserts, and updates
      const supabase = new Proxy(baseSupabase, {
        get(target, prop, receiver) {
          if (prop === 'from') {
            return (tableName: string) => {
              const queryBuilder = (target as any).from(tableName);
              return new Proxy(queryBuilder, {
                get(qbTarget, qbProp, qbReceiver) {
                  if (qbProp === 'insert' || qbProp === 'upsert' || qbProp === 'update') {
                    return (values: any, options: any) => {
                      const injectCompanyId = (row: any) => {
                        if (row && typeof row === 'object') {
                          if (Array.isArray(row)) {
                            return row.map(r => ({ ...r, company_id: resolvedCompanyId }));
                          } else {
                            return { ...row, company_id: resolvedCompanyId };
                          }
                        }
                        return row;
                      };
                      return qbTarget[qbProp](injectCompanyId(values), options);
                    };
                  }
                  return Reflect.get(qbTarget, qbProp, qbReceiver);
                }
              });
            };
          }
          return Reflect.get(target, prop, receiver);
        }
      });

      // Fetch all library items from u_lib_list in PostgreSQL for casing and description mapping
      const libDescMap = new Map<string, string>();
      const libIdToDescMap = new Map<string, string>();
      const anodeTypeLib = new Map<string, string>();
      try {
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;
        while (hasMore) {
          const { data: libList, error: libErr } = await supabase
            .from('u_lib_list')
            .select('lib_id, lib_desc, lib_code')
            .range(page * pageSize, (page + 1) * pageSize - 1);
          
          if (libErr) throw libErr;
          
          if (libList && libList.length > 0) {
            libList.forEach((item: any) => {
              if (item.lib_desc) {
                libDescMap.set(item.lib_desc.toLowerCase().trim(), item.lib_desc.trim());
                if (item.lib_code === 'ANOD_TYP') {
                  anodeTypeLib.set(item.lib_desc.toLowerCase().trim(), item.lib_desc.trim());
                  if (item.lib_id) {
                    anodeTypeLib.set(item.lib_id.toLowerCase().trim(), item.lib_desc.trim());
                  }
                }
              }
              if (item.lib_id && item.lib_desc) {
                libIdToDescMap.set(item.lib_id.toLowerCase().trim(), item.lib_desc.trim());
              }
            });
            if (libList.length < pageSize) {
              hasMore = false;
            } else {
              page++;
            }
          } else {
            hasMore = false;
          }
        }
      } catch (libErr: any) {
        logs.push(`WARNING: Failed to fetch library items from u_lib_list: ${libErr.message}`);
      }

      oracleConn = await getOracleConnection(config);

      // Initialize default states for UI matching
      report["STRUCTURE"] = { status: "skipped", oracleRows: 0, migratedRows: 0, errors: [], filesCopied: 0 };
      report["U_LIB_MAST"] = { status: "skipped", oracleRows: 0, migratedRows: 0, errors: [] };
      report["U_LIB_LIST"] = { status: "skipped", oracleRows: 0, migratedRows: 0, errors: [] };
      report["U_LIB_COMBO"] = { status: "skipped", oracleRows: 0, migratedRows: 0, errors: [] };
      report["U_MGI_PROFILE"] = { status: "skipped", oracleRows: 0, migratedRows: 0, errors: [] };
      ["STR_ELV", "STR_LEVEL", "STR_FACES", "ATTACHMENT", "COMMENT", "U_ASSOC", "JOBPACK", "LOGS_JOBS", "LOGS_MOVEMENTS", "VIDEO", "INSP_ROV", "INSP_DIVING", "ANOMALY", "INSP_ATTACHMENT", "COMP_NOT_INSP", "EXSUM"].forEach(k => {
        report[k] = { status: "skipped", oracleRows: 0, migratedRows: 0, errors: [], filesCopied: 0 };
      });

      // =========================================================================
      // BEFORE ANY OTHER MIGRATION: Migrate Library Tables (u_lib_mast, u_lib_list, u_lib_combo)
      // =========================================================================
      await writeStreamEvent({ type: "progress", current: 1, total: 9, label: "Initializing references & reference libraries...", percent: 5 });
      logs.push("Starting Library tables migration (u_lib_mast -> u_lib_list -> u_lib_combo)...");
    
    // 1. u_lib_mast
    try {
      const mastResult = await oracleConn.execute(`SELECT * FROM U_LIB_MAST`);
      const mastRows = mastResult.rows || [];
      logs.push(`Fetched ${mastRows.length} master library records from Oracle (U_LIB_MAST).`);
      
      if (mastRows.length > 0) {
        const mastRecords = mastRows.map((r: any) => ({
          lib_code: String(r.LIB_CODE || "").trim(),
          lib_name: String(r.LIB_NAME || "").trim(),
          comment: r.COMMENT ? String(r.COMMENT).trim() : null,
          hidden_item: r.HIDDEN_ITEM ? String(r.HIDDEN_ITEM).trim() : 'N'
        }));
        
        // Deduplicate records to avoid duplicate key violations in single batch
        const uniqueMastRecords: any[] = [];
        const seenMastKeys = new Set<string>();
        for (const record of mastRecords) {
          const key = record.lib_code;
          if (!seenMastKeys.has(key)) {
            seenMastKeys.add(key);
            uniqueMastRecords.push(record);
          }
        }

        const { error: mastErr } = await supabase
          .from('u_lib_mast')
          .upsert(uniqueMastRecords, { onConflict: 'lib_code' });
          
        if (mastErr) {
          logs.push(`ERROR migrating u_lib_mast: ${mastErr.message}`);
          report["U_LIB_MAST"] = { status: "failed", oracleRows: uniqueMastRecords.length, migratedRows: 0, errors: [mastErr.message] };
        } else {
          logs.push(`Successfully migrated ${uniqueMastRecords.length} records to u_lib_mast.`);
          report["U_LIB_MAST"] = { status: "success", oracleRows: uniqueMastRecords.length, migratedRows: uniqueMastRecords.length, errors: [] };
        }
      } else {
        report["U_LIB_MAST"] = { status: "success", oracleRows: 0, migratedRows: 0, errors: [] };
      }
    } catch (err: any) {
      logs.push(`ERROR fetching/migrating U_LIB_MAST: ${err.message}`);
      report["U_LIB_MAST"] = { status: "failed", oracleRows: 0, migratedRows: 0, errors: [err.message] };
    }

    // 2. u_lib_list
    try {
      const listResult = await oracleConn.execute(`SELECT * FROM U_LIB_LIST`);
      const listRows = listResult.rows || [];
      logs.push(`Fetched ${listRows.length} library list records from Oracle (U_LIB_LIST).`);
      
      if (listRows.length > 0) {
        const listRecords = listRows.map((r: any) => {
          let crDate = null;
          if (r.CR_DATE) {
            crDate = formatLocalISOString(r.CR_DATE) || null;
          }
          return {
            lib_code: String(r.LIB_CODE || "").trim(),
            lib_id: String(r.LIB_ID || "").trim(),
            lib_desc: r.LIB_DESC ? String(r.LIB_DESC).trim() : null,
            workunit: r.WORKUNIT ? String(r.WORKUNIT).trim() : null,
            cr_user: r.CR_USER ? String(r.CR_USER).trim() : null,
            cr_date: crDate,
            lib_delete: r.LIB_DELETE !== undefined && r.LIB_DELETE !== null ? Number(r.LIB_DELETE) : 0,
            lib_com: r.LIB_COM ? String(r.LIB_COM).trim() : null,
            hidden_item: r.HIDDEN_ITEM ? String(r.HIDDEN_ITEM).trim() : null
          };
        });

        // Deduplicate records to avoid "ON CONFLICT DO UPDATE command cannot affect row a second time"
        const uniqueListRecords: any[] = [];
        const seenListKeys = new Set<string>();
        for (const record of listRecords) {
          const key = `${record.lib_code}::${record.lib_id}`;
          if (!seenListKeys.has(key)) {
            seenListKeys.add(key);
            uniqueListRecords.push(record);
          }
        }
        
        // Upsert in batches of 1000 to be safe
        const batchSize = 1000;
        let successCount = 0;
        const listErrors: string[] = [];
        for (let i = 0; i < uniqueListRecords.length; i += batchSize) {
          const batch = uniqueListRecords.slice(i, i + batchSize);
          const { error: listErr } = await supabase
            .from('u_lib_list')
            .upsert(batch, { onConflict: 'lib_code,lib_id' });
            
          if (listErr) {
            logs.push(`ERROR migrating u_lib_list batch starting at index ${i}: ${listErr.message}`);
            listErrors.push(listErr.message);
          } else {
            successCount += batch.length;
          }
        }
        logs.push(`Successfully migrated ${successCount}/${uniqueListRecords.length} records to u_lib_list.`);
        report["U_LIB_LIST"] = {
          status: listErrors.length > 0 ? "failed" : "success",
          oracleRows: uniqueListRecords.length,
          migratedRows: successCount,
          errors: listErrors
        };

        // Re-populate and sync local maps with newly migrated records so later phases have complete mappings
        uniqueListRecords.forEach((item: any) => {
          if (item.lib_desc) {
            libDescMap.set(item.lib_desc.toLowerCase().trim(), item.lib_desc.trim());
            if (item.lib_code === 'ANOD_TYP') {
              anodeTypeLib.set(item.lib_desc.toLowerCase().trim(), item.lib_desc.trim());
              if (item.lib_id) {
                anodeTypeLib.set(item.lib_id.toLowerCase().trim(), item.lib_desc.trim());
              }
            }
          }
          if (item.lib_id && item.lib_desc) {
            libIdToDescMap.set(item.lib_id.toLowerCase().trim(), item.lib_desc.trim());
          }
        });
        logs.push(`Updated library lookup maps with ${uniqueListRecords.length} migrated keys.`);
      } else {
        report["U_LIB_LIST"] = { status: "success", oracleRows: 0, migratedRows: 0, errors: [] };
      }
    } catch (err: any) {
      logs.push(`ERROR fetching/migrating U_LIB_LIST: ${err.message}`);
      report["U_LIB_LIST"] = { status: "failed", oracleRows: 0, migratedRows: 0, errors: [err.message] };
    }

    // 3. u_lib_combo
    try {
      const comboResult = await oracleConn.execute(`SELECT * FROM U_LIB_COMBO`);
      const comboRows = comboResult.rows || [];
      logs.push(`Fetched ${comboRows.length} library combo records from Oracle (U_LIB_COMBO).`);
      
      if (comboRows.length > 0) {
        const comboRecords = comboRows.map((r: any) => {
          let crDate = null;
          if (r.CR_DATE) {
            crDate = formatLocalISOString(r.CR_DATE) || null;
          }
          return {
            lib_code: String(r.LIB_CODE || "").trim(),
            code_1: String(r.CODE_1 || "").trim(),
            code_2: String(r.CODE_2 || "").trim(),
            workunit: r.WORKUNIT ? String(r.WORKUNIT).trim() : null,
            cr_user: r.CR_USER ? String(r.CR_USER).trim() : null,
            cr_date: crDate,
            lib_delete: r.LIB_DELETE !== undefined && r.LIB_DELETE !== null ? Number(r.LIB_DELETE) : 0,
            lib_com: r.LIB_COM ? String(r.LIB_COM).trim() : null,
            hidden_item: r.HIDDEN_ITEM ? String(r.HIDDEN_ITEM).trim() : 'N'
          };
        });

        // Deduplicate records to avoid duplicate key violations in single batch
        const uniqueComboRecords: any[] = [];
        const seenComboKeys = new Set<string>();
        for (const record of comboRecords) {
          const key = `${record.lib_code}::${record.code_1}::${record.code_2}`;
          if (!seenComboKeys.has(key)) {
            seenComboKeys.add(key);
            uniqueComboRecords.push(record);
          }
        }
        
        // Upsert in batches of 1000 to be safe
        const batchSize = 1000;
        let successCount = 0;
        const comboErrors: string[] = [];
        for (let i = 0; i < uniqueComboRecords.length; i += batchSize) {
          const batch = uniqueComboRecords.slice(i, i + batchSize);
          const { error: comboErr } = await supabase
            .from('u_lib_combo')
            .upsert(batch, { onConflict: 'lib_code,code_1,code_2' });
            
          if (comboErr) {
            logs.push(`ERROR migrating u_lib_combo batch starting at index ${i}: ${comboErr.message}`);
            comboErrors.push(comboErr.message);
          } else {
            successCount += batch.length;
          }
        }
        logs.push(`Successfully migrated ${successCount}/${uniqueComboRecords.length} records to u_lib_combo.`);
        report["U_LIB_COMBO"] = {
          status: comboErrors.length > 0 ? "failed" : "success",
          oracleRows: uniqueComboRecords.length,
          migratedRows: successCount,
          errors: comboErrors
        };
      } else {
        report["U_LIB_COMBO"] = { status: "success", oracleRows: 0, migratedRows: 0, errors: [] };
      }
    } catch (err: any) {
      logs.push(`ERROR fetching/migrating U_LIB_COMBO: ${err.message}`);
      report["U_LIB_COMBO"] = { status: "failed", oracleRows: 0, migratedRows: 0, errors: [err.message] };
    }
    logs.push("Completed Library tables migration.");

    const tapeToDiveMap = new Map<string, string>();
    const inspNoToDiveMap = new Map<string, string>();

    logs.push(`Started migration for Structure ID: ${structureId}`);

    // Query Structure Unit Type (DEF_UNIT)
    let structureUnit = "METRIC";
    try {
      const unitResult = await oracleConn.execute(
        `SELECT DEF_UNIT FROM v_structure WHERE STR_ID = :strId`,
        { strId: structureId }
      );
      if (unitResult.rows && unitResult.rows.length > 0) {
        const row: any = unitResult.rows[0];
        const val = String((row.DEF_UNIT || row[0]) || "").toUpperCase().trim();
        if (val === "IMPERIAL" || val === "METRIC") {
          structureUnit = val;
        }
      }
    } catch (unitErr: any) {
      logs.push(`WARNING: Could not fetch DEF_UNIT from v_structure: ${unitErr.message}`);
    }
    logs.push(`Structure Unit Type determined as: ${structureUnit}`);
    const isImperial = structureUnit === "IMPERIAL";

    // Query Structure Name/Title from Oracle
    try {
      const nameResult = await oracleConn.execute(
        `SELECT NAME FROM v_structure WHERE STR_ID = :strId`,
        { strId: structureId }
      );
      if (nameResult.rows && nameResult.rows.length > 0) {
        const row: any = nameResult.rows[0];
        structureTitle = String(row.NAME || row[0] || "").trim();
      }
    } catch (nameErr1: any) {
      try {
        const nameResult2 = await oracleConn.execute(
          `SELECT TITLE FROM v_structure WHERE STR_ID = :strId`,
          { strId: structureId }
        );
        if (nameResult2.rows && nameResult2.rows.length > 0) {
          const row: any = nameResult2.rows[0];
          structureTitle = String(row.TITLE || row[0] || "").trim();
        }
      } catch (nameErr2: any) {
        logs.push(`WARNING: Could not fetch NAME or TITLE from Oracle v_structure: ${nameErr2.message}`);
      }
    }
    if (structureTitle) {
      logs.push(`Legacy Structure Name resolved as: "${structureTitle}"`);
    }

    let targetTable = "platform";
    let structureSuccess = true; // Default to true if skipped

    // --- 1. MIGRATE STRUCTURE ---
    await writeStreamEvent({ type: "progress", current: 2, total: 9, label: "Migrating primary Structure master...", percent: 15 });
    const strMappings = mappings["STRUCTURE"] || [];
    if (strMappings.length > 0) {
      structureSuccess = false; // must succeed if mapped
      report["STRUCTURE"].status = "failed"; // set to failed by default once mapped, success later

      // Build dynamic SELECT query based on mapped Oracle columns
      const oracleColumns = strMappings.map(m => m.oracleCol).filter(Boolean);
      if (oracleColumns.length > 0) {
        // Dynamically determine the source table based on primary key mappings
        let oracleTable = 'v_structure';
        let idCol = 'STR_ID';

        if (oracleColumns.includes('PLAT_ID')) {
          oracleTable = 'PLATFORM';
          idCol = 'PLAT_ID';
        } else if (oracleColumns.includes('PIPE_ID')) {
          oracleTable = 'U_PIPELINE';
          idCol = 'PIPE_ID';
        }

        const strQuery = `SELECT ${oracleColumns.join(', ')} FROM ${oracleTable} WHERE ${idCol} = :strId`;
        try {
          const strResult = await oracleConn.execute(strQuery, { strId: structureId });
          const rows = strResult.rows as any[];

          if (rows && rows.length > 0) {
            report["STRUCTURE"].oracleRows = 1;
            const oracleData = rows[0];

            // Map to Postgres format
            const pgRecord: Record<string, any> = {};
            strMappings.forEach(mapping => {
              if (mapping.oracleCol && mapping.pgCol && oracleData[mapping.oracleCol] !== undefined) {
                let val = oracleData[mapping.oracleCol];

                // Prevent timezone recognition issues
                if (typeof val === 'string' && val.toLowerCase().includes('gmt')) {
                  val = formatLocalISOString(val);
                }

                val = coerceValue(mapping.pgCol, val);
                setNestedProperty(pgRecord, mapping.pgCol, val);
              }
            });

            // Set structure spec unit defaults
            fillRecordUnits(pgRecord, isImperial);

            // Determine target table based on PTYPE (Platform or Pipeline)
            const ptypeMappedField = strMappings.find(m => m.oracleCol.toUpperCase() === "PTYPE")?.pgCol;
            if (ptypeMappedField && pgRecord[ptypeMappedField] === "PIPE") {
              targetTable = "u_pipeline";
            } else if (oracleData["PTYPE"] === "PIPE") {
              targetTable = "u_pipeline";
            }

            const conflictCol = targetTable === "u_pipeline" ? "pipe_id" : "plat_id";

            // Fix mapped id key to avoid conflict
            if (pgRecord.id !== undefined) {
              if (pgRecord[conflictCol] === undefined) {
                pgRecord[conflictCol] = pgRecord.id;
              }
              delete pgRecord.id;
            }

            // Ensure structural primary key is present
            if (pgRecord[conflictCol] === undefined) {
              pgRecord[conflictCol] = resolvedStructureId;
            }

            // --- 3-CASE CONFLICT RESOLUTION ---
            const titleMapping = strMappings.find(
              m => m.oracleCol.toUpperCase() === "TITLE" || m.oracleCol.toUpperCase() === "NAME"
            );
            const titlePgCol = titleMapping?.pgCol || "title";
            const incomingTitle = String(oracleData[titleMapping?.oracleCol || "TITLE"] || "").trim();

            logs.push(`Analyzing structure database conflicts in Postgres...`);

            // Fetch by ID
            const { data: existingById, error: errById } = await supabase
              .from(targetTable as any)
              .select(`${conflictCol}, ${titlePgCol}`)
              .eq(conflictCol, Number(structureId))
              .maybeSingle();

            if (errById) {
              logs.push(`WARNING: Checking structure by ID failed: ${errById.message}`);
            }

            // Fetch by Title (case-insensitive)
            const { data: existingByTitle, error: errByTitle } = await supabase
              .from(targetTable as any)
              .select(`${conflictCol}, ${titlePgCol}`)
              .ilike(titlePgCol, incomingTitle)
              .maybeSingle();

            if (errByTitle) {
              logs.push(`WARNING: Checking structure by Title failed: ${errByTitle.message}`);
            }

            if (existingByTitle) {
              // Case 2: Different ID, Same Title (Alignment / Subsequent migration) -> Reuse the existing Postgres ID
              resolvedStructureId = Number((existingByTitle as any)[conflictCol]);
              (pgRecord as any)[conflictCol] = resolvedStructureId;
              logs.push(`Case 2 Match: Title "${incomingTitle}" already exists in Postgres with ID ${resolvedStructureId}. Reusing this ID for migration.`);
            } else if (existingById) {
              const existingTitle = String((existingById as any)[titlePgCol] || "").trim();
              if (existingTitle.toLowerCase() !== incomingTitle.toLowerCase()) {
                // Case 1: Same ID, Different Title (Collision) -> Generate a new Postgres ID
                const { data: maxResult, error: maxErr } = await supabase
                  .from(targetTable as any)
                  .select(conflictCol)
                  .order(conflictCol, { ascending: false })
                  .limit(1)
                  .maybeSingle();

                if (maxErr) {
                  logs.push(`WARNING: Fetching max ID failed: ${maxErr.message}`);
                }

                const maxId = maxResult ? Number((maxResult as any)[conflictCol]) : 0;
                resolvedStructureId = Math.max(maxId, 10000) + 1;
                (pgRecord as any)[conflictCol] = resolvedStructureId;

                logs.push(`Case 1 Match: ID ${structureId} is already occupied by "${existingTitle}". Generated safe new Postgres ID ${resolvedStructureId} for "${incomingTitle}".`);
              } else {
                // Same ID, Same Title (Re-migration / Update of same structure) -> Normal flow
                resolvedStructureId = Number(structureId);
                (pgRecord as any)[conflictCol] = resolvedStructureId;
                logs.push(`Case 3 Match: Identical structure "${incomingTitle}" (ID ${structureId}) already exists. Updating in-place.`);
              }
            } else {
              // Case 3: No matching ID and no matching Title -> Normal flow
              resolvedStructureId = Number(structureId);
              (pgRecord as any)[conflictCol] = resolvedStructureId;
              logs.push(`Case 3 Match: No existing ID or Title matches in Postgres. Migrating with original Oracle ID ${resolvedStructureId}.`);
            }

            // Ensure the parent record exists in public.structure first to satisfy the foreign key constraint
            const parentStructureObj = {
              str_id: resolvedStructureId,
              str_type: targetTable === 'u_pipeline' ? 'PIPELINE' : 'PLATFORM'
            };
            const { error: parentStructureErr } = await supabase
              .from("structure" as any)
              .upsert(parentStructureObj as any, { onConflict: 'str_id' });
            if (parentStructureErr) {
              logs.push(`WARNING: Failed to insert parent structure record: ${parentStructureErr.message}`);
            }

            // Insert/Upsert in Supabase
            const { error: insertErr } = await supabase
              .from(targetTable as any)
              .upsert(pgRecord as any, { onConflict: conflictCol })
              .select();

            if (insertErr) {
              logs.push(`ERROR inserting structure: ${insertErr.message}`);
              report["STRUCTURE"].errors.push(insertErr.message);
            } else {
              logs.push(`Successfully migrated Structure!`);
              report["STRUCTURE"].status = "success";
              report["STRUCTURE"].migratedRows = 1;
              structureSuccess = true;
              structureTitle = incomingTitle;
            }
          } else {
            logs.push(`WARNING: Structure ID ${structureId} not found in ${oracleTable}.`);
            report["STRUCTURE"].errors.push(`Structure ID not found in ${oracleTable}`);
          }
        } catch (err: any) {
          logs.push(`ERROR querying Oracle Structure: ${err.message}`);
          report["STRUCTURE"].errors.push(err.message);
        }
      }
    } else {
      logs.push("Skipped Structure migration (No mappings defined).");
      report["STRUCTURE"].status = "skipped";
      structureSuccess = true; // allow other mappings if no structural mapping is set
    }

    const compIdMap = new Map<number, number>();
    const qIdMap = new Map<string, number>();
    const compTypeCache = new Map<number, string>();

    // --- 1.5 MIGRATE STRUCTURAL CHILD TABLES ---
    await writeStreamEvent({ type: "progress", current: 3, total: 9, label: "Copying structural elevations & levels...", percent: 25 });
    const structuralTables = ["STR_ELV", "STR_LEVEL", "STR_FACES"];
    if (structureSuccess) {
      for (const childTable of structuralTables) {
        const childMappings = mappings[childTable] || [];
        if (childMappings.length > 0) {
          logs.push(`Migrating ${childTable}...`);
          report[childTable].status = "failed"; // Default once mapped

          const oracleColumns = childMappings.map(m => m.oracleCol).filter(Boolean);
          if (oracleColumns.length > 0) {
            let oracleTableName = childTable;
            let pgTableName = childTable.toLowerCase();
            let fkCol = "PLAT_ID";

            const queryCols = new Set(oracleColumns);
            if (!queryCols.has(fkCol)) queryCols.add(fkCol);

            const query = `SELECT ${Array.from(queryCols).join(', ')} FROM ${oracleTableName} WHERE ${fkCol} = :strId`;

            try {
              const result = await oracleConn.execute(query, { strId: structureId });
              const rows = result.rows as any[];

              if (rows && rows.length > 0) {
                report[childTable].oracleRows = rows.length;
                const pgRecords = rows.map(oracleData => {
                  const pgRecord: Record<string, any> = {};
                  childMappings.forEach(mapping => {
                    if (mapping.oracleCol && mapping.pgCol && oracleData[mapping.oracleCol] !== undefined) {
                      let val = oracleData[mapping.oracleCol];
                      if (typeof val === 'string' && val.toLowerCase().includes('gmt')) {
                        val = formatLocalISOString(val);
                      }
                      
                      if (mapping.pgCol.endsWith("clk_pos")) {
                        // Map Oracle 0-12 (or null/empty) to proper spaced string representation
                        const numVal = (val === null || val === undefined || String(val).trim() === '') ? null : Number(val);
                        if (numVal === null || numVal === 0 || isNaN(numVal)) {
                          val = "N/A";
                        } else if (numVal >= 1 && numVal <= 12) {
                          val = `${numVal} O' CLOCK`;
                        } else {
                          val = "N/A";
                        }
                      } else {
                        val = coerceValue(mapping.pgCol, val);
                      }
                      
                      setNestedProperty(pgRecord, mapping.pgCol, val);
                    }
                  });

                  if (pgRecord['plat_id'] === undefined) {
                    pgRecord['plat_id'] = resolvedStructureId;
                  }

                  return pgRecord;
                });

                // Clear duplicates
                await supabase.from(pgTableName as any).delete().eq('plat_id', resolvedStructureId);

                const { error: insertErr } = await supabase.from(pgTableName as any).insert(pgRecords);

                if (insertErr) {
                  logs.push(`ERROR inserting ${childTable}: ${insertErr.message}`);
                  report[childTable].errors.push(insertErr.message);
                } else {
                  logs.push(`Successfully migrated ${rows.length} rows for ${childTable}!`);
                  report[childTable].status = "success";
                  report[childTable].migratedRows = rows.length;
                }
              } else {
                logs.push(`No ${childTable} records found for Structure ID ${resolvedStructureId}.`);
                report[childTable].status = "success"; // Successfully did nothing
              }
            } catch (err: any) {
              logs.push(`ERROR querying Oracle ${childTable}: ${err.message}`);
              report[childTable].errors.push(err.message);
            }
          }
        }
      }
    }

    // --- 2. MIGRATE COMPONENTS ---
    // Here we iterate over component codes mapped in the dashboard (e.g. AN, CL)
    const childTables = ["STR_ELV", "STR_LEVEL", "STR_FACES", "ATTACHMENT", "COMMENT"];
    const nonComponentKeys = [
      "STRUCTURE", "STRUCTURE_PLATFORM", "STRUCTURE_PIPELINE",
      "ATTACHMENT", "COMMENT",
      "JOBPACK", "JOBPACK_SOW", "U_SOW",
      "LOGS_JOBS", "LOGS_MOVEMENTS", "LOGS_ROV", "LOGS_DIVE",
      "VIDEO", "ANOMALY", "U_ASSOC", "INSP_ATTACHMENT"
    ];
    const componentCodes = Object.keys(mappings).filter(k =>
      !nonComponentKeys.includes(k) &&
      !childTables.includes(k) &&
      !k.startsWith("INSP_ROV") &&
      !k.startsWith("INSP_DIV")
    );

    if (structureSuccess) {
      // Fetch all existing components for this structure to update in place and avoid duplicating/deleting them!
      const existingCompMap = new Map<number, number>(); // comp_id -> pg_id
      try {
        const { data: existingComps } = await supabase
          .from("structure_components")
          .select("id, comp_id")
          .eq("structure_id", resolvedStructureId);
        if (existingComps) {
          existingComps.forEach((c: any) => {
            if (c.comp_id) {
              existingCompMap.set(Number(c.comp_id), Number(c.id));
            }
          });
        }
      } catch (err: any) {
        logs.push(`WARNING: Could not fetch existing components: ${err.message}`);
      }

      await writeStreamEvent({ type: "progress", current: 4, total: 9, label: "Processing mapped components...", percent: 40 });
      for (const code of componentCodes) {
        const compMappings = mappings[code] || [];
        if (compMappings.length === 0) continue;

        report[code] = { status: "failed", oracleRows: 0, migratedRows: 0, errors: [] };
        logs.push(`Migrating ${code} components...`);
        const oracleColumns = compMappings.map(m => m.oracleCol).filter(Boolean);

        if (oracleColumns.length > 0) {
          const queryCols = new Set(oracleColumns);
          if (!queryCols.has('COMP_ID')) queryCols.add('COMP_ID');
          if (!queryCols.has('STR_ID')) queryCols.add('STR_ID');
          if (!queryCols.has('ID_NO')) queryCols.add('ID_NO');
          if (!queryCols.has('Q_ID')) queryCols.add('Q_ID');
          if (!queryCols.has('DEL')) queryCols.add('DEL');

          let specTableName = `${code}_comp`.toUpperCase();
          if (code.toLowerCase() === 'an') {
            specTableName = (targetTable === 'u_pipeline' ? 'an_comp_pipe' : 'an_comp_plat').toUpperCase();
          }

          let query = `
            SELECT c.COMP_ID, c.STR_ID, c.ID_NO, c.Q_ID, c.CODE, c.DEL, s.* 
            FROM ALLCOMPID c
            LEFT JOIN ${specTableName} s ON c.COMP_ID = s.COMP_ID
            WHERE c.STR_ID = :strId AND c.CODE = :code
              AND NOT (NVL(c.DEL, 0) = 1 AND NOT EXISTS (
                SELECT 1 FROM allinspid i WHERE i.COMP_ID = c.COMP_ID AND i.STR_ID = c.STR_ID
              ))
          `;

          try {
            let result;
            let rows: any[] = [];
            try {
              result = await oracleConn.execute(query, { strId: structureId, code: code });
              rows = result.rows as any[];
            } catch (joinErr: any) {
              logs.push(`WARNING: Left join with ${specTableName} failed (${joinErr.message}). Retrying query on ALLCOMPID only...`);
              const fallbackCols = Array.from(queryCols).map(col => `c.${col}`);
              const fallbackQuery = `
                SELECT ${fallbackCols.join(', ')} 
                FROM ALLCOMPID c 
                WHERE c.STR_ID = :strId AND c.CODE = :code
                  AND NOT (NVL(c.DEL, 0) = 1 AND NOT EXISTS (
                    SELECT 1 FROM allinspid i WHERE i.COMP_ID = c.COMP_ID AND i.STR_ID = c.STR_ID
                  ))
              `;
              try {
                result = await oracleConn.execute(fallbackQuery, { strId: structureId, code: code });
                rows = result.rows as any[];
              } catch (fallbackErr: any) {
                logs.push(`ERROR querying Oracle ${code} components: ${fallbackErr.message}`);
                report[code].errors.push(fallbackErr.message);
                continue;
              }
            }

            if (rows && rows.length > 0) {
              report[code].oracleRows = rows.length;
              const pgRecords = rows.map(oracleData => {
                const isDeletedVal = oracleData['DEL'];
                const pgRecord: Record<string, any> = {
                  structure_id: resolvedStructureId,
                  code: code,
                  is_deleted: (isDeletedVal === 1 || String(isDeletedVal) === '1') ? true : false
                };

                compMappings.forEach(mapping => {
                  if (mapping.oracleCol && mapping.pgCol && oracleData[mapping.oracleCol] !== undefined) {
                    let val = oracleData[mapping.oracleCol];
                    if (typeof val === 'string' && val.toLowerCase().includes('gmt')) {
                      val = formatLocalISOString(val);
                    }
                    if (mapping.pgCol.endsWith("clk_pos")) {
                      // Map Oracle 0-12 (or null/empty) to proper spaced string representation
                      const numVal = (val === null || val === undefined || String(val).trim() === '') ? null : Number(val);
                      if (numVal === null || numVal === 0 || isNaN(numVal)) {
                        val = "N/A";
                      } else if (numVal >= 1 && numVal <= 12) {
                        val = `${numVal} O' CLOCK`;
                      } else {
                        val = "N/A";
                      }
                    } else {
                      val = coerceValue(mapping.pgCol, val);
                    }
                    setNestedProperty(pgRecord, mapping.pgCol, val);
                  }
                });

                // Set component unit defaults based on structure unit preference
                fillRecordUnits(pgRecord, isImperial, code);

                if (pgRecord.comp_id === undefined && oracleData['COMP_ID'] !== undefined) {
                  pgRecord.comp_id = Number(oracleData['COMP_ID']);
                }
                if (pgRecord.id_no === undefined && oracleData['ID_NO'] !== undefined) {
                  pgRecord.id_no = String(oracleData['ID_NO']);
                }
                if (pgRecord.q_id === undefined && oracleData['Q_ID'] !== undefined) {
                  pgRecord.q_id = String(oracleData['Q_ID']);
                }
                if (pgRecord.is_deleted === null || pgRecord.is_deleted === undefined) {
                  const isDeletedVal = oracleData['DEL'];
                  pgRecord.is_deleted = (isDeletedVal === 1 || String(isDeletedVal) === '1') ? true : false;
                }

                return pgRecord;
              });

              // Insert or update in place
              const compsToInsert: any[] = [];
              let migratedCount = 0;

              for (const record of pgRecords) {
                const pgId = record.comp_id ? existingCompMap.get(Number(record.comp_id)) : null;
                if (pgId) {
                  // Update existing component in place
                  const { error: updateErr } = await supabase
                    .from("structure_components")
                    .update(record as any)
                    .eq("id", pgId);

                  if (updateErr) {
                    logs.push(`ERROR updating component ${record.q_id || record.comp_id}: ${updateErr.message}`);
                    report[code].errors.push(updateErr.message);
                  } else {
                    migratedCount++;
                    compIdMap.set(Number(record.comp_id), pgId);
                    compTypeCache.set(Number(record.comp_id), code);
                    if (record.q_id) {
                      qIdMap.set(String(record.q_id).trim(), pgId);
                    }
                  }
                } else {
                  // Queue for insertion
                  compsToInsert.push(record);
                }
              }

              if (compsToInsert.length > 0) {
                const { data: insertedComps, error: insertErr } = await supabase
                  .from("structure_components")
                  .insert(compsToInsert)
                  .select("id, comp_id, q_id");

                if (insertErr) {
                  logs.push(`ERROR inserting new ${code} components: ${insertErr.message}`);
                  report[code].errors.push(insertErr.message);
                } else {
                  migratedCount += compsToInsert.length;
                  if (insertedComps) {
                    insertedComps.forEach(comp => {
                      const newPgId = Number(comp.id);
                      if (comp.comp_id) {
                        compIdMap.set(Number(comp.comp_id), newPgId);
                        compTypeCache.set(Number(comp.comp_id), code);
                      }
                      if (comp.q_id) {
                        qIdMap.set(String(comp.q_id).trim(), newPgId);
                      }
                    });
                  }
                }
              }

              logs.push(`Successfully migrated ${migratedCount} components for code ${code}!`);
              report[code].status = "success";
              report[code].migratedRows = migratedCount;
            } else {
              logs.push(`No Oracle components found for code ${code} and Structure ID ${structureId}.`);
              report[code].status = "success";
            }
          } catch (err: any) {
            logs.push(`ERROR querying Oracle ${code} components: ${err.message}`);
            report[code].errors.push(err.message);
          }
        }
      }

      // --- 2.5 MIGRATE COMPONENT ASSOCIATIONS (U_ASSOC) ---
      if (structureSuccess) {
        await writeStreamEvent({ type: "progress", current: 5, total: 9, label: "Resolving component associations...", percent: 60 });
        logs.push("Processing component associations (U_ASSOC)...");
        report["U_ASSOC"].status = "failed";

        // Pre-populate compIdMap, compTypeCache, and qIdMap with ALL existing components for this structure from PostgreSQL
        // to ensure that associations between already migrated components (across all types/runs) are linked!
        try {
          let page = 0;
          const pageSize = 1000;
          let hasMore = true;
          while (hasMore) {
            const { data: existingComps, error } = await supabase
              .from('structure_components')
              .select('id, comp_id, q_id, code')
              .eq('structure_id', resolvedStructureId)
              .range(page * pageSize, (page + 1) * pageSize - 1);
            
            if (error) throw error;
            
            if (!existingComps || existingComps.length === 0) {
              hasMore = false;
            } else {
              existingComps.forEach((comp: any) => {
                if (comp.comp_id) {
                  const compIdNum = Number(comp.comp_id);
                  const pgIdNum = Number(comp.id);
                  compIdMap.set(compIdNum, pgIdNum);
                  compTypeCache.set(compIdNum, String(comp.code || '').trim());
                  if (comp.q_id) {
                    qIdMap.set(String(comp.q_id).trim().toUpperCase(), pgIdNum);
                  }
                }
              });
              if (existingComps.length < pageSize) {
                hasMore = false;
              } else {
                page++;
              }
            }
          }
          logs.push(`Loaded ${compIdMap.size} component mappings from PostgreSQL for hierarchy association linking.`);
        } catch (err: any) {
          logs.push(`WARNING: Loading component mappings for U_ASSOC failed: ${err.message}`);
        }

        if (compIdMap.size === 0) {
          logs.push("No components found in PostgreSQL to associate. Skipping U_ASSOC.");
          report["U_ASSOC"].status = "success";
        } else {
          try {
          const assocQuery = `
            SELECT a.COMP_ID, a.ASSOC_COMPID 
            FROM U_ASSOC a 
            WHERE a.STR_ID = :strId
              AND a.COMP_ID IN (
                SELECT c1.COMP_ID FROM ALLCOMPID c1 
                WHERE c1.STR_ID = :strId
                  AND NOT (NVL(c1.DEL, 0) = 1 AND NOT EXISTS (
                    SELECT 1 FROM allinspid i1 WHERE i1.COMP_ID = c1.COMP_ID AND i1.STR_ID = c1.STR_ID
                  ))
              )
              AND a.ASSOC_COMPID IN (
                SELECT c2.COMP_ID FROM ALLCOMPID c2 
                WHERE c2.STR_ID = :strId
                  AND NOT (NVL(c2.DEL, 0) = 1 AND NOT EXISTS (
                    SELECT 1 FROM allinspid i2 WHERE i2.COMP_ID = c2.COMP_ID AND i2.STR_ID = c2.STR_ID
                  ))
              )
          `;
          const assocResult = await oracleConn.execute(assocQuery, { strId: structureId });
          const assocRows = assocResult.rows as any[];

          if (assocRows && assocRows.length > 0) {
            report["U_ASSOC"].oracleRows = assocRows.length;
            const parentToAssoc = new Map<number, number>();
            const rejectedDetails: { oracleCompId: number; oracleAssocCompId: number; reason: string }[] = [];

            assocRows.forEach(row => {
              const oracleCompId = row.COMP_ID !== undefined ? Number(row.COMP_ID) : null;
              const oracleAssocId = row.ASSOC_COMPID !== undefined ? Number(row.ASSOC_COMPID) : null;

              if (oracleCompId && oracleAssocId) {
                const pgCompId = compIdMap.get(oracleCompId);
                const pgAssocCompId = compIdMap.get(oracleAssocId);

                if (pgCompId && pgAssocCompId) {
                  parentToAssoc.set(pgCompId, pgAssocCompId);
                } else {
                  // Track which side(s) are unmapped
                  const reasons: string[] = [];
                  if (!pgCompId) reasons.push(`COMP_ID ${oracleCompId} not found in Postgres`);
                  if (!pgAssocCompId) reasons.push(`ASSOC_COMPID ${oracleAssocId} not found in Postgres`);
                  rejectedDetails.push({
                    oracleCompId,
                    oracleAssocCompId: oracleAssocId,
                    reason: reasons.join('; ')
                  });
                }
              } else {
                // Null or zero IDs
                rejectedDetails.push({
                  oracleCompId: oracleCompId || 0,
                  oracleAssocCompId: oracleAssocId || 0,
                  reason: 'COMP_ID or ASSOC_COMPID is null/zero in Oracle'
                });
              }
            });

            // Attach rejection details to the report (limit to first 200 for payload size)
            if (rejectedDetails.length > 0) {
              logs.push(`WARNING: ${rejectedDetails.length} U_ASSOC record(s) could not be mapped (component not yet migrated to Postgres).`);
              (report["U_ASSOC"] as any).rejectedDetails = rejectedDetails.slice(0, 200);
              (report["U_ASSOC"] as any).totalRejected = rejectedDetails.length;
            }

            if (parentToAssoc.size > 0) {
              logs.push(`Found ${parentToAssoc.size} valid component-to-component associations to link.`);
              const parentIds = Array.from(parentToAssoc.keys());

              const { data: parents, error: fetchErr } = await supabase
                .from("structure_components")
                .select("id, metadata")
                .in("id", parentIds);

              if (fetchErr) {
                logs.push(`ERROR fetching components for association linking: ${fetchErr.message}`);
                report["U_ASSOC"].errors.push(fetchErr.message);
              } else if (parents) {
                let linkedCount = 0;
                for (const parent of parents) {
                  let metaObj: any = parent.metadata;
                  if (typeof metaObj === 'string') {
                    try {
                      metaObj = JSON.parse(metaObj);
                    } catch {
                      metaObj = {};
                    }
                  }
                  if (!metaObj || typeof metaObj !== 'object' || Array.isArray(metaObj)) {
                    metaObj = {};
                  }

                  metaObj.associated_comp_id = parentToAssoc.get(parent.id);

                  const { error: updateErr } = await supabase
                    .from("structure_components")
                    .update({ metadata: metaObj })
                    .eq("id", parent.id);

                  if (updateErr) {
                    logs.push(`ERROR updating component ${parent.id} association: ${updateErr.message}`);
                    report["U_ASSOC"].errors.push(updateErr.message);
                  } else {
                    linkedCount++;
                  }
                }
                logs.push(`Successfully linked ${linkedCount} component associations in metadata!`);
                report["U_ASSOC"].status = "success";
                report["U_ASSOC"].migratedRows = linkedCount;
              }
            } else {
              logs.push("No matching migrated component pairs found in U_ASSOC.");
              report["U_ASSOC"].status = "success";
            }
          } else {
            logs.push("No component associations found in legacy U_ASSOC table for this structure.");
            report["U_ASSOC"].status = "success";
          }
        } catch (assocErr: any) {
          logs.push(`WARNING component associations check skipped or failed: ${assocErr.message}`);
          report["U_ASSOC"].errors.push(assocErr.message);
        }
      }
      }
    } else {
      logs.push("Skipped components migration because structure migration failed.");
    }

    // --- 3. MIGRATE ATTACHMENTS & COMMENTS ---
    await writeStreamEvent({ type: "progress", current: 6, total: 9, label: "Migrating component file attachments...", percent: 70 });
    const mediaTables = ["ATTACHMENT", "COMMENT"];
    if (structureSuccess) {
      for (const childTable of mediaTables) {
        const childMappings = mappings[childTable] || [];
        if (childMappings.length > 0) {
          logs.push(`Migrating ${childTable}...`);
          report[childTable].status = "failed";

          const oracleColumns = childMappings.map(m => m.oracleCol).filter(Boolean);
          if (oracleColumns.length > 0) {
            let oracleTableName = childTable === "ATTACHMENT" ? "U_ATTACH_1" : "THECOMMENTS";
            let pgTableName = childTable.toLowerCase();
            let fkCol = "STR_ID";

            const existingCols = new Set<string>();
            try {
              const colQuery = `SELECT COLUMN_NAME FROM USER_TAB_COLUMNS WHERE TABLE_NAME = :tName`;
              const colResult = await oracleConn.execute(colQuery, { tName: oracleTableName.toUpperCase() });
              if (colResult.rows) {
                colResult.rows.forEach((r: any) => {
                  const cName = r.COLUMN_NAME || r[0];
                  if (cName) existingCols.add(String(cName).toUpperCase());
                });
              }
            } catch (colErr: any) {
              logs.push(`WARNING: Could not fetch column metadata for ${oracleTableName}: ${colErr.message}`);
            }

            const queryCols = new Set<string>();
            oracleColumns.forEach(c => {
              if (existingCols.size === 0 || existingCols.has(c.toUpperCase())) {
                queryCols.add(c);
              }
            });

            if (existingCols.size === 0 || existingCols.has(fkCol.toUpperCase())) {
              queryCols.add(fkCol);
            }

            let hasOracleCompId = false;
            let hasOracleQId = false;
            let oracleQIdColName = "Q_ID";

            if (existingCols.size === 0 || existingCols.has("COMP_ID")) {
              queryCols.add("COMP_ID");
              hasOracleCompId = true;
            }
            if (existingCols.has("Q_ID")) {
              queryCols.add("Q_ID");
              hasOracleQId = true;
              oracleQIdColName = "Q_ID";
            } else if (existingCols.has("QID")) {
              queryCols.add("QID");
              hasOracleQId = true;
              oracleQIdColName = "QID";
            }

            if (childTable === "ATTACHMENT") {
              if (existingCols.has("INSPNO")) {
                queryCols.add("INSPNO");
              }
              if (existingCols.has("INSP_ID")) {
                queryCols.add("INSP_ID");
              }
            }

            let whereClause = `${fkCol} = :strId`;

            if (childTable === "ATTACHMENT") {
              const hasCompId = existingCols.has("COMP_ID");
              const hasInspNo = existingCols.has("INSPNO");
              const hasInspId = existingCols.has("INSP_ID");

              let structCond = "";
              if (hasCompId) {
                structCond = "(COMP_ID IS NULL OR COMP_ID = 0)";
              } else {
                structCond = "1=1";
              }

              let compCond = "";
              if (hasCompId) {
                compCond = "(COMP_ID IS NOT NULL AND COMP_ID > 0";
                if (hasInspNo) {
                  compCond += " AND INSPNO IS NULL";
                }
                if (hasInspId) {
                  compCond += " AND INSP_ID IS NULL";
                }
                compCond += ")";
              } else {
                compCond = "1=0";
              }

              whereClause += ` AND (${structCond} OR ${compCond})`;
            }

            const query = `SELECT ${Array.from(queryCols).join(', ')} FROM ${oracleTableName} WHERE ${whereClause}`;

            try {
              const result = await oracleConn.execute(query, { strId: structureId });
              const rows = result.rows as any[];

              if (rows && rows.length > 0) {
                report[childTable].oracleRows = rows.length;
                const pgRecords = rows.map(oracleData => {
                  const pgRecord: Record<string, any> = {};
                  childMappings.forEach(mapping => {
                    if (mapping.oracleCol && mapping.pgCol && oracleData[mapping.oracleCol] !== undefined) {
                      let val = oracleData[mapping.oracleCol];
                      if (typeof val === 'string' && val.toLowerCase().includes('gmt')) {
                        val = formatLocalISOString(val);
                      }

                      // Custom Hook: convert raw extension to fully resolved standard MIME type!
                      if (childTable === "ATTACHMENT" && mapping.oracleCol.toUpperCase() === "A_FILETYPE") {
                        val = getMimeType(String(val || ""));
                      }

                      val = coerceValue(mapping.pgCol, val);
                      setNestedProperty(pgRecord, mapping.pgCol, val);
                    }
                  });

                  const oracleCompId = (hasOracleCompId && oracleData['COMP_ID']) ? Number(oracleData['COMP_ID']) : null;
                  const oracleQId = (hasOracleQId && oracleData[oracleQIdColName]) ? String(oracleData[oracleQIdColName]).trim() : null;

                  let resolvedPgCompId: number | null = null;
                  if (childTable === "ATTACHMENT") {
                    if (oracleCompId && oracleCompId > 0) {
                      if (compIdMap.has(oracleCompId)) {
                        resolvedPgCompId = compIdMap.get(oracleCompId)!;
                      } else {
                        // Skip component attachment if it has no match in postgres
                        return null;
                      }
                    }
                  } else {
                    if (oracleQId && qIdMap.has(oracleQId)) {
                      resolvedPgCompId = qIdMap.get(oracleQId)!;
                    } else if (oracleCompId && compIdMap.has(oracleCompId)) {
                      resolvedPgCompId = compIdMap.get(oracleCompId)!;
                    }
                  }

                  if (childTable === "ATTACHMENT") {
                    if (resolvedPgCompId) {
                      pgRecord['source_id'] = resolvedPgCompId;
                      pgRecord['source_type'] = 'component';
                    } else {
                      pgRecord['source_id'] = resolvedStructureId;
                      pgRecord['source_type'] = targetTable === 'u_pipeline' ? 'pipeline' : 'platform';
                    }
                  } else if (childTable === "COMMENT") {
                    pgRecord['structure_id'] = resolvedStructureId;
                    pgRecord['structure_type'] = targetTable || 'platform';
                    if (resolvedPgCompId) {
                      pgRecord['component_id'] = resolvedPgCompId;
                    } else {
                      pgRecord['component_id'] = null;
                    }
                  }

                  return pgRecord;
                }).filter(Boolean);

                if (childTable === "ATTACHMENT") {
                  const compDbIds = Array.from(compIdMap.values());
                  await supabase.from("attachment")
                    .delete()
                    .eq('source_id', resolvedStructureId)
                    .in('source_type', ['platform', 'PLATFORM', 'pipeline', 'PIPELINE', 'structure', 'STRUCTURE']);

                  if (compDbIds.length > 0) {
                    await supabase.from("attachment").delete().in('source_id', compDbIds).in('source_type', ['component', 'COMPONENT']);
                  }
                } else if (childTable === "COMMENT") {
                  await supabase.from("comment").delete().eq('structure_id', resolvedStructureId);
                }

                const { error: insertErr } = await supabase.from(pgTableName as any).insert(pgRecords);

                if (insertErr) {
                  logs.push(`ERROR inserting ${childTable}: ${insertErr.message}`);
                  report[childTable].errors.push(insertErr.message);
                } else {
                  logs.push(`Successfully migrated ${pgRecords.length} rows for ${childTable}!`);
                  report[childTable].status = "success";
                  report[childTable].migratedRows = pgRecords.length;
                }
              } else {
                logs.push(`No ${childTable} records found for Structure ID ${resolvedStructureId}.`);
                report[childTable].status = "success";
              }
            } catch (err: any) {
              logs.push(`ERROR querying Oracle ${childTable}: ${err.message}`);
              report[childTable].errors.push(err.message);
            }
          }
        }
      }
    }

    // =========================================================================
    // RELATIONAL INSPECTION MIGRATION PIPELINE (Phases 1 to 6)
    // =========================================================================
    if (structureSuccess && !componentsOnly) {
      await writeStreamEvent({ type: "progress", current: 7, total: 9, label: "Migrating active SOW, video tapes, and logs...", percent: 80 });
      try {
        logs.push(`================================================================`);
        logs.push(`Starting Relational Inspection Migration Pipeline (Phases 1 - 6)`);
        logs.push(`================================================================`);

        // Purge existing relational data in PostgreSQL for this structure to ensure 100% idempotent clean re-runs
        logs.push(`Cleaning up existing inspection data in Postgres for Structure ID ${resolvedStructureId}...`);

        const { data: existingInsps } = await supabase
          .from("insp_records")
          .select("insp_id")
          .eq("structure_id", resolvedStructureId);

        const inspIds = existingInsps?.map(i => i.insp_id) || [];
        if (inspIds.length > 0) {
          // Delete inspection attachments
          await supabase.from("attachment").delete().in("source_type", ["inspection", "INSPECTION"]).in("source_id", inspIds);
          // Delete anomalies
          await supabase.from("insp_anomalies").delete().in("inspection_id", inspIds);
          // Delete inspection records
          await supabase.from("insp_records").delete().eq("structure_id", resolvedStructureId);
        }

        const { data: rovJobs } = await (supabase.from as any)("insp_rov_jobs").select("rov_job_id").eq("structure_id", resolvedStructureId);
        const rovJobIds = rovJobs?.map((j: any) => j.rov_job_id) || [];

        const { data: diveJobs } = await (supabase.from as any)("insp_dive_jobs").select("dive_job_id").eq("structure_id", resolvedStructureId);
        const diveJobIds = diveJobs?.map((j: any) => j.dive_job_id) || [];

        const tapeIds: number[] = [];
        if (rovJobIds.length > 0) {
          const { data: rovTapes, error: rtErr } = await (supabase.from as any)("insp_video_tapes")
            .select("tape_id")
            .in("rov_job_id", rovJobIds);
          if (rtErr) {
            logs.push(`WARNING: failed to select existing ROV tapes: ${rtErr.message}`);
          } else if (rovTapes) {
            rovTapes.forEach((t: any) => tapeIds.push(Number(t.tape_id)));
          }
        }
        if (diveJobIds.length > 0) {
          const { data: diveTapes, error: dtErr } = await (supabase.from as any)("insp_video_tapes")
            .select("tape_id")
            .in("dive_job_id", diveJobIds);
          if (dtErr) {
            logs.push(`WARNING: failed to select existing Diving tapes: ${dtErr.message}`);
          } else if (diveTapes) {
            diveTapes.forEach((t: any) => tapeIds.push(Number(t.tape_id)));
          }
        }

        if (tapeIds.length > 0) {
          const { error: vlErr } = await (supabase.from as any)("insp_video_logs").delete().in("tape_id", tapeIds);
          if (vlErr) logs.push(`WARNING: failed to delete existing video logs: ${vlErr.message}`);
          const { error: vtErr } = await (supabase.from as any)("insp_video_tapes").delete().in("tape_id", tapeIds);
          if (vtErr) logs.push(`WARNING: failed to delete existing video tapes: ${vtErr.message}`);
        }

        if (rovJobIds.length > 0) {
          const { error: rvmErr } = await (supabase.from as any)("insp_rov_movements").delete().in("rov_job_id", rovJobIds);
          if (rvmErr) logs.push(`WARNING: failed to delete existing ROV movements: ${rvmErr.message}`);
          const { error: rvjErr } = await (supabase.from as any)("insp_rov_jobs").delete().in("rov_job_id", rovJobIds);
          if (rvjErr) logs.push(`WARNING: failed to delete existing ROV jobs: ${rvjErr.message}`);
        }

        if (diveJobIds.length > 0) {
          const { error: dvmErr } = await (supabase.from as any)("insp_dive_movements").delete().in("dive_job_id", diveJobIds);
          if (dvmErr) logs.push(`WARNING: failed to delete existing Dive movements: ${dvmErr.message}`);
          const { error: dvjErr } = await (supabase.from as any)("insp_dive_jobs").delete().in("dive_job_id", diveJobIds);
          if (dvjErr) logs.push(`WARNING: failed to delete existing Dive jobs: ${dvjErr.message}`);
        }

        logs.push(`Successfully purged existing relational data for a clean migration run.`);

        // ---------------------------------------------------------------------
        // Phase 1: Fetch & Create Jobpack (jobpack) and SOW (u_sow)
        // Query each Oracle table individually:
        //   taskstr  → STR_ID + INSPNO → JOB_TYPE (anchor table, has STR_ID)
        //   workpl   → INSPNO only     → JOBNAME, CONTRAC, ISTART, VESSEL
        //   job_vessel → INSPNO only   → V_NAME, START_DATE
        //   sow_insp → STR_ID + INSPNO → REP_PREFIX
        // ---------------------------------------------------------------------
        report["JOBPACK"].status = "failed";
        if (!report["U_SOW"]) report["U_SOW"] = { status: "failed", oracleRows: 0, migratedRows: 0, errors: [] };

        logs.push(`Phase 1: Fetching Jobpack details from Oracle (taskstr, workpl, job_vessel, sow_insp)...`);

        const jpIdMap = new Map<string, number>(); // oracleInspNo -> postgresJobpackId
        const jobpackDefaultPrefixMap = new Map<string, string>(); // oracleInspNo -> default REP_PREFIX
        const jpsowMappings = mappings["JOBPACK_SOW"] || [];
        const mgiProfileIdMap = new Map<string, number>(); // oracleInspNo -> pgProfileId

        // Step 1: Get all INSPNOs + JOB_TYPE + CR_DATE from taskstr (has STR_ID)
        const inspNos: string[] = [];
        const inspNoJobTypeMap = new Map<string, string>();
        const inspNoCrDateMap = new Map<string, any>();
        try {
          const taskstrResult = await oracleConn.execute(
            `SELECT INSPNO, JOB_TYPE, CR_DATE FROM taskstr WHERE STR_ID = :strId`,
            { strId: structureId }
          );
          if (taskstrResult.rows) {
            for (const row of taskstrResult.rows as any[]) {
              const inspno = String((row as any).INSPNO || (Array.isArray(row) ? row[0] : '') || '').trim();
              const jobType = String((row as any).JOB_TYPE || (Array.isArray(row) ? row[1] : '') || '').trim();
              const crDate = (row as any).CR_DATE || (Array.isArray(row) ? row[2] : null);
              if (inspno && !inspNos.includes(inspno)) {
                inspNos.push(inspno);
                inspNoJobTypeMap.set(inspno, jobType);
                if (crDate) {
                  inspNoCrDateMap.set(inspno, crDate);
                }
              }
            }
            logs.push(`taskstr: Found ${inspNos.length} INSPNO(s) with JOB_TYPE & CR_DATE for STR_ID ${structureId}.`);
          }
        } catch (taskstrErr: any) {
          logs.push(`WARNING: Failed to query taskstr: ${taskstrErr.message}`);
        }

        // Fallback: if taskstr returned nothing, try allinspid to get INSPNOs
        if (inspNos.length === 0) {
          logs.push(`No INSPNOs found in taskstr. Trying allinspid as fallback...`);
          try {
            const fbResult = await oracleConn.execute(
              `SELECT DISTINCT INSPNO FROM allinspid WHERE STR_ID = :strId AND INSPNO IS NOT NULL`,
              { strId: structureId }
            );
            if (fbResult.rows) {
              for (const row of fbResult.rows as any[]) {
                const inspno = String((row as any).INSPNO || (Array.isArray(row) ? row[0] : '') || '').trim();
                if (inspno && !inspNos.includes(inspno)) {
                  inspNos.push(inspno);
                }
              }
              logs.push(`allinspid fallback: Found ${inspNos.length} INSPNO(s).`);
            }
          } catch (fbErr: any) {
            logs.push(`WARNING: allinspid fallback also failed: ${fbErr.message}`);
          }
        }

        // Filter by selectedInspNo if provided
        if (selectedInspNo) {
          const matched = inspNos.filter(n => n === selectedInspNo);
          inspNos.length = 0;
          if (matched.length > 0) {
            inspNos.push(selectedInspNo);
          } else {
            inspNos.push(selectedInspNo);
          }
          logs.push(`Filtering migration to single selected Job Pack (INSPNO: ${selectedInspNo}).`);
        }

        // Build IN-clause bind variables for subsequent queries
        const buildInClause = (items: string[]) => {
          const placeholders = items.map((_, i) => `:i${i}`).join(', ');
          const binds: Record<string, string> = {};
          items.forEach((val, i) => { binds[`i${i}`] = val; });
          return { placeholders, binds };
        };

        // Step 2: Fetch jobpack details from workpl (INSPNO only — no STR_ID column)
        const workplMap = new Map<string, any>();
        if (inspNos.length > 0) {
          const { placeholders, binds } = buildInClause(inspNos);
          try {
            const wpResult = await oracleConn.execute(
              `SELECT INSPNO, JOBNAME, CONTRAC, ISTART, VESSEL, CONTRACTOR_REF, PLANTYPE, TASKTYPE, STATUS FROM workpl WHERE INSPNO IN (${placeholders})`,
              binds
            );
            if (wpResult.rows) {
              for (const row of wpResult.rows as any[]) {
                const rowObj = Array.isArray(row) ? {
                  INSPNO: row[0], JOBNAME: row[1], CONTRAC: row[2],
                  ISTART: row[3], VESSEL: row[4], CONTRACTOR_REF: row[5],
                  PLANTYPE: row[6], TASKTYPE: row[7], STATUS: row[8]
                } : row;
                const inspno = String(rowObj.INSPNO || '').trim();
                if (inspno) workplMap.set(inspno, rowObj);
              }
              logs.push(`workpl: Fetched ${workplMap.size} jobpack record(s).`);
            }
          } catch (wpErr: any) {
            logs.push(`WARNING: Failed to query workpl: ${wpErr.message}`);
            // Try without CONTRACTOR_REF (may not exist in all schemas)
            try {
              const wpResult2 = await oracleConn.execute(
                `SELECT INSPNO, JOBNAME, CONTRAC, ISTART, VESSEL, PLANTYPE, TASKTYPE, STATUS FROM workpl WHERE INSPNO IN (${placeholders})`,
                binds
              );
              if (wpResult2.rows) {
                for (const row of wpResult2.rows as any[]) {
                  const rowObj = Array.isArray(row) ? {
                    INSPNO: row[0], JOBNAME: row[1], CONTRAC: row[2],
                    ISTART: row[3], VESSEL: row[4],
                    PLANTYPE: row[5], TASKTYPE: row[6], STATUS: row[7]
                  } : row;
                  const inspno = String(rowObj.INSPNO || '').trim();
                  if (inspno) workplMap.set(inspno, rowObj);
                }
                logs.push(`workpl (fallback): Fetched ${workplMap.size} jobpack record(s).`);
              }
            } catch (wpErr2: any) {
              logs.push(`ERROR: workpl query completely failed: ${wpErr2.message}`);
              report["JOBPACK"].errors.push(`workpl: ${wpErr2.message}`);
            }
          }
        }

        // Step 3: Fetch vessel names from job_vessel (INSPNO, V_NAME, START_DATE)
        const jvMap = new Map<string, any>();
        if (inspNos.length > 0) {
          const { placeholders, binds } = buildInClause(inspNos);
          try {
            const jvResult = await oracleConn.execute(
              `SELECT INSPNO, V_NAME, START_DATE FROM job_vessel WHERE INSPNO IN (${placeholders})`,
              binds
            );
            if (jvResult.rows) {
              for (const row of jvResult.rows as any[]) {
                const rowObj = Array.isArray(row) ? {
                  INSPNO: row[0], V_NAME: row[1], START_DATE: row[2]
                } : row;
                const inspno = String(rowObj.INSPNO || '').trim();
                if (inspno) jvMap.set(inspno, rowObj);
              }
              logs.push(`job_vessel: Fetched ${jvMap.size} vessel record(s).`);
            }
          } catch (jvErr: any) {
            logs.push(`WARNING: Failed to query job_vessel: ${jvErr.message}`);
          }
        }

        // Step 4: Fetch report prefix from sow_insp (STR_ID + INSPNO → REP_PREFIX)
        const sowPrefixMap = new Map<string, string>();
        if (inspNos.length > 0) {
          const { placeholders, binds } = buildInClause(inspNos);
          try {
            // Check if sow_insp has STR_ID column
            const sowCols = await getOracleTableColumns(oracleConn, 'sow_insp');
            let sowQuery: string;
            let sowBinds: Record<string, any>;
            if (sowCols.has('STR_ID')) {
              sowQuery = `SELECT INSPNO, REP_PREFIX FROM sow_insp WHERE STR_ID = :strId AND INSPNO IN (${placeholders})`;
              sowBinds = { strId: structureId, ...binds };
            } else {
              sowQuery = `SELECT INSPNO, REP_PREFIX FROM sow_insp WHERE INSPNO IN (${placeholders})`;
              sowBinds = { ...binds };
            }
            const siResult = await oracleConn.execute(sowQuery, sowBinds);
            if (siResult.rows) {
              for (const row of siResult.rows as any[]) {
                const inspno = String((row as any).INSPNO || (Array.isArray(row) ? row[0] : '') || '').trim();
                const repPrefix = String((row as any).REP_PREFIX || (Array.isArray(row) ? row[1] : '') || '').trim();
                // Keep first REP_PREFIX per INSPNO (avoid duplicates from multiple COMP_IDs)
                if (inspno && repPrefix && !sowPrefixMap.has(inspno)) {
                  sowPrefixMap.set(inspno, repPrefix);
                }
              }
              logs.push(`sow_insp: Fetched ${sowPrefixMap.size} report prefix(es).`);
            }
          } catch (siErr: any) {
            logs.push(`WARNING: Failed to query sow_insp: ${siErr.message}`);
          }
        }

        // Step 4.5: Pre-fetch MGI profiles from Oracle (filtered by selected INSPNOs) and build signature cache from Postgres
        logs.push(`Pre-fetching MGI profiles from Oracle U_MGI_PROFILE for selected INSPNO(s)...`);
        const oracleMgiProfiles = new Map<string, string>();
        let oracleMgiCount = 0;
        try {
          if (inspNos.length > 0) {
            const { placeholders: mgiPh, binds: mgiBinds } = buildInClause(inspNos);
            const mgiProfileResult = await oracleConn.execute(
              `SELECT INSPNO, MGROW_PROFILE FROM U_MGI_PROFILE WHERE INSPNO IN (${mgiPh})`,
              mgiBinds
            );
            if (mgiProfileResult.rows) {
              oracleMgiCount = mgiProfileResult.rows.length;
              for (const r of mgiProfileResult.rows as any[]) {
                const inspno = String(r.INSPNO || r[0] || '').trim();
                const profileStr = String(r.MGROW_PROFILE || r[1] || '').trim();
                if (inspno && profileStr) {
                  oracleMgiProfiles.set(inspno, profileStr);
                }
              }
            }
          }
          logs.push(`Loaded ${oracleMgiProfiles.size} MGI profiles from Oracle (filtered by ${inspNos.length} INSPNO(s)).`);
          if (report["U_MGI_PROFILE"]) {
            report["U_MGI_PROFILE"].oracleRows = oracleMgiCount;
            report["U_MGI_PROFILE"].status = "success";
          }
        } catch (err: any) {
          logs.push(`WARNING: Fetching U_MGI_PROFILE failed: ${err.message}`);
          if (report["U_MGI_PROFILE"]) {
            report["U_MGI_PROFILE"].status = "failed";
            report["U_MGI_PROFILE"].errors.push(err.message);
          }
        }

        // Pre-load existing Postgres mgi_profiles and build signature-to-id cache
        const pgMgiProfilesMap = new Map<string, number>();
        try {
          const { data: existingProfiles } = await supabase
            .from('mgi_profiles')
            .select('*')
            .eq('is_archived', false);
          
          if (existingProfiles) {
            for (const p of existingProfiles) {
              const sig = getThresholdsSignature((p.thresholds || []) as any);
              if (sig && sig !== '[]') {
                pgMgiProfilesMap.set(sig, p.id);
              }
            }
          }
          logs.push(`Loaded ${pgMgiProfilesMap.size} existing active MGI profiles from Postgres.`);
        } catch (err: any) {
          logs.push(`WARNING: Fetching existing mgi_profiles failed: ${err.message}`);
        }

        let mgiMigratedCount = 0; // Track profiles actually inserted or updated during this migration

        // Step 5: Combine data and migrate to Postgres jobpack table
        report["JOBPACK"].oracleRows = inspNos.length;
        report["U_SOW"].oracleRows = inspNos.length;

        if (inspNos.length > 0) {
          // Fetch structure title and type from supabase first
          let strTitle = structureTitle;
          let structureType = "PLATFORM";

          try {
            const { data: existingStr } = await (supabase.from as any)("platform")
              .select("plat_id, title")
              .eq("plat_id", resolvedStructureId)
              .maybeSingle();

            if (existingStr) {
              if (existingStr.title) strTitle = existingStr.title;
              structureType = "PLATFORM";
            } else {
              const { data: existingPipe } = await (supabase.from as any)("u_pipeline")
                .select("pipe_id, title")
                .eq("pipe_id", resolvedStructureId)
                .maybeSingle();
              if (existingPipe) {
                if (existingPipe.title) strTitle = existingPipe.title;
              }
              structureType = "PIPELINE";
            }
          } catch (pgStrErr: any) {
            logs.push(`WARNING: Fetching structure details from Postgres failed: ${pgStrErr.message}`);
          }

          for (const oracleInspNo of inspNos) {
            const wp = workplMap.get(oracleInspNo) || {} as any;
            const jv = jvMap.get(oracleInspNo) || {} as any;
            const jobType = inspNoJobTypeMap.get(oracleInspNo) || '';
            const repPrefix = sowPrefixMap.get(oracleInspNo) || '';

            if (repPrefix) {
              jobpackDefaultPrefixMap.set(oracleInspNo, repPrefix);
            }

            // Build a combined lookup object for mapping-based value resolution
            const combinedRow: any = {
              INSPNO: oracleInspNo,
              JOBNAME: wp.JOBNAME,
              CONTRAC: wp.CONTRAC,
              ISTART: wp.ISTART,
              VESSEL: wp.VESSEL,
              CONTRACTOR_REF: wp.CONTRACTOR_REF,
              JOB_TYPE: jobType,
              V_NAME: jv.V_NAME,
              START_DATE: jv.START_DATE,
              REP_PREFIX: repPrefix
            };

            const getMappedVal = (targetPgCol: string) => {
              const rule = jpsowMappings.find((m: any) => m.pgCol === targetPgCol);
              if (rule && rule.oracleCol) {
                return combinedRow[rule.oracleCol];
              }
              return null;
            };

            const jobpackName = String(getMappedVal("title") || wp.JOBNAME || "").trim() || `Job Pack ${oracleInspNo}`;
            const vessel = String(getMappedVal("vessel_name") || jv.V_NAME || wp.VESSEL || "").trim();
            const dateStart = getMappedVal("start_date") || getMappedVal("vessel_date_of_start") || jv.START_DATE || wp.ISTART || null;
            const formattedDateStart = formatLocalDateOnly(dateStart);
            const contrac = String(getMappedVal("contractor") || wp.CONTRAC || "").trim();
            const jobTypeVal = String(getMappedVal("job_type") || jobType || "").trim();
            const repPrefixVal = String(getMappedVal("sow_report_no") || repPrefix || "").trim();

            let jobpackStartYear = "UNKNOWN";
            if (formattedDateStart) {
              jobpackStartYear = formattedDateStart.split('-')[0];
            }
            if (jobpackStartYear === "UNKNOWN") {
              const taskstrCrDate = inspNoCrDateMap.get(oracleInspNo);
              if (taskstrCrDate) {
                if (taskstrCrDate instanceof Date) {
                  jobpackStartYear = String(taskstrCrDate.getFullYear());
                } else {
                  const parsed = Date.parse(String(taskstrCrDate));
                  if (!isNaN(parsed)) {
                    jobpackStartYear = String(new Date(parsed).getFullYear());
                  }
                }
              }
            }
            if (jobpackStartYear === "UNKNOWN") {
              jobpackStartYear = String(new Date().getFullYear());
            }

            // Resolve and set MGI profile for this jobpack (upsert: update if exists, insert if new)
            let pgMgiProfileId: number | null = null;
            const mgiProfileStr = oracleMgiProfiles.get(oracleInspNo);
            if (mgiProfileStr) {
              const thresholds = parseOracleMgiProfile(mgiProfileStr);
              if (thresholds.length > 0) {
                const sig = getThresholdsSignature(thresholds);
                const profileName = `${jobpackStartYear} MGI profile`;
                const profileDesc = `Migrated from Oracle jobpack ${oracleInspNo} (Profile: ${mgiProfileStr})`;

                if (pgMgiProfilesMap.has(sig)) {
                  // Profile with same thresholds already exists — update its name/description
                  pgMgiProfileId = pgMgiProfilesMap.get(sig)!;
                  try {
                    await supabase
                      .from('mgi_profiles')
                      .update({
                        name: profileName,
                        description: profileDesc,
                        updated_by: 'migration'
                      })
                      .eq('id', pgMgiProfileId);
                    logs.push(`Updated existing MGI Profile ID ${pgMgiProfileId} (thresholds match) for JP ${oracleInspNo}.`);
                  } catch (updErr: any) {
                    logs.push(`WARNING: Failed to update MGI Profile ID ${pgMgiProfileId}: ${updErr.message}`);
                  }
                  mgiMigratedCount++;
                } else {
                  // No matching profile — insert new
                  logs.push(`Creating new MGI profile in Postgres for thresholds: ${mgiProfileStr}`);
                  try {
                    const { data: newProfile, error: insertProfileErr } = await supabase
                      .from('mgi_profiles')
                      .insert({
                        name: profileName,
                        description: profileDesc,
                        thresholds,
                        is_active: true,
                        is_job_specific: false,
                        is_archived: false,
                        created_by: 'migration',
                        updated_by: 'migration'
                      })
                      .select('id')
                      .single();
                    
                    if (insertProfileErr) {
                      logs.push(`ERROR creating MGI Profile for JP ${oracleInspNo}: ${insertProfileErr.message}`);
                    } else if (newProfile) {
                      pgMgiProfileId = Number(newProfile.id);
                      pgMgiProfilesMap.set(sig, pgMgiProfileId);
                      mgiMigratedCount++;
                      logs.push(`Successfully created MGI Profile ID ${pgMgiProfileId} in Postgres.`);
                    }
                  } catch (err: any) {
                    logs.push(`ERROR creating MGI Profile for JP ${oracleInspNo}: ${err.message}`);
                  }
                }
              }
            }
            if (pgMgiProfileId) {
              mgiProfileIdMap.set(oracleInspNo, pgMgiProfileId);
            }

            const jobpackHasNoReportNo = !repPrefixVal || repPrefixVal.toUpperCase() === "UNKNOWN" || repPrefixVal.toUpperCase() === "UNKNOW";
            const jobpackResolvedRepPrefix = jobpackHasNoReportNo ? jobpackStartYear : repPrefixVal;
            jobpackDefaultPrefixMap.set(oracleInspNo, jobpackResolvedRepPrefix);

            // Upsert Postgres jobpack by either oracleInspNo or case-insensitive jobpack name
            let existingJp = null;
            try {
              const { data: jpByInspNo } = await (supabase.from as any)("jobpack")
                .select("id, metadata, name, status")
                .eq("metadata->>oracleInspNo", oracleInspNo)
                .maybeSingle();
              if (jpByInspNo) {
                existingJp = jpByInspNo;
              } else {
                const { data: jpByName } = await (supabase.from as any)("jobpack")
                  .select("id, metadata, name, status")
                  .ilike("name", jobpackName)
                  .maybeSingle();
                if (jpByName) {
                  existingJp = jpByName;
                }
              }
            } catch (checkErr: any) {
              logs.push(`WARNING: Checking existing jobpack failed: ${checkErr.message}`);
            }

            let existingMetadata: Record<string, any> = {};
            if (existingJp && existingJp.metadata) {
              existingMetadata = typeof existingJp.metadata === 'string'
                ? JSON.parse(existingJp.metadata)
                : existingJp.metadata;
            }

            // Get/update structure list in metadata.structures
            let existingStructures: any[] = [];
            if (Array.isArray(existingMetadata.structures)) {
              existingStructures = [...existingMetadata.structures];
            } else if (existingMetadata.structures) {
              existingStructures = [existingMetadata.structures];
            }

            const updatedStructureObj = {
              id: resolvedStructureId,
              title: strTitle || `Structure ${resolvedStructureId}`,
              type: structureType
            };

            const strIdx = existingStructures.findIndex((s: any) => s && Number(s.id) === resolvedStructureId);
            if (strIdx > -1) {
              existingStructures[strIdx] = updatedStructureObj;
              logs.push(`Structure ID ${resolvedStructureId} already exists in jobpack structures. Updating its details in-place.`);
            } else {
              existingStructures.push(updatedStructureObj);
              logs.push(`Structure ID ${resolvedStructureId} not present in jobpack structures. Appending it.`);
            }

            // Fetch active inspection types from Oracle for this structure and INSPNO (ROV + Diving modes)
            logs.push(`Fetching active ROV and Diving inspection types from Oracle for INSPNO: ${oracleInspNo}, STR_ID: ${structureId}...`);
            let rovInspections: { code: string; name: string }[] = [];
            let divingInspections: { code: string; name: string }[] = [];

            if (structureType === "PLATFORM") {
              // 1. ROV platform inspections from PLATGI table
              try {
                const result = await oracleConn.execute(
                  `SELECT DISTINCT TRIM(p.INSP_SCODE) AS CODE, TRIM(s.FULLNAME) AS FULL_NAME 
                   FROM PLATGI p 
                   LEFT JOIN insptype_sub s ON TRIM(p.INSP_SCODE) = TRIM(s.SCODE) 
                   WHERE p.STR_ID = :strId AND p.INSPNO = :inspNo AND p.COMP_ID > 0 AND p.INSP_SCODE IS NOT NULL`,
                  { strId: structureId, inspNo: oracleInspNo }
                );
                if (result.rows && result.rows.length > 0) {
                  rovInspections = result.rows.map((row: any) => ({
                    code: String(row.CODE || row.code || row[0] || "").trim(),
                    name: String(row.FULL_NAME || row.full_name || row[1] || row.CODE || row.code || row[0] || "ROV Platform Inspection").trim()
                  }));
                }
              } catch (err: any) {
                try {
                  const result = await oracleConn.execute(
                    `SELECT DISTINCT TRIM(p.INSP_SCODE) AS CODE, TRIM(s.NAME) AS FULL_NAME 
                     FROM PLATGI p 
                     LEFT JOIN insptype_sub s ON TRIM(p.INSP_SCODE) = TRIM(s.SCODE) 
                     WHERE p.STR_ID = :strId AND p.INSPNO = :inspNo AND p.COMP_ID > 0 AND p.INSP_SCODE IS NOT NULL`,
                    { strId: structureId, inspNo: oracleInspNo }
                  );
                  if (result.rows && result.rows.length > 0) {
                    rovInspections = result.rows.map((row: any) => ({
                      code: String(row.CODE || row.code || row[0] || "").trim(),
                      name: String(row.FULL_NAME || row.full_name || row[1] || row.CODE || row.code || row[0] || "ROV Platform Inspection").trim()
                    }));
                  }
                } catch (err2) {
                  try {
                    const result = await oracleConn.execute(
                      `SELECT DISTINCT TRIM(INSP_SCODE) AS CODE 
                       FROM PLATGI 
                       WHERE STR_ID = :strId AND INSPNO = :inspNo AND COMP_ID > 0 AND INSP_SCODE IS NOT NULL`,
                      { strId: structureId, inspNo: oracleInspNo }
                    );
                    if (result.rows && result.rows.length > 0) {
                      rovInspections = result.rows.map((row: any) => {
                        const code = String(row.CODE || row.code || row[0] || "").trim();
                        return { code, name: `ROV Platform Sub-Type ${code}` };
                      });
                    }
                  } catch (err3: any) {
                    logs.push(`WARNING: Failed to query Oracle PLATGI active inspection types: ${err3.message}`);
                  }
                }
              }

              // 2. Diving platform inspections from allinspid table
              try {
                const result = await oracleConn.execute(
                  `SELECT DISTINCT TRIM(a.INSP_TYPE) AS CODE, TRIM(t.NAME) AS FULL_NAME 
                   FROM allinspid a 
                   LEFT JOIN insptype t ON TRIM(a.INSP_TYPE) = TRIM(t.CODE) 
                   WHERE a.STR_ID = :strId AND a.INSPNO = :inspNo AND TRIM(UPPER(a.INSP_TYPE)) NOT IN ('PLATGI', 'NAVIG', 'LOGS', 'EXSUM', 'VIDEO') AND a.INSP_TYPE IS NOT NULL`,
                  { strId: structureId, inspNo: oracleInspNo }
                );
                if (result.rows && result.rows.length > 0) {
                  divingInspections = result.rows.map((row: any) => ({
                    code: String(row.CODE || row.code || row[0] || "").trim(),
                    name: String(row.FULL_NAME || row.full_name || row[1] || row.CODE || row.code || row[0] || "Diving Platform Inspection").trim()
                  }));
                }
              } catch (err: any) {
                try {
                  const result = await oracleConn.execute(
                    `SELECT DISTINCT TRIM(a.INSP_TYPE) AS CODE, TRIM(t.DESCRIP) AS FULL_NAME 
                     FROM allinspid a 
                     LEFT JOIN insptype t ON TRIM(a.INSP_TYPE) = TRIM(t.CODE) 
                     WHERE a.STR_ID = :strId AND a.INSPNO = :inspNo AND TRIM(UPPER(a.INSP_TYPE)) NOT IN ('PLATGI', 'NAVIG', 'LOGS', 'EXSUM', 'VIDEO') AND a.INSP_TYPE IS NOT NULL`,
                    { strId: structureId, inspNo: oracleInspNo }
                  );
                  if (result.rows && result.rows.length > 0) {
                    divingInspections = result.rows.map((row: any) => ({
                      code: String(row.CODE || row.code || row[0] || "").trim(),
                      name: String(row.FULL_NAME || row.full_name || row[1] || row.CODE || row.code || row[0] || "Diving Platform Inspection").trim()
                    }));
                  }
                } catch (err2) {
                  try {
                    const result = await oracleConn.execute(
                      `SELECT DISTINCT TRIM(INSP_TYPE) AS CODE 
                       FROM allinspid 
                       WHERE STR_ID = :strId AND INSPNO = :inspNo AND TRIM(UPPER(INSP_TYPE)) NOT IN ('PLATGI', 'NAVIG', 'LOGS', 'EXSUM', 'VIDEO') AND INSP_TYPE IS NOT NULL`,
                      { strId: structureId, inspNo: oracleInspNo }
                    );
                    if (result.rows && result.rows.length > 0) {
                      divingInspections = result.rows.map((row: any) => {
                        const code = String(row.CODE || row.code || row[0] || "").trim();
                        return { code, name: `Diving Platform Type ${code}` };
                      });
                    }
                  } catch (err3: any) {
                    logs.push(`WARNING: Failed to query Oracle allinspid active diving inspections: ${err3.message}`);
                  }
                }
              }
            } else {
              // Pipeline: NAVIG is ROV, other codes except ('PLATGI', 'NAVIG', 'LOGS', 'EXSUM') are Diving
              let pipelineInspections: { code: string; name: string }[] = [];
              try {
                const result = await oracleConn.execute(
                  `SELECT DISTINCT TRIM(a.INSP_TYPE) AS CODE, TRIM(t.NAME) AS FULL_NAME 
                   FROM allinspid a 
                   LEFT JOIN insptype t ON TRIM(a.INSP_TYPE) = TRIM(t.CODE) 
                   WHERE a.STR_ID = :strId AND a.INSPNO = :inspNo AND a.INSP_TYPE IS NOT NULL`,
                  { strId: structureId, inspNo: oracleInspNo }
                );
                if (result.rows && result.rows.length > 0) {
                  pipelineInspections = result.rows.map((row: any) => ({
                    code: String(row.CODE || row.code || row[0] || "").trim(),
                    name: String(row.FULL_NAME || row.full_name || row[1] || row.CODE || row.code || row[0] || "Pipeline Inspection").trim()
                  }));
                }
              } catch (err) {
                try {
                  const result = await oracleConn.execute(
                    `SELECT DISTINCT TRIM(a.INSP_TYPE) AS CODE, TRIM(t.DESCRIP) AS FULL_NAME 
                     FROM allinspid a 
                     LEFT JOIN insptype t ON TRIM(a.INSP_TYPE) = TRIM(t.CODE) 
                     WHERE a.STR_ID = :strId AND a.INSPNO = :inspNo AND a.INSP_TYPE IS NOT NULL`,
                    { strId: structureId, inspNo: oracleInspNo }
                  );
                  if (result.rows && result.rows.length > 0) {
                    pipelineInspections = result.rows.map((row: any) => ({
                      code: String(row.CODE || row.code || row[0] || "").trim(),
                      name: String(row.FULL_NAME || row.full_name || row[1] || row.CODE || row.code || row[0] || "Pipeline Inspection").trim()
                    }));
                  }
                } catch (err2) {
                  try {
                    const result = await oracleConn.execute(
                      `SELECT DISTINCT TRIM(INSP_TYPE) AS CODE 
                       FROM allinspid 
                       WHERE a.STR_ID = :strId AND a.INSPNO = :inspNo AND INSP_TYPE IS NOT NULL`,
                      { strId: structureId, inspNo: oracleInspNo }
                    );
                    if (result.rows && result.rows.length > 0) {
                      pipelineInspections = result.rows.map((row: any) => {
                        const code = String(row.CODE || row.code || row[0] || "").trim();
                        return { code, name: `Pipeline Type ${code}` };
                      });
                    }
                  } catch (err3: any) {
                    logs.push(`WARNING: Failed to query Oracle pipeline inspections: ${err3.message}`);
                  }
                }
              }

              // Distribute to ROV/Diving modes
              for (const item of pipelineInspections) {
                const codeUpper = item.code.toUpperCase();
                if (codeUpper === 'NAVIG') {
                  rovInspections.push(item);
                } else if (!['PLATGI', 'NAVIG', 'LOGS', 'EXSUM', 'VIDEO'].includes(codeUpper)) {
                  divingInspections.push(item);
                }
              }
            }

            logs.push(`Found active inspection types in Oracle: ROV = [${rovInspections.map(i => i.code).join(',')}], Diving = [${divingInspections.map(i => i.code).join(',')}]`);

            // Deduplicate active inspection types and register/update in PostgreSQL library
            const activeInspMap = new Map<string, { code: string; name: string; isRov: boolean; isDiving: boolean }>();
            rovInspections.forEach(item => {
              const key = item.code.toUpperCase();
              activeInspMap.set(key, { code: item.code, name: item.name, isRov: true, isDiving: false });
            });
            divingInspections.forEach(item => {
              const key = item.code.toUpperCase();
              if (activeInspMap.has(key)) {
                activeInspMap.get(key)!.isDiving = true;
              } else {
                activeInspMap.set(key, { code: item.code, name: item.name, isRov: false, isDiving: true });
              }
            });

            const dbInspsToSave: any[] = [];
            for (const [codeKey, details] of Array.from(activeInspMap.entries())) {
              try {
                // Check in Postgres inspection_type
                const { data: existingType, error: typeErr } = await (supabase.from as any)("inspection_type")
                  .select("*")
                  .ilike("code", details.code)
                  .maybeSingle();

                let resolvedTypeObj = existingType;
                if (typeErr) {
                  logs.push(`WARNING: Fetching inspection type ${details.code} failed: ${typeErr.message}`);
                }

                if (existingType) {
                  // Merge and update existing metadata
                  let existingMeta = existingType.metadata || {};
                  if (typeof existingMeta === 'string') {
                    try { existingMeta = JSON.parse(existingMeta); } catch { existingMeta = {}; }
                  }
                  const updatedMeta = {
                    ...existingMeta,
                    rov: details.isRov ? 1 : (existingMeta.rov || 0),
                    diving: details.isDiving ? 1 : (existingMeta.diving || 0),
                    platform: structureType === "PLATFORM" ? 1 : (existingMeta.platform || 0),
                    pipeline: structureType === "PIPELINE" ? 1 : (existingMeta.pipeline || 0)
                  };

                  const { data: updatedType, error: updateErr } = await (supabase.from as any)("inspection_type")
                    .update({
                      name: existingType.name || details.name,
                      metadata: updatedMeta
                    })
                    .eq("id", existingType.id)
                    .select()
                    .single();

                  if (updateErr) {
                    logs.push(`WARNING: Updating inspection type ${details.code} metadata failed: ${updateErr.message}`);
                  } else {
                    resolvedTypeObj = updatedType;
                  }
                } else {
                  // Insert new type
                  const newMeta = {
                    rov: details.isRov ? 1 : 0,
                    diving: details.isDiving ? 1 : 0,
                    platform: structureType === "PLATFORM" ? 1 : 0,
                    pipeline: structureType === "PIPELINE" ? 1 : 0
                  };

                  const { data: newType, error: insertErr } = await (supabase.from as any)("inspection_type")
                    .insert({
                      code: details.code,
                      name: details.name,
                      metadata: newMeta
                    })
                    .select()
                    .single();

                  if (insertErr) {
                    logs.push(`WARNING: Creating inspection type ${details.code} library record failed: ${insertErr.message}`);
                  } else {
                    resolvedTypeObj = newType;
                    logs.push(`Registered new library inspection type in Postgres: ${details.code} - ${details.name}`);
                  }
                }

                if (resolvedTypeObj) {
                  dbInspsToSave.push(resolvedTypeObj);
                }
              } catch (saveErr: any) {
                logs.push(`WARNING: Failed to process library mapping for ${details.code}: ${saveErr.message}`);
              }
            }

            // Sync inspections map in metadata
            let existingInspections: Record<string, any[]> = {};
            if (existingMetadata.inspections) {
              if (Array.isArray(existingMetadata.inspections)) {
                // If it was a simple array, map it to all existing structures
                existingStructures.forEach((s: any) => {
                  existingInspections[`${s.type}-${s.id}`] = existingMetadata.inspections;
                });
              } else if (typeof existingMetadata.inspections === 'object') {
                existingInspections = { ...existingMetadata.inspections };
              }
            }

            // Put active inspection types under current structure key
            existingInspections[`${structureType}-${resolvedStructureId}`] = dbInspsToSave;

            const jpPayload = {
              name: jobpackName,
              status: wp.STATUS || 'OPEN',
              mgi_profile_id: pgMgiProfileId,
              metadata: {
                ...existingMetadata,
                oracleInspNo,
                vessel: vessel || existingMetadata.vessel,
                contrac: contrac || existingMetadata.contrac,
                date_start: formattedDateStart || existingMetadata.date_start,
                rep_prefix: repPrefixVal || existingMetadata.rep_prefix,
                job_type: jobTypeVal || existingMetadata.job_type,
                plantype: wp.PLANTYPE || existingMetadata.plantype || '',
                tasktype: wp.TASKTYPE || existingMetadata.tasktype || '',
                istart: formattedDateStart || existingMetadata.istart,
                structures: existingStructures,
                inspections: existingInspections
              }
            };

            let pgJpId: number;
            if (existingJp) {
              pgJpId = Number(existingJp.id);
              logs.push(`Case-insensitive match found for Job Pack name "${jobpackName}" (ID ${pgJpId}). Updating details and merging structure list in Postgres.`);
              const { error: updateJpErr } = await (supabase.from as any)("jobpack")
                .update(jpPayload)
                .eq("id", pgJpId);

              if (updateJpErr) {
                logs.push(`ERROR updating Jobpack for INSPNO ${oracleInspNo}: ${updateJpErr.message}`);
                report["JOBPACK"].errors.push(updateJpErr.message);
                continue;
              }
            } else {
              logs.push(`No existing Job Pack matches name "${jobpackName}". Creating new Job Pack in Postgres.`);
              const { data: newJp, error: insertJpErr } = await (supabase.from as any)("jobpack")
                .insert(jpPayload)
                .select("id")
                .single();

              if (insertJpErr) {
                logs.push(`ERROR creating Jobpack for INSPNO ${oracleInspNo}: ${insertJpErr.message}`);
                report["JOBPACK"].errors.push(insertJpErr.message);
                continue;
              }
              pgJpId = Number(newJp.id);
            }

            report["JOBPACK"].migratedRows++;
            jpIdMap.set(oracleInspNo, pgJpId);

            // Upsert Postgres u_sow

            let startYear = "UNKNOWN";
            if (formattedDateStart) {
              startYear = formattedDateStart.split('-')[0];
            }
            if (startYear === "UNKNOWN") {
              const taskstrCrDate = inspNoCrDateMap.get(oracleInspNo);
              if (taskstrCrDate) {
                if (taskstrCrDate instanceof Date) {
                  startYear = String(taskstrCrDate.getFullYear());
                } else {
                  const parsed = Date.parse(String(taskstrCrDate));
                  if (!isNaN(parsed)) {
                    startYear = String(new Date(parsed).getFullYear());
                  }
                }
              }
            }
            if (startYear === "UNKNOWN") {
              startYear = String(new Date().getFullYear());
            }

            const { data: existingSow } = await (supabase.from as any)("u_sow")
              .select("id")
              .eq("jobpack_id", pgJpId)
              .eq("structure_id", resolvedStructureId)
              .maybeSingle();

            const hasNoReportNo = !repPrefixVal || repPrefixVal.toUpperCase() === "UNKNOWN" || repPrefixVal.toUpperCase() === "UNKNOW";
            const resolvedRepPrefix = hasNoReportNo ? startYear : repPrefixVal;

            const reportNumbers = [{
              number: resolvedRepPrefix,
              job_type: jobTypeVal || "UNKNOWN"
            }];

            let parsedCrDate: string | undefined = undefined;
            const taskstrCrDate = inspNoCrDateMap.get(oracleInspNo);
            if (taskstrCrDate) {
              parsedCrDate = formatLocalISOString(taskstrCrDate) || undefined;
            }

            const sowPayload = {
              jobpack_id: pgJpId,
              structure_id: resolvedStructureId,
              structure_type: structureType,
              structure_title: strTitle,
              report_numbers: reportNumbers,
              metadata: { migrated_from_oracle: true }
            };

            if (existingSow) {
              await (supabase.from as any)("u_sow")
                .update({
                  ...sowPayload,
                  updated_by: 'migrate user',
                  updated_at: new Date().toISOString()
                })
                .eq("id", existingSow.id);
            } else {
              const { error: insertSowErr } = await (supabase.from as any)("u_sow")
                .insert({
                  ...sowPayload,
                  created_by: 'migrate user',
                  created_at: parsedCrDate || new Date().toISOString(),
                  updated_by: 'migrate user',
                  updated_at: new Date().toISOString()
                });
              if (insertSowErr) {
                logs.push(`ERROR creating u_sow for Jobpack ${pgJpId}: ${insertSowErr.message}`);
                report["U_SOW"].errors.push(insertSowErr.message);
              }
            }
            report["U_SOW"].migratedRows++;

            // ─── MIGRATE EXSUM DATA TO u_executive_summaries FOR THIS JOBPACK ───
            try {
              logs.push(`[EXSUM Migration] Checking Oracle EXSUM data for STR_ID: ${structureId}, INSPNO: ${oracleInspNo}...`);
              const exsumQuery = `
                SELECT STR_ID, INSPNO, INSP_REAS, FINDINGS
                FROM EXSUM
                WHERE STR_ID = :strId AND INSPNO = :inspNo
              `;
              const exsumRes = await oracleConn.execute(exsumQuery, { strId: structureId, inspNo: oracleInspNo });
              
              if (exsumRes.rows && exsumRes.rows.length > 0) {
                logs.push(`[EXSUM Migration] Found ${exsumRes.rows.length} EXSUM row(s) in Oracle for STR_ID: ${structureId}, INSPNO: ${oracleInspNo}.`);
                
                const exsumRows = exsumRes.rows.map((row: any) => {
                  if (Array.isArray(row)) {
                    return {
                      STR_ID: row[0],
                      INSPNO: row[1],
                      INSP_REAS: row[2],
                      FINDINGS: row[3]
                    };
                  }
                  return row;
                });

                // Map sections based on EXECUTIVE_SUMMARY_TOC
                const exsumSections = EXECUTIVE_SUMMARY_TOC.map(toc => {
                  const row = exsumRows.find((r: any) => {
                    const inspReas = String(r.INSP_REAS || "").trim().toLowerCase();
                    const tocTitle = toc.title.trim().toLowerCase();
                    return inspReas === tocTitle || 
                           inspReas.includes(toc.id.toLowerCase()) ||
                           tocTitle.includes(inspReas) ||
                           (toc.id === "mgi" && inspReas.includes("marine growth")) ||
                           (toc.id === "riser" && inspReas.includes("riser")) ||
                           (toc.id === "scour" && inspReas.includes("scour")) ||
                           (toc.id === "seabed" && inspReas.includes("seabed"));
                  });

                  return {
                    id: toc.id,
                    title: toc.title,
                    content: row ? String(row.FINDINGS || "").trim() : ""
                  };
                });

                const { error: exsumErr } = await (supabase as any)
                  .from("u_executive_summaries")
                  .upsert({
                    company_id: resolvedCompanyId || null,
                    jobpack_id: Number(pgJpId),
                    structure_id: Number(resolvedStructureId),
                    sow_report_no: resolvedRepPrefix,
                    sections: exsumSections,
                    metadata: { migrated: true, migrated_at: new Date().toISOString() },
                    updated_at: new Date().toISOString()
                  }, {
                    onConflict: 'jobpack_id,structure_id,sow_report_no'
                  });

                if (exsumErr) {
                  logs.push(`[EXSUM Migration] WARNING: Failed to upsert executive summary: ${exsumErr.message}`);
                  report["EXSUM"].errors.push(exsumErr.message);
                  report["EXSUM"].status = "failed";
                } else {
                  logs.push(`[EXSUM Migration] Successfully migrated Executive Summary with ${exsumRows.length} section(s) to PostgreSQL!`);
                  report["EXSUM"].status = "success";
                  report["EXSUM"].oracleRows += exsumRows.length;
                  report["EXSUM"].migratedRows += exsumRows.length;
                }
              } else {
                logs.push(`[EXSUM Migration] No Oracle EXSUM rows found for STR_ID: ${structureId}, INSPNO: ${oracleInspNo}.`);
                report["EXSUM"].status = "success";
              }
            } catch (exsumMigErr: any) {
              logs.push(`[EXSUM Migration] WARNING: EXSUM migration failed: ${exsumMigErr.message}`);
              console.error("[EXSUM Migration Fail]:", exsumMigErr);
            }
          }

          report["JOBPACK"].status = "success";
          report["U_SOW"].status = report["U_SOW"].errors.length > 0 ? "failed" : "success";
          report["JOBPACK"].migratedRows = jpIdMap.size;
        } else {
          logs.push(`No Jobpacks found (no INSPNOs in taskstr/allinspid for this structure).`);
          report["JOBPACK"].status = "success";
        }

        // Cache SOW report number scope from Oracle sow_insp table
        // Keys cached: exactKey (inspNo_compId_code), compKey (inspNo_compId), codeKey (inspNo__code)
        const sowInspCache = new Map<string, string>();
        try {
          const sowCols = await getOracleTableColumns(oracleConn, 'sow_insp');
          if (sowCols.size > 0) {
            const queryCols = ['INSPNO', 'REP_PREFIX'];
            const hasCompId = sowCols.has('COMP_ID') || sowCols.has('COMPONENT_ID');
            if (sowCols.has('COMP_ID')) queryCols.push('COMP_ID');
            else if (sowCols.has('COMPONENT_ID')) queryCols.push('COMPONENT_ID as COMP_ID');

            const hasRepNo = sowCols.has('REP_NO') || sowCols.has('REPORT_NO');
            if (sowCols.has('REP_NO')) queryCols.push('REP_NO');
            else if (sowCols.has('REPORT_NO')) queryCols.push('REPORT_NO as REP_NO');

            const hasCode = sowCols.has('CODE') || sowCols.has('INSP_TYPE');
            if (sowCols.has('CODE')) queryCols.push('CODE');
            else if (sowCols.has('INSP_TYPE')) queryCols.push('INSP_TYPE as CODE');

            // Scope the SOW query to this structure (via STR_ID or the INSPNO values from workpl)
            let sowWhereClause = '';
            if (sowCols.has('STR_ID')) {
              sowWhereClause = `WHERE STR_ID = :strId`;
            } else if (jpIdMap.size > 0) {
              const inspNoList = Array.from(jpIdMap.keys()).map(n => `'${n}'`).join(',');
              sowWhereClause = `WHERE INSPNO IN (${inspNoList})`;
            }

            const sowResult = await oracleConn.execute(
              `SELECT ${queryCols.join(', ')} FROM sow_insp ${sowWhereClause}`,
              sowCols.has('STR_ID') ? { strId: structureId } : {}
            );

            if (sowResult.rows) {
              sowResult.rows.forEach((row: any) => {
                let rowObj: any = {};
                if (Array.isArray(row)) {
                  rowObj.INSPNO = row[0];
                  rowObj.REP_PREFIX = row[1];
                  let nextIdx = 2;
                  if (hasCompId) { rowObj.COMP_ID = row[nextIdx]; nextIdx++; }
                  if (hasRepNo) { rowObj.REP_NO = row[nextIdx]; nextIdx++; }
                  if (hasCode) { rowObj.CODE = row[nextIdx]; nextIdx++; }
                } else {
                  rowObj = row;
                }

                const inspNo = String(rowObj.INSPNO || "").trim();
                const compId = rowObj.COMP_ID ? Number(rowObj.COMP_ID) : null;
                // Use actual report number (REP_NO) if available, else fall back to REP_PREFIX
                const repNo = String(rowObj.REP_NO || rowObj.REP_PREFIX || "").trim();
                const code = String(rowObj.CODE || "").trim().toUpperCase();

                if (inspNo && repNo) {
                  // Exact key: inspNo + compId + code
                  if (compId && code) {
                    sowInspCache.set(`${inspNo}_${compId}_${code}`, repNo);
                  }
                  // Component key: inspNo + compId (any code)
                  if (compId) {
                    const compKey = `comp_${inspNo}_${compId}`;
                    if (!sowInspCache.has(compKey)) {
                      sowInspCache.set(compKey, repNo);
                    }
                  }
                  // Code key: inspNo + code (any component)
                  if (code) {
                    const codeKey = `code_${inspNo}_${code}`;
                    if (!sowInspCache.has(codeKey)) {
                      sowInspCache.set(codeKey, repNo);
                    }
                  }
                }
              });
              logs.push(`Loaded ${sowInspCache.size} scope of work mappings from Oracle 'sow_insp' into SOW Report Cache.`);
            }
          }
        } catch (sowErr: any) {
          logs.push(`WARNING: SOW scope load skipped: ${sowErr.message}`);
        }

        // Helper to dynamically resolve SOW Report No for each inspection record
        // Priority: exact match (inspNo+compId+code) > comp match > code match > jobpack REP_PREFIX
        const getSowReportNo = (inspNo: string, oracleCompId: number, code: string): string => {
          // 1. Exact key: inspNo + compId + code
          const exactKey = `${inspNo}_${oracleCompId}_${code}`;
          if (sowInspCache.has(exactKey)) return sowInspCache.get(exactKey)!;

          // 2. Component key: inspNo + compId (any code)
          const compKey = `comp_${inspNo}_${oracleCompId}`;
          if (sowInspCache.has(compKey)) return sowInspCache.get(compKey)!;

          // 3. Code key: inspNo + code (any component)
          const codeKey = `code_${inspNo}_${code}`;
          if (sowInspCache.has(codeKey)) return sowInspCache.get(codeKey)!;

          // 4. Fallback to jobpack default REP_PREFIX from workpl table
          return jobpackDefaultPrefixMap.get(inspNo) || "";
        };

        // Sync U_MGI_PROFILE report with actual migrated counts
        if (report["U_MGI_PROFILE"]) {
          report["U_MGI_PROFILE"].migratedRows = mgiMigratedCount;
          if (mgiMigratedCount > 0) {
            report["U_MGI_PROFILE"].status = "success";
          }
        }

        // ---------------------------------------------------------------------
        // Phase 2: Migrate Jobs & Movements from Oracle LOGS
        // ---------------------------------------------------------------------
        report["LOGS_JOBS"].status = "failed";
        report["LOGS_MOVEMENTS"].status = "failed";
        logs.push(`Phase 2: Migrating Jobs & Movements from Oracle LOGS...`);

        const rovJobsCache = new Map<string, number>();
        const diveJobsCache = new Map<string, number>();

        const rovLogMappings = mappings["LOGS_ROV"] || [];
        const diveLogMappings = mappings["LOGS_DIVE"] || [];

        const getMappedValue = (rowMappings: any[], rowObj: any, standardObj: any, pgColTarget: string, defaultOracleCol: string) => {
          const rule = rowMappings.find((m: any) => m.pgCol === pgColTarget);
          if (rule && rule.oracleCol) {
            // First try to look up in raw rowObj
            let val = rowObj[rule.oracleCol] ?? rowObj[rule.oracleCol.toUpperCase()] ?? rowObj[rule.oracleCol.toLowerCase()];
            if (val !== undefined && val !== null) return val;

            // Second try to look up in standardObj in case they mapped a standard name
            val = standardObj[rule.oracleCol] ?? standardObj[rule.oracleCol.toUpperCase()] ?? standardObj[rule.oracleCol.toLowerCase()];
            if (val !== undefined && val !== null) return val;
          }
          // Fallback to standardObj default key
          return standardObj[defaultOracleCol];
        };

        try {
          const logsCols = await getOracleTableColumns(oracleConn, 'LOGS');
          if (logsCols.size > 0 && logsCols.has('STR_ID')) {
            const dateCol = logsCols.has('INSP_DATE') ? 'INSP_DATE' : (logsCols.has('LOG_DATE') ? 'LOG_DATE' : null);
            const timeCol = logsCols.has('INSP_TIME') ? 'INSP_TIME' : (logsCols.has('LOG_TIME') ? 'LOG_TIME' : null);
            const typeCol = logsCols.has('LOG_TYPE') ? 'LOG_TYPE' : null;
            const detailCol = logsCols.has('LOG_DETAIL') ? 'LOG_DETAIL' : null;
            const diveNoCol = logsCols.has('DIVE_NO') ? 'DIVE_NO' : null;
            const tapeNoCol = logsCols.has('TAPE_NO') ? 'TAPE_NO' : null;

            const diverCol = logsCols.has('DIVR') ? 'DIVR' : (logsCols.has('DIVER') ? 'DIVER' : null);
            const superCol = logsCols.has('SUPV') ? 'SUPV' : (logsCols.has('SUPERVISOR') ? 'SUPERVISOR' : null);
            const coordCol = logsCols.has('REC_CORD') ? 'REC_CORD' : (logsCols.has('REP_CO') ? 'REP_CO' : null);

            const selectCols: string[] = ['STR_ID', 'INSPNO'];
            if (typeCol) selectCols.push(typeCol);
            if (dateCol) selectCols.push(dateCol);
            if (timeCol) selectCols.push(timeCol);
            if (detailCol) selectCols.push(detailCol);
            if (diveNoCol) selectCols.push(diveNoCol);
            if (tapeNoCol) selectCols.push(tapeNoCol);

            if (diverCol) selectCols.push(diverCol);
            if (superCol) selectCols.push(superCol);
            if (coordCol) selectCols.push(coordCol);

            ['OPERATOR', 'WATER_DEPTH', 'DEPTH'].forEach(c => {
              if (logsCols.has(c)) selectCols.push(c);
            });

            const orderByFields = [];
            if (dateCol) orderByFields.push(`${dateCol} ASC`);
            if (timeCol) orderByFields.push(`${timeCol} ASC`);
            const orderByClause = orderByFields.length > 0 ? `ORDER BY ${orderByFields.join(', ')}` : '';

            const logsQuery = `
              SELECT ${selectCols.join(', ')} 
              FROM LOGS 
              WHERE STR_ID = :strId 
              ${orderByClause}
            `;

            const logsResult = await oracleConn.execute(logsQuery, { strId: structureId });
            let rows = logsResult.rows as any[];
            if (selectedInspNo && rows && rows.length > 0) {
              const inspNoIdx = selectCols.indexOf('INSPNO');
              rows = rows.filter((row: any) => {
                const rObj = Array.isArray(row) ? { INSPNO: row[inspNoIdx > -1 ? inspNoIdx : 1] } : row;
                return String(rObj.INSPNO || "").trim() === selectedInspNo;
              });
              logs.push(`Filtered LOGS rows to ${rows.length} record(s) matching selected INSPNO ${selectedInspNo}.`);
            }

            if (rows && rows.length > 0) {
              const rovGroups = new Map<string, any[]>();
              const diveGroups = new Map<string, any[]>();

              rows.forEach(row => {
                const rowObj: any = {};
                if (Array.isArray(row)) {
                  selectCols.forEach((col, idx) => {
                    rowObj[col] = row[idx];
                  });
                } else if (row) {
                  Object.assign(rowObj, row);
                }

                const standardObj = {
                  STR_ID: rowObj.STR_ID,
                  INSPNO: rowObj.INSPNO,
                  LOG_TYPE: rowObj[typeCol || ''] || rowObj.LOG_TYPE,
                  LOG_DATE: rowObj[dateCol || ''] || rowObj.LOG_DATE || rowObj.INSP_DATE,
                  LOG_TIME: rowObj[timeCol || ''] || rowObj.LOG_TIME || rowObj.INSP_TIME,
                  LOG_DETAIL: rowObj[detailCol || ''] || rowObj.LOG_DETAIL,
                  DIVE_NO: rowObj[diveNoCol || ''] || rowObj.DIVE_NO,
                  TAPE_NO: rowObj[tapeNoCol || ''] || rowObj.TAPE_NO || '',
                  DIVER: rowObj[diverCol || ''] || rowObj.DIVER || rowObj.DIVR,
                  SUPERVISOR: rowObj[superCol || ''] || rowObj.SUPERVISOR || rowObj.SUPV,
                  REP_CO: rowObj[coordCol || ''] || rowObj.REP_CO || rowObj.REC_CORD,
                  OPERATOR: rowObj.OPERATOR,
                  WATER_DEPTH: rowObj.WATER_DEPTH,
                  DEPTH: rowObj.DEPTH
                };

                const inspNo = String(standardObj.INSPNO || "").trim();
                const diveNo = String(standardObj.DIVE_NO || "").trim();
                const tapeNo = String(standardObj.TAPE_NO || "").trim();
                const logType = String(standardObj.LOG_TYPE || "").trim().toUpperCase();

                if (inspNo && diveNo) {
                  inspNoToDiveMap.set(inspNo.toUpperCase(), diveNo);
                }
                if (tapeNo && diveNo) {
                  tapeToDiveMap.set(tapeNo.toUpperCase(), diveNo);
                }

                if (logType === 'VESSEL LOG' || logType === 'VESSEL' || logType.includes('VESSEL')) {
                  // Silently filter out Vessel log and its details
                  return;
                }

                if (!inspNo || !diveNo) {
                  const detail = String(standardObj.LOG_DETAIL || "").trim();
                  const msg = `Skipped movement record [${logType}] "${detail}" due to missing INSPNO or DIVE_NO (INSPNO: "${inspNo}", DIVE_NO: "${diveNo}")`;
                  logs.push(msg);
                  report["LOGS_MOVEMENTS"].errors.push(msg);
                  return;
                }

                if (logType !== 'ROV LOG' && logType !== 'DIVER LOG' && logType !== 'BELL LOG') {
                  const detail = String(standardObj.LOG_DETAIL || "").trim();
                  const msg = `Skipped movement record "${detail}" due to unsupported LOG_TYPE: "${logType}"`;
                  logs.push(msg);
                  report["LOGS_MOVEMENTS"].errors.push(msg);
                  return;
                }

                const key = `${inspNo}_${diveNo}`;

                // Pack raw rowObj and standardObj inside the item so we can access both in helper
                const packedObj = {
                  raw: rowObj,
                  standard: standardObj
                };

                if (logType === 'ROV LOG') {
                  if (!rovGroups.has(key)) rovGroups.set(key, []);
                  rovGroups.get(key)!.push(packedObj);
                } else if (logType === 'DIVER LOG' || logType === 'BELL LOG') {
                  if (!diveGroups.has(key)) diveGroups.set(key, []);
                  diveGroups.get(key)!.push(packedObj);
                }
              });

              report["LOGS_JOBS"].oracleRows = rovGroups.size + diveGroups.size;

              // Count only the records that were actually eligible for migration
              // (i.e. after filtering out vessel logs, records with missing keys, and unsupported types)
              let eligibleMovementCount = 0;
              for (const items of Array.from(rovGroups.values())) eligibleMovementCount += items.length;
              for (const items of Array.from(diveGroups.values())) eligibleMovementCount += items.length;
              report["LOGS_MOVEMENTS"].oracleRows = eligibleMovementCount;

              let rovJobsCount = 0;
              let rovMovementsCount = 0;
              let diveJobsCount = 0;
              let diveMovementsCount = 0;

              // Create ROV Jobs
              for (const [key, items] of Array.from(rovGroups.entries())) {
                const firstItem = items[0];
                const lastItem = items[items.length - 1];
                const [inspNo, diveNo] = key.split('_');

                const pgJpId = jpIdMap.get(inspNo);

                const op = String(getMappedValue(rovLogMappings, firstItem.raw, firstItem.standard, "job.rov_operator", "DIVER") || getMappedValue(rovLogMappings, firstItem.raw, firstItem.standard, "job.rov_operator", "OPERATOR") || 'MIGRATION').trim();
                const sv = String(getMappedValue(rovLogMappings, firstItem.raw, firstItem.standard, "job.rov_supervisor", "SUPERVISOR") || 'MIGRATION').trim();
                const co = String(getMappedValue(rovLogMappings, firstItem.raw, firstItem.standard, "job.report_coordinator", "REP_CO") || 'MIGRATION').trim();

                const mappedDiveNo = String(getMappedValue(rovLogMappings, firstItem.raw, firstItem.standard, "job.deployment_no", "DIVE_NO") || diveNo).trim();
                const uniqueDeploymentNo = mappedDiveNo;

                // Delete existing ROV Job with this deployment_no to avoid unique key conflicts and clear old movements/tapes
                const { data: existingRovJob } = await (supabase.from as any)("insp_rov_jobs")
                  .select("rov_job_id")
                  .eq("deployment_no", uniqueDeploymentNo)
                  .maybeSingle();

                if (existingRovJob) {
                  const oldRovJobId = Number(existingRovJob.rov_job_id);
                  logs.push(`Found existing ROV Job (ID: ${oldRovJobId}) for deployment "${uniqueDeploymentNo}". Purging it and its dependencies for a clean re-run.`);
                  
                  // Delete associated movements and tapes first to be safe
                  await (supabase.from as any)("insp_rov_movements").delete().eq("rov_job_id", oldRovJobId);
                  
                  const { data: oldTapes } = await (supabase.from as any)("insp_video_tapes").select("tape_id").eq("rov_job_id", oldRovJobId);
                  if (oldTapes && oldTapes.length > 0) {
                    const tapeIds = oldTapes.map((t: any) => Number(t.tape_id));
                    await (supabase.from as any)("insp_video_logs").delete().in("tape_id", tapeIds);
                    await (supabase.from as any)("insp_video_tapes").delete().in("tape_id", tapeIds);
                  }
                  
                  // Delete the job itself
                  const { error: delErr } = await (supabase.from as any)("insp_rov_jobs").delete().eq("rov_job_id", oldRovJobId);
                  if (delErr) {
                    logs.push(`WARNING: Failed to delete existing ROV Job ID ${oldRovJobId}: ${delErr.message}`);
                  }
                }

                const mappedDate = getMappedValue(rovLogMappings, firstItem.raw, firstItem.standard, "job.deployment_date", "LOG_DATE");
                const deploymentDate = mappedDate
                  ? combineDateTime(mappedDate, firstItem.standard.LOG_TIME).split('T')[0]
                  : combineDateTime(firstItem.standard.LOG_DATE, firstItem.standard.LOG_TIME).split('T')[0];

                const { data: newJob, error: jobErr } = await (supabase.from as any)("insp_rov_jobs")
                  .insert({
                    deployment_no: uniqueDeploymentNo,
                    structure_id: resolvedStructureId,
                    jobpack_id: pgJpId || null,
                    sow_report_no: jobpackDefaultPrefixMap.get(inspNo) || null,
                    rov_serial_no: 'ROV-01',
                    rov_operator: op,
                    rov_supervisor: sv,
                    report_coordinator: co,
                    deployment_date: deploymentDate,
                    start_time: formatTimeOnly(firstItem.standard.LOG_TIME),
                    end_time: formatTimeOnly(lastItem.standard.LOG_TIME),
                    status: 'COMPLETED',
                    additional_info: { original_dive_no: diveNo },
                    cr_user: 'migration',
                    workunit: '000'
                  })
                  .select("rov_job_id")
                  .single();

                if (jobErr) {
                  logs.push(`ERROR creating ROV Job for deployment ${uniqueDeploymentNo}: ${jobErr.message}`);
                  report["LOGS_JOBS"].errors.push(jobErr.message);
                  continue;
                }

                const rovJobId = Number(newJob.rov_job_id);
                rovJobsCache.set(key, rovJobId);
                rovJobsCount++;
                logs.push(`Created ROV Job ID: ${rovJobId} (deployment ${uniqueDeploymentNo}) with structure_id: ${resolvedStructureId}, jobpack_id: ${pgJpId || 'null'}, sow_report_no: ${jobpackDefaultPrefixMap.get(inspNo) || 'null'}`);

                // Insert Movements (including all items so no events are lost)
                const movements = items.map(item => {
                  const detail = String(getMappedValue(rovLogMappings, item.raw, item.standard, "movement.remarks", "LOG_DETAIL") || "").trim();
                  const mType = getRovMovementType(detail);

                  const depthVal = getMappedValue(rovLogMappings, item.raw, item.standard, "movement.depth_meters", "WATER_DEPTH") || getMappedValue(rovLogMappings, item.raw, item.standard, "movement.depth_meters", "DEPTH");
                  const depth = depthVal ? Number(depthVal) : null;

                  const itemLogDate = getMappedValue(rovLogMappings, item.raw, item.standard, "movement.movement_time", "LOG_DATE") || item.standard.LOG_DATE;

                  return {
                    rov_job_id: rovJobId,
                    movement_type: mType,
                    movement_time: combineDateTime(itemLogDate, item.standard.LOG_TIME),
                    depth_meters: depth,
                    remarks: detail,
                    cr_user: 'migration',
                    workunit: '000'
                  };
                });

                if (movements.length > 0) {
                  const { error: mvErr } = await (supabase.from as any)("insp_rov_movements").insert(movements);
                  if (mvErr) {
                    logs.push(`WARNING: inserting ROV Movements failed: ${mvErr.message}`);
                    report["LOGS_MOVEMENTS"].errors.push(mvErr.message);
                  } else {
                    rovMovementsCount += movements.length;
                  }
                }
              }

              // Create Dive Jobs
              for (const [key, items] of Array.from(diveGroups.entries())) {
                const firstItem = items[0];
                const lastItem = items[items.length - 1];
                const [inspNo, diveNo] = key.split('_');

                const pgJpId = jpIdMap.get(inspNo);

                const diver = String(getMappedValue(diveLogMappings, firstItem.raw, firstItem.standard, "job.diver_name", "DIVER") || 'MIGRATION').trim();
                const sv = String(getMappedValue(diveLogMappings, firstItem.raw, firstItem.standard, "job.dive_supervisor", "SUPERVISOR") || 'MIGRATION').trim();
                const co = String(getMappedValue(diveLogMappings, firstItem.raw, firstItem.standard, "job.report_coordinator", "REP_CO") || 'MIGRATION').trim();

                const mappedDiveNo = String(getMappedValue(diveLogMappings, firstItem.raw, firstItem.standard, "job.dive_no", "DIVE_NO") || diveNo).trim();
                const uniqueDiveNo = mappedDiveNo;

                // Delete existing Diving Job with this dive_no to avoid unique key conflicts and clear old movements/tapes
                const { data: existingDiveJob } = await (supabase.from as any)("insp_dive_jobs")
                  .select("dive_job_id")
                  .eq("dive_no", uniqueDiveNo)
                  .maybeSingle();

                if (existingDiveJob) {
                  const oldDiveJobId = Number(existingDiveJob.dive_job_id);
                  logs.push(`Found existing Diving Job (ID: ${oldDiveJobId}) for dive "${uniqueDiveNo}". Purging it and its dependencies for a clean re-run.`);
                  
                  // Delete associated movements and tapes first to be safe
                  await (supabase.from as any)("insp_dive_movements").delete().eq("dive_job_id", oldDiveJobId);
                  
                  const { data: oldTapes } = await (supabase.from as any)("insp_video_tapes").select("tape_id").eq("dive_job_id", oldDiveJobId);
                  if (oldTapes && oldTapes.length > 0) {
                    const tapeIds = oldTapes.map((t: any) => Number(t.tape_id));
                    await (supabase.from as any)("insp_video_logs").delete().in("tape_id", tapeIds);
                    await (supabase.from as any)("insp_video_tapes").delete().in("tape_id", tapeIds);
                  }
                  
                  // Delete the job itself
                  const { error: delErr } = await (supabase.from as any)("insp_dive_jobs").delete().eq("dive_job_id", oldDiveJobId);
                  if (delErr) {
                    logs.push(`WARNING: Failed to delete existing Diving Job ID ${oldDiveJobId}: ${delErr.message}`);
                  }
                }

                const mappedDate = getMappedValue(diveLogMappings, firstItem.raw, firstItem.standard, "job.dive_date", "LOG_DATE");
                const diveDate = mappedDate
                  ? combineDateTime(mappedDate, firstItem.standard.LOG_TIME).split('T')[0]
                  : combineDateTime(firstItem.standard.LOG_DATE, firstItem.standard.LOG_TIME).split('T')[0];

                const hasBell = items.some(item => String(item.standard.LOG_TYPE).toUpperCase() === 'BELL LOG');

                const { data: newJob, error: jobErr } = await (supabase.from as any)("insp_dive_jobs")
                  .insert({
                    dive_no: uniqueDiveNo,
                    structure_id: resolvedStructureId,
                    jobpack_id: pgJpId || null,
                    sow_report_no: jobpackDefaultPrefixMap.get(inspNo) || null,
                    dive_type: hasBell ? 'BELL' : 'AIR',
                    diver_name: diver,
                    dive_supervisor: sv,
                    report_coordinator: co,
                    dive_date: diveDate,
                    start_time: formatTimeOnly(firstItem.standard.LOG_TIME),
                    end_time: formatTimeOnly(lastItem.standard.LOG_TIME),
                    status: 'COMPLETED',
                    additional_info: { original_dive_no: diveNo, dive_type: hasBell ? 'BELL' : 'DIVER' },
                    cr_user: 'migration',
                  })
                  .select("dive_job_id")
                  .single();

                if (jobErr) {
                  logs.push(`ERROR creating Dive Job for dive ${uniqueDiveNo}: ${jobErr.message}`);
                  report["LOGS_JOBS"].errors.push(jobErr.message);
                  continue;
                }

                const diveJobId = Number(newJob.dive_job_id);
                diveJobsCache.set(key, diveJobId);
                diveJobsCount++;
                logs.push(`Created Diving Job ID: ${diveJobId} (dive ${uniqueDiveNo}) with structure_id: ${resolvedStructureId}, jobpack_id: ${pgJpId || 'null'}, sow_report_no: ${jobpackDefaultPrefixMap.get(inspNo) || 'null'}`);

                // Insert Movements (including all items so no events are lost)
                const movements = items.map(item => {
                  const detail = String(getMappedValue(diveLogMappings, item.raw, item.standard, "movement.remarks", "LOG_DETAIL") || "").trim();
                  const mType = getDiveMovementType(detail);

                  const depthVal = getMappedValue(diveLogMappings, item.raw, item.standard, "movement.depth_meters", "WATER_DEPTH") || getMappedValue(diveLogMappings, item.raw, item.standard, "movement.depth_meters", "DEPTH");
                  const depth = depthVal ? Number(depthVal) : null;

                  const itemLogDate = getMappedValue(diveLogMappings, item.raw, item.standard, "movement.movement_time", "LOG_DATE") || item.standard.LOG_DATE;

                  return {
                    dive_job_id: diveJobId,
                    movement_type: mType,
                    movement_time: combineDateTime(itemLogDate, item.standard.LOG_TIME),
                    depth_meters: depth,
                    remarks: detail,
                    cr_user: 'migration',
                    workunit: '000'
                  };
                });

                if (movements.length > 0) {
                  const { error: mvErr } = await (supabase.from as any)("insp_dive_movements").insert(movements);
                  if (mvErr) {
                    logs.push(`WARNING: inserting Dive Movements failed: ${mvErr.message}`);
                    report["LOGS_MOVEMENTS"].errors.push(mvErr.message);
                  } else {
                    diveMovementsCount += movements.length;
                  }
                }
              }

              logs.push(`Successfully migrated ${rovJobsCount} ROV Jobs & ${diveJobsCount} Diving Jobs.`);
              logs.push(`Successfully migrated ${rovMovementsCount} ROV Movements & ${diveMovementsCount} Dive Movements.`);

              report["LOGS_JOBS"].status = report["LOGS_JOBS"].errors.length > 0 ? "failed" : "success";
              report["LOGS_JOBS"].migratedRows = rovJobsCount + diveJobsCount;

              report["LOGS_MOVEMENTS"].status = report["LOGS_MOVEMENTS"].errors.length > 0 ? "failed" : "success";
              report["LOGS_MOVEMENTS"].migratedRows = rovMovementsCount + diveMovementsCount;
            } else {
              logs.push(`No logs found in Oracle 'LOGS' table for Structure ID ${structureId}.`);
              report["LOGS_JOBS"].status = "success";
              report["LOGS_MOVEMENTS"].status = "success";
            }
          } else {
            logs.push(`Oracle 'LOGS' table not present. Skipped LOGS migration.`);
            report["LOGS_JOBS"].status = "skipped";
            report["LOGS_MOVEMENTS"].status = "skipped";
          }
        } catch (logsErr: any) {
          logs.push(`ERROR in Phase 2 logs migration block: ${logsErr.message}`);
          console.error("Phase 2 LOGS migration failed:", logsErr);
          report["LOGS_JOBS"].status = "failed";
          report["LOGS_JOBS"].errors.push(logsErr.message);
          report["LOGS_MOVEMENTS"].status = "failed";
          report["LOGS_MOVEMENTS"].errors.push(logsErr.message);
        }

        // ---------------------------------------------------------------------
        // Phase 3: Migrate Video Tapes & Video Logs
        // ---------------------------------------------------------------------
        report["VIDEO"].status = "failed";
        logs.push(`Phase 3: Migrating Video Tapes & Video Logs...`);

        const tapesCache = new Map<string, number>();

        let videoTapesCount = 0;
        let videoLogsCount = 0;
        let oracleVideoTapesCount = 0;

        // 3a. Migrate ROV Tapes and Logs (from PLATGI)
        const platgiCols = await getOracleTableColumns(oracleConn, 'PLATGI');
        if (platgiCols.size > 0 && platgiCols.has('TAPE_NO')) {
          // Pre-fetch all TAPE LOG rows from PLATGI to parse metadata
          const tapeLogRows: any[] = [];
          if (platgiCols.has('DESCRIPTION') || platgiCols.has('DESCR')) {
            const descCol = platgiCols.has('DESCRIPTION') ? 'DESCRIPTION' : 'DESCR';
            const logQCols = ['TAPE_NO', 'DIVE_NO', 'INSPNO', descCol];
            if (platgiCols.has('COUNTER_NO')) logQCols.push('COUNTER_NO');
            if (platgiCols.has('COMMENTS')) logQCols.push('COMMENTS');
            if (platgiCols.has('I_DATE')) logQCols.push('I_DATE');
            if (platgiCols.has('I_TIME')) logQCols.push('I_TIME');
            if (platgiCols.has('CR_DATE')) logQCols.push('CR_DATE');

            try {
              const logResult = await oracleConn.execute(`
                SELECT ${logQCols.join(', ')} 
                FROM PLATGI 
                WHERE STR_ID = :strId AND UPPER(${descCol}) LIKE '%TAPE LOG%'
              `, { strId: structureId });
              if (logResult.rows) {
                tapeLogRows.push(...logResult.rows);
              }
            } catch (err: any) {
              logs.push(`WARNING: Pre-fetching TAPE LOGS failed: ${err.message}`);
            }
          }

          // In-memory index of parsed tape groups: key is tapeNo (grouping purely by tape_no to avoid duplicates)
          const tapeGroups = new Map<string, any[]>();
          tapeLogRows.forEach(row => {
            const tNo = String(getObjProperty(row, 'TAPE_NO') || "").trim();
            if (!tNo) return;

            const key = tNo;
            if (!tapeGroups.has(key)) {
              tapeGroups.set(key, []);
            }
            tapeGroups.get(key)!.push(row);
          });

          logs.push(`Migrating unique ROV tapes parsed from 'PLATGI'...`);
          for (const [tapeNo, groupRows] of Array.from(tapeGroups.entries())) {
            // Sort chronologically by date, time, and counter_no
            const sortedRows = groupRows.sort((a, b) => {
              const dateA = getObjProperty(a, 'I_DATE') || getObjProperty(a, 'CR_DATE');
              const dateB = getObjProperty(b, 'I_DATE') || getObjProperty(b, 'CR_DATE');
              const timeA = getObjProperty(a, 'I_TIME') || '00:00:00';
              const timeB = getObjProperty(b, 'I_TIME') || '00:00:00';
              const dtA = combineDateTime(dateA, timeA);
              const dtB = combineDateTime(dateB, timeB);
              if (dtA !== dtB) return dtA < dtB ? -1 : 1;

              const cntA = Number(getObjProperty(a, 'COUNTER_NO') || 0);
              const cntB = Number(getObjProperty(b, 'COUNTER_NO') || 0);
              return cntA - cntB;
            });

            // If selectedInspNo is provided, only migrate this tape if any event in it matches selectedInspNo
            if (selectedInspNo) {
              const hasSelectedInsp = sortedRows.some(row => String(getObjProperty(row, 'INSPNO') || "").trim() === selectedInspNo);
              if (!hasSelectedInsp) continue;
            }

            // 1. Scan the group to see if any row has an explicit chapter number
            let hasExplicitChapter = false;
            let groupTapeType = 'ROV';
            sortedRows.forEach(row => {
              const comms = String(getObjProperty(row, 'COMMENTS') || "").trim();
              if (comms) {
                const parsed = parseComments(comms);
                if (parsed.chapter) {
                  hasExplicitChapter = true;
                }
                if (parsed.tape) {
                  groupTapeType = parsed.tape;
                }
              }
            });

            // 2. Assign chapter numbers to each row
            const assignedChapters = new Map<any, string>();
            if (hasExplicitChapter) {
              let currentChapter = '1';
              sortedRows.forEach(row => {
                const comms = String(getObjProperty(row, 'COMMENTS') || "").trim();
                const parsed = parseComments(comms);
                if (parsed.chapter) {
                  currentChapter = parsed.chapter;
                }
                assignedChapters.set(row, currentChapter);
              });
            } else {
              // Dynamic auto-sequence logic: start at 1, increment after stop events followed by start events.
              // Note: Start event must start after a STOP event, NOT after a pause.
              let currentChapterInt = 1;
              let hasStopped = false;

              const isStopEvent = (comms: string) => {
                const upper = comms.toUpperCase();
                const hasStop = /\bSTOP\b/.test(upper) || upper.includes('ON DECK');
                const hasEnd = /\bEND\b/.test(upper);
                const hasPauseOrChange = /\bPAUSE\b/.test(upper) || /\bCHANGE\b/.test(upper);
                return (hasStop || hasEnd) && !hasPauseOrChange;
              };

              const isPauseEvent = (comms: string) => {
                const upper = comms.toUpperCase();
                return /\bPAUSE\b/.test(upper) || /\bCHANGE\b/.test(upper);
              };

              const isStartEvent = (comms: string) => {
                const upper = comms.toUpperCase();
                return /\bSTART\b/.test(upper) || upper.includes('OFF DECK');
              };

              sortedRows.forEach(row => {
                const comms = String(getObjProperty(row, 'COMMENTS') || "").trim();
                if (isStopEvent(comms)) {
                  hasStopped = true;
                } else if (isPauseEvent(comms)) {
                  hasStopped = false;
                } else if (isStartEvent(comms)) {
                  if (hasStopped) {
                    currentChapterInt++;
                    hasStopped = false;
                  }
                }
                assignedChapters.set(row, String(currentChapterInt));
              });
            }

            // Group the sorted rows by assigned chapter number to insert as separate tapes/logs
            const rowsByChapter = new Map<string, any[]>();
            sortedRows.forEach(row => {
              const ch = assignedChapters.get(row) || '1';
              if (!rowsByChapter.has(ch)) {
                rowsByChapter.set(ch, []);
              }
              rowsByChapter.get(ch)!.push(row);
            });

            oracleVideoTapesCount += rowsByChapter.size;

            for (const [chapterNum, chapterRows] of Array.from(rowsByChapter.entries())) {
              // Find the first row in this chapter to resolve job ID
              const firstRow = chapterRows[0];
              const diveNo = String(getObjProperty(firstRow, 'DIVE_NO') || "").trim();
              const inspNo = String(getObjProperty(firstRow, 'INSPNO') || "").trim();

              const jobKey = `${inspNo}_${diveNo}`;
              let resolvedJobId = rovJobsCache.get(jobKey) || null;

              if (!resolvedJobId && diveNo) {
                try {
                  const { data: existingRov } = await (supabase.from as any)("insp_rov_jobs")
                    .select("rov_job_id")
                    .eq("deployment_no", diveNo)
                    .maybeSingle();

                  if (existingRov) {
                    resolvedJobId = Number(existingRov.rov_job_id);
                    rovJobsCache.set(jobKey, resolvedJobId);
                    logs.push(`Found and reused existing ROV Job ID: ${resolvedJobId} for deployment "${diveNo}"`);
                  } else {
                    const pgJpId = jpIdMap.get(inspNo) || null;
                    const { data: newJob, error: jobErr } = await (supabase.from as any)("insp_rov_jobs")
                      .insert({
                        deployment_no: diveNo,
                        structure_id: resolvedStructureId,
                        jobpack_id: pgJpId || null,
                        sow_report_no: jobpackDefaultPrefixMap.get(inspNo) || null,
                        rov_serial_no: 'ROV-01',
                        rov_operator: 'FALLBACK',
                        rov_supervisor: 'FALLBACK',
                        report_coordinator: 'FALLBACK',
                        deployment_date: formatLocalDateOnly(new Date()),
                        start_time: '00:00:00',
                        end_time: '00:00:00',
                        status: 'COMPLETED',
                        additional_info: { is_fallback: true, original_dive_no: diveNo },
                        cr_user: 'migration',
                        workunit: '000'
                      })
                      .select("rov_job_id")
                      .single();

                    if (jobErr) {
                      logs.push(`WARNING: Failed to create fallback ROV Job for "${diveNo}": ${jobErr.message}`);
                    } else if (newJob) {
                      resolvedJobId = Number(newJob.rov_job_id);
                      rovJobsCache.set(jobKey, resolvedJobId);
                      logs.push(`Created fallback ROV Job ID: ${resolvedJobId} for deployment "${diveNo}"`);
                    }
                  }
                } catch (err: any) {
                  logs.push(`WARNING: Fallback ROV Job resolution failed: ${err.message}`);
                }
              }

              const { data: newTape, error: tapeErr } = await (supabase.from as any)("insp_video_tapes")
                .insert({
                  tape_no: tapeNo,
                  rov_job_id: resolvedJobId,
                  tape_type: groupTapeType || 'ROV',
                  chapter_no: chapterNum,
                  status: 'COMPLETED',
                  cr_user: 'migration',
                  workunit: '000'
                })
                .select("tape_id")
                .single();

              let tapeId: number | null = null;
              if (tapeErr) {
                // Try to find the existing tape matching both tape_no and chapter_no
                const { data: existingTape } = await (supabase.from as any)("insp_video_tapes")
                  .select("tape_id")
                  .eq("tape_no", tapeNo)
                  .eq("chapter_no", chapterNum)
                  .maybeSingle();

                if (existingTape) {
                  tapeId = Number(existingTape.tape_id);
                  logs.push(`Using existing ROV tape ${tapeNo} (Chapter: ${chapterNum}, ID: ${tapeId})`);
                } else {
                  logs.push(`WARNING: Could not insert ROV tape ${tapeNo} Chapter ${chapterNum}: ${tapeErr.message}`);
                  continue;
                }
              } else {
                tapeId = Number(newTape.tape_id);
              }

              // Save to tapesCache for all dive/inspection combos present in this chapter
              chapterRows.forEach(row => {
                const logDiveNo = String(getObjProperty(row, 'DIVE_NO') || "").trim();
                const logInspNo = String(getObjProperty(row, 'INSPNO') || "").trim();
                const cacheKey = `ROV_${tapeNo}_${logDiveNo}_${logInspNo}`;
                if (!tapesCache.has(cacheKey) && tapeId !== null) {
                  tapesCache.set(cacheKey, tapeId);
                }
              });

              videoTapesCount++;

              // Define event types precisely with word boundary safety to avoid substrings like "FEND" or "FENDER"
              const isStopComment = (comms: string) => {
                const upper = comms.toUpperCase();
                const hasStop = /\bSTOP/.test(upper) || upper.includes('ON DECK');
                const hasEnd = /\bEND/.test(upper);
                const hasPauseOrChange = /\bPAUSE/.test(upper) || /\bCHANGE/.test(upper);
                return (hasStop || hasEnd) && !hasPauseOrChange;
              };

              const isPauseComment = (comms: string) => {
                const upper = comms.toUpperCase();
                return /\bPAUSE/.test(upper) || /\bCHANGE/.test(upper);
              };

              const isStartComment = (comms: string) => {
                const upper = comms.toUpperCase();
                return /\bSTART/.test(upper) || upper.includes('OFF DECK') || /\bRESUME/.test(upper) || /\bCONTINUE/.test(upper);
              };

              // Map all logs for this specific tape chapter
              const vLogs = chapterRows
                .map(row => {
                  const comments = String(getObjProperty(row, 'COMMENTS') || "").trim();
                  const parsed = parseComments(comments);

                  let eventType = 'CUSTOM';
                  if (isStopComment(comments)) {
                    eventType = 'END';
                  } else if (isPauseComment(comments)) {
                    eventType = 'PAUSE';
                  } else if (isStartComment(comments)) {
                    // Start logic: determine if previous state was STOP or PAUSE
                    let prevState: 'STOP' | 'PAUSE' | 'START' | null = null;
                    const rowIndex = sortedRows.indexOf(row);
                    for (let i = rowIndex - 1; i >= 0; i--) {
                      const prevComms = String(getObjProperty(sortedRows[i], 'COMMENTS') || "").trim();
                      if (isStopComment(prevComms)) {
                        prevState = 'STOP';
                        break;
                      }
                      if (isPauseComment(prevComms)) {
                        prevState = 'PAUSE';
                        break;
                      }
                      if (isStartComment(prevComms)) {
                        prevState = 'START';
                        break;
                      }
                    }

                    const upper = comments.toUpperCase();
                    const isExplicitResume = /\bRESUME/.test(upper) || /\bCONTINUE/.test(upper);

                    if (prevState === 'PAUSE' || prevState === 'START' || isExplicitResume) {
                      eventType = 'RESUME';
                    } else {
                      // previous state is STOP or there's no previous state
                      eventType = 'NEW_LOG_START';
                    }
                  } else if (parsed.subject) {
                    eventType = 'CUSTOM';
                  } else {
                    eventType = 'NOTE';
                  }

                  // Preserve full comment details in remarks
                  const remarksVal = comments || 'TAPE LOG';

                  // Combine date & time cleanly
                  const itemLogDate = getObjProperty(row, 'I_DATE') || getObjProperty(row, 'CR_DATE') || new Date();
                  const itemLogTime = getObjProperty(row, 'I_TIME') || '00:00:00';
                  const combinedEventTime = combineDateTime(itemLogDate, itemLogTime);

                  // Parse counter_no cleanly
                  const counterValRaw = getObjProperty(row, 'COUNTER_NO');
                  const counterVal = counterValRaw !== undefined && counterValRaw !== null ? Number(counterValRaw) : null;

                  // Parse cr_date cleanly
                  let parsedCrDate = formatLocalISOString(new Date());
                  const crDateVal = getObjProperty(row, 'CR_DATE');
                  if (crDateVal) {
                    parsedCrDate = formatLocalISOString(crDateVal) || parsedCrDate;
                  }

                  return {
                    tape_id: tapeId,
                    event_type: eventType,
                    event_time: combinedEventTime,
                    timecode_start: '00:00:00',
                    timecode_end: null,
                    remarks: remarksVal,
                    cr_user: 'migration',
                    cr_date: parsedCrDate,
                    workunit: '000',
                    tape_counter_start: counterVal,
                    counter_format: 'HH:MM:SS'
                  };
                })
                .filter(Boolean);

              if (vLogs.length > 0) {
                const { error: insertVLogErr } = await (supabase.from as any)("insp_video_logs").insert(vLogs);
                if (insertVLogErr) {
                  logs.push(`WARNING: Inserting ROV Video Logs failed for Chapter ${chapterNum}: ${insertVLogErr.message}`);
                } else {
                  videoLogsCount += vLogs.length;
                }
              }
            }
          }
        }

        // 3b. Migrate Diving Tapes and Logs (from VIDEO)
        const videoCols = await getOracleTableColumns(oracleConn, 'VIDEO');
        if (videoCols.size > 0 && videoCols.has('TAPE_NO')) {
          logs.push(`Pre-fetching all Diving tape log rows from 'VIDEO'...`);

          const logQCols = ['TAPE_NO', 'DIVE_NO', 'INSPNO'];
          if (videoCols.has('SUBJECT')) logQCols.push('SUBJECT');
          if (videoCols.has('TAPE_FOOTAGE')) logQCols.push('TAPE_FOOTAGE');
          if (videoCols.has('INSP_DATE')) logQCols.push('INSP_DATE');
          if (videoCols.has('INSP_TIME')) logQCols.push('INSP_TIME');
          if (videoCols.has('CR_DATE')) logQCols.push('CR_DATE');
          if (videoCols.has('INSP_COND')) logQCols.push('INSP_COND');
          if (videoCols.has('TAPE_TYPE')) logQCols.push('TAPE_TYPE');

          const divTapeLogRows: any[] = [];
          try {
            const logResult = await oracleConn.execute(`
              SELECT ${logQCols.join(', ')} 
              FROM VIDEO 
              WHERE STR_ID = :strId AND TAPE_NO IS NOT NULL
            `, { strId: structureId });
            if (logResult.rows) {
              divTapeLogRows.push(...logResult.rows);
            }
          } catch (err: any) {
            logs.push(`WARNING: Pre-fetching Diving TAPE LOGS failed: ${err.message}`);
          }

          // In-memory index of unique Diving tapes: key is `${tapeNo}_${chapterNo}` (grouping purely by tape number & chapter to avoid duplicates)
          const divTapeConfigs = new Map<string, { tapeNo: string; chapter: string | null; tapeType: string; rows: any[] }>();
          divTapeLogRows.forEach(row => {
            const tNo = String(getObjProperty(row, 'TAPE_NO') || "").trim();
            const dNo = String(getObjProperty(row, 'DIVE_NO') || "").trim();
            const iNo = String(getObjProperty(row, 'INSPNO') || "").trim();
            const inspCond = String(getObjProperty(row, 'INSP_COND') || "").trim();
            const tType = String(getObjProperty(row, 'TAPE_TYPE') || 'DIVER').trim();
            
            if (tNo && dNo) tapeToDiveMap.set(tNo.toUpperCase(), dNo);
            if (iNo && dNo) inspNoToDiveMap.set(iNo.toUpperCase(), dNo);

            if (!tNo) return;

            let chNo = null;
            if (inspCond) {
              chNo = parseDivingChapter(inspCond);
            }

            const key = `${tNo}_${chNo || '1'}`;
            if (!divTapeConfigs.has(key)) {
              divTapeConfigs.set(key, { tapeNo: tNo, chapter: chNo, tapeType: tType || 'DIVER', rows: [] });
            }
            divTapeConfigs.get(key)!.rows.push(row);
          });

          logs.push(`Migrating unique Diving tapes parsed from 'VIDEO'...`);
          for (const [configKey, conf] of Array.from(divTapeConfigs.entries())) {
            const { tapeNo, chapter, tapeType, rows: groupRows } = conf;

            // Sort chronologically
            const sortedRows = groupRows.sort((a, b) => {
              const dateA = getObjProperty(a, 'INSP_DATE') || getObjProperty(a, 'CR_DATE');
              const dateB = getObjProperty(b, 'INSP_DATE') || getObjProperty(b, 'CR_DATE');
              const timeA = getObjProperty(a, 'INSP_TIME') || '00:00:00';
              const timeB = getObjProperty(b, 'INSP_TIME') || '00:00:00';
              const dtA = combineDateTime(dateA, timeA);
              const dtB = combineDateTime(dateB, timeB);
              if (dtA !== dtB) return dtA < dtB ? -1 : 1;
              return 0;
            });

            // Find first row to resolve job ID
            const firstRow = sortedRows[0];
            const diveNo = String(getObjProperty(firstRow, 'DIVE_NO') || "").trim();
            const inspNo = String(getObjProperty(firstRow, 'INSPNO') || "").trim();

            if (selectedInspNo) {
              const hasSelectedInsp = sortedRows.some(row => String(getObjProperty(row, 'INSPNO') || "").trim() === selectedInspNo);
              if (!hasSelectedInsp) continue;
            }

            oracleVideoTapesCount++;

            const jobKey = `${inspNo}_${diveNo}`;
            let resolvedJobId = diveJobsCache.get(jobKey) || null;

            if (!resolvedJobId && diveNo) {
              try {
                const { data: existingDive } = await (supabase.from as any)("insp_dive_jobs")
                  .select("dive_job_id")
                  .eq("dive_no", diveNo)
                  .maybeSingle();

                if (existingDive) {
                  resolvedJobId = Number(existingDive.dive_job_id);
                  diveJobsCache.set(jobKey, resolvedJobId);
                  logs.push(`Found and reused existing Diving Job ID: ${resolvedJobId} for dive "${diveNo}"`);
                } else {
                  const pgJpId = jpIdMap.get(inspNo) || null;
                  const { data: newJob, error: jobErr } = await (supabase.from as any)("insp_dive_jobs")
                    .insert({
                      dive_no: diveNo,
                      structure_id: resolvedStructureId,
                      jobpack_id: pgJpId || null,
                      sow_report_no: jobpackDefaultPrefixMap.get(inspNo) || null,
                      dive_type: 'AIR',
                      diver_name: 'FALLBACK',
                      dive_supervisor: 'FALLBACK',
                      report_coordinator: 'FALLBACK',
                      dive_date: formatLocalDateOnly(new Date()),
                      start_time: '00:00:00',
                      end_time: '00:00:00',
                      status: 'COMPLETED',
                      additional_info: { is_fallback: true, original_dive_no: diveNo },
                      cr_user: 'migration',
                    })
                    .select("dive_job_id")
                    .single();

                  if (jobErr) {
                    logs.push(`WARNING: Failed to create fallback Diving Job for "${diveNo}": ${jobErr.message}`);
                  } else if (newJob) {
                    resolvedJobId = Number(newJob.dive_job_id);
                    diveJobsCache.set(jobKey, resolvedJobId);
                    logs.push(`Created fallback Diving Job ID: ${resolvedJobId} for dive "${diveNo}"`);
                  }
                }
              } catch (err: any) {
                logs.push(`WARNING: Fallback Diving Job resolution failed: ${err.message}`);
              }
            }

            const { data: newTape, error: tapeErr } = await (supabase.from as any)("insp_video_tapes")
              .insert({
                tape_no: tapeNo,
                dive_job_id: resolvedJobId,
                tape_type: tapeType || 'DIVER',
                chapter_no: chapter,
                status: 'COMPLETED',
                cr_user: 'migration',
                workunit: '000'
              })
              .select("tape_id")
              .single();

            let tapeId: number | null = null;
            if (tapeErr) {
              // Try to find the existing tape matching tape_no and chapter
              const { data: existingTape } = await (supabase.from as any)("insp_video_tapes")
                .select("tape_id")
                .eq("tape_no", tapeNo)
                .eq("chapter_no", chapter)
                .maybeSingle();

              if (existingTape) {
                tapeId = Number(existingTape.tape_id);
                logs.push(`Using existing Diving tape ${tapeNo} (Chapter: ${chapter}, ID: ${tapeId})`);
              } else {
                logs.push(`WARNING: Could not insert Diving tape ${tapeNo} Chapter ${chapter}: ${tapeErr.message}`);
                continue;
              }
            } else {
              tapeId = Number(newTape.tape_id);
            }

            // Save to tapesCache for all dive/inspection combos present in this tape config
            sortedRows.forEach(row => {
              const logDiveNo = String(getObjProperty(row, 'DIVE_NO') || "").trim();
              const logInspNo = String(getObjProperty(row, 'INSPNO') || "").trim();
              if (tapeId !== null) {
                tapesCache.set(`DIV_${tapeNo}_${logDiveNo}_${logInspNo}`, tapeId);
              }
            });

            videoTapesCount++;

            // Define stop/pause/start event rules for diving tapes with word boundary safety
            const isStopComment = (comms: string) => {
              const upper = comms.toUpperCase();
              const hasStop = /\bSTOP/.test(upper) || upper.includes('ON DECK');
              const hasEnd = /\bEND/.test(upper);
              const hasPauseOrChange = /\bPAUSE/.test(upper) || /\bCHANGE/.test(upper);
              return (hasStop || hasEnd) && !hasPauseOrChange;
            };

            const isPauseComment = (comms: string) => {
              const upper = comms.toUpperCase();
              return /\bPAUSE/.test(upper) || /\bCHANGE/.test(upper);
            };

            const isStartComment = (comms: string) => {
              const upper = comms.toUpperCase();
              return /\bSTART/.test(upper) || upper.includes('OFF DECK') || /\bRESUME/.test(upper) || /\bCONTINUE/.test(upper);
            };

            // Map all logs for this unique tape
            const vLogs = sortedRows
              .map(row => {
                const subjectVal = String(getObjProperty(row, 'SUBJECT') || "").trim();
                const inspCond = String(getObjProperty(row, 'INSP_COND') || "").trim();
                const fullComments = `${subjectVal} ${inspCond}`;

                let eventType = 'CUSTOM';
                if (isStopComment(fullComments)) {
                  eventType = 'END';
                } else if (isPauseComment(fullComments)) {
                  eventType = 'PAUSE';
                } else if (isStartComment(fullComments)) {
                  // Start logic: determine if previous state was STOP or PAUSE
                  let prevState: 'STOP' | 'PAUSE' | 'START' | null = null;
                  const rowIndex = sortedRows.indexOf(row);
                  for (let i = rowIndex - 1; i >= 0; i--) {
                    const prevRowSub = String(getObjProperty(sortedRows[i], 'SUBJECT') || "").trim();
                    const prevRowCond = String(getObjProperty(sortedRows[i], 'INSP_COND') || "").trim();
                    const prevFullComments = `${prevRowSub} ${prevRowCond}`;
                    if (isStopComment(prevFullComments)) {
                      prevState = 'STOP';
                      break;
                    }
                    if (isPauseComment(prevFullComments)) {
                      prevState = 'PAUSE';
                      break;
                    }
                    if (isStartComment(prevFullComments)) {
                      prevState = 'START';
                      break;
                    }
                  }

                  const upper = fullComments.toUpperCase();
                  const isExplicitResume = /\bRESUME/.test(upper) || /\bCONTINUE/.test(upper);

                  if (prevState === 'PAUSE' || prevState === 'START' || isExplicitResume) {
                    eventType = 'RESUME';
                  } else {
                    eventType = 'NEW_LOG_START';
                  }
                } else if (fullComments.toUpperCase().includes('INSPECTION')) {
                  eventType = 'INSPECTION';
                } else if (fullComments.toUpperCase().includes('ANOMALY')) {
                  eventType = 'ANOMALY';
                } else {
                  eventType = 'NOTE';
                }

                // Preserve subject and inspection condition in remarks
                const remarksVal = (subjectVal && inspCond) 
                  ? `${subjectVal} - ${inspCond}` 
                  : (subjectVal || inspCond || 'VIDEO LOG');

                // Combine INSP_DATE & INSP_TIME cleanly
                const itemLogDate = getObjProperty(row, 'INSP_DATE') || getObjProperty(row, 'CR_DATE') || new Date();
                const itemLogTime = getObjProperty(row, 'INSP_TIME') || '00:00:00';
                const combinedEventTime = combineDateTime(itemLogDate, itemLogTime);

                // Parse tape footage cleanly as counter number
                let counterVal = null;
                const footageVal = getObjProperty(row, 'TAPE_FOOTAGE');
                if (footageVal !== undefined && footageVal !== null) {
                  const cleanStr = String(footageVal).replace(/\D/g, '');
                  if (cleanStr) {
                    counterVal = Number(cleanStr);
                  }
                }

                // Parse cr_date cleanly
                let parsedCrDate = formatLocalISOString(new Date());
                const crDateVal = getObjProperty(row, 'CR_DATE');
                if (crDateVal) {
                  parsedCrDate = formatLocalISOString(crDateVal) || parsedCrDate;
                }

                return {
                  tape_id: tapeId,
                  event_type: eventType,
                  event_time: combinedEventTime,
                  timecode_start: '00:00:00',
                  timecode_end: null,
                  remarks: remarksVal,
                  cr_user: 'migration',
                  cr_date: parsedCrDate,
                  workunit: '000',
                  tape_counter_start: counterVal,
                  counter_format: 'HH:MM:SS'
                };
              })
              .filter(Boolean);

            if (vLogs.length > 0) {
              const { error: insertVLogErr } = await (supabase.from as any)("insp_video_logs").insert(vLogs);
              if (insertVLogErr) {
                logs.push(`WARNING: Inserting Diving Video Logs failed: ${insertVLogErr.message}`);
              } else {
                videoLogsCount += vLogs.length;
              }
            }
          }
        }

        logs.push(`Successfully migrated ${videoTapesCount} Video Tapes and ${videoLogsCount} Video Logs!`);
        report["VIDEO"].status = "success";
        report["VIDEO"].oracleRows = oracleVideoTapesCount;
        report["VIDEO"].migratedRows = videoTapesCount;

        // ---------------------------------------------------------------------
        // Phase 4: Migrate Inspection Records (insp_records)
        // ---------------------------------------------------------------------
        logs.push(`Phase 4: Migrating Inspection Records...`);
        const inspIdCache = new Map<number, number>();

        const oracleCompIdToQId = new Map<number, string>();
        try {
          const result = await oracleConn.execute(
            `SELECT COMP_ID, Q_ID FROM ALLCOMPID WHERE STR_ID = :strId`,
            { strId: structureId }
          );
          if (result.rows) {
            result.rows.forEach((row: any) => {
              const rObj = Array.isArray(row) ? { COMP_ID: row[0], Q_ID: row[1] } : row;
              const cId = Number(rObj.COMP_ID);
              const qId = rObj.Q_ID ? String(rObj.Q_ID).trim() : null;
              if (cId && qId) {
                oracleCompIdToQId.set(cId, qId);
              }
            });
          }
          logs.push(`Loaded ${oracleCompIdToQId.size} component ID to Q_ID mapping(s) from Oracle ALLCOMPID.`);
        } catch (err: any) {
          logs.push(`WARNING: Fetching Oracle ALLCOMPID for Q_ID mapping failed: ${err.message}`);
        }

        // Pre-populate compIdMap, qIdMap and compTypeCache from PostgreSQL if they are empty
        if (compIdMap.size === 0) {
          logs.push(`Pre-populating component ID cache from existing PostgreSQL structure_components...`);
          try {
            let page = 0;
            const pageSize = 1000;
            let hasMore = true;
            while (hasMore) {
              const { data: existingComps, error } = await supabase
                .from('structure_components')
                .select('id, comp_id, q_id, code')
                .eq('structure_id', resolvedStructureId)
                .range(page * pageSize, (page + 1) * pageSize - 1);
              
              if (error) throw error;
              
              if (!existingComps || existingComps.length === 0) {
                hasMore = false;
              } else {
                existingComps.forEach((comp: any) => {
                  const pgId = Number(comp.id);
                  if (comp.comp_id) {
                    compIdMap.set(Number(comp.comp_id), pgId);
                    compTypeCache.set(Number(comp.comp_id), String(comp.code || '').trim());
                  }
                  if (comp.q_id) {
                    qIdMap.set(String(comp.q_id).trim().toUpperCase(), pgId);
                  }
                });
                if (existingComps.length < pageSize) {
                  hasMore = false;
                } else {
                  page++;
                }
              }
            }
            logs.push(`Loaded ${compIdMap.size} component mapping(s) and ${qIdMap.size} Q_ID mapping(s) from PostgreSQL.`);
          } catch (err: any) {
            logs.push(`WARNING: Loading existing component mappings failed: ${err.message}`);
          }
        }

        // Fallback: If compIdMap is still empty, auto-migrate components from Oracle ALLCOMPID
        if (compIdMap.size === 0) {
          logs.push(`No PostgreSQL components found for structure ${resolvedStructureId}. Auto-migrating from Oracle ALLCOMPID...`);
          try {
            const allcompCols = await getOracleTableColumns(oracleConn, 'ALLCOMPID');
            if (allcompCols.size > 0 && allcompCols.has('COMP_ID')) {
              const acSelect = ['COMP_ID', 'CODE'];
              if (allcompCols.has('ID_NO')) acSelect.push('ID_NO');
              if (allcompCols.has('Q_ID')) acSelect.push('Q_ID');
              if (allcompCols.has('DEL')) acSelect.push('DEL');
              if (allcompCols.has('DESCRIPTION')) acSelect.push('DESCRIPTION');
              else if (allcompCols.has('DESCR')) acSelect.push('DESCR as DESCRIPTION');

              const acSelectPrefixed = acSelect.map(col => {
                const cleanCol = col.trim();
                if (cleanCol.toUpperCase().includes(' AS ')) {
                  const parts = cleanCol.split(/\s+as\s+/i);
                  return `c.${parts[0].trim()} as ${parts[1].trim()}`;
                }
                return `c.${cleanCol}`;
              });
              const acResult = await oracleConn.execute(
                `SELECT ${acSelectPrefixed.join(', ')} 
                 FROM ALLCOMPID c 
                 WHERE c.STR_ID = :strId
                   AND NOT (NVL(c.DEL, 0) = 1 AND NOT EXISTS (
                     SELECT 1 FROM allinspid i WHERE i.COMP_ID = c.COMP_ID AND i.STR_ID = c.STR_ID
                   ))`,
                { strId: structureId }
              );

              if (acResult.rows && (acResult.rows as any[]).length > 0) {
                const compsToInsert: any[] = [];
                for (const row of acResult.rows as any[]) {
                  const rObj = Array.isArray(row) ? acSelect.reduce((acc, col, idx) => {
                    const cleanColName = col.includes(' as ') ? col.split(' as ')[1].trim() : col;
                    acc[cleanColName] = row[idx];
                    return acc;
                  }, {} as Record<string, any>) : row;

                  const oracleCompId = Number(rObj.COMP_ID);
                  const code = String(rObj.CODE || '').trim();
                  const idNo = String(rObj.ID_NO || '').trim();
                  const desc = String(rObj.DESCRIPTION || '').trim();
                  const qId = rObj.Q_ID ? String(rObj.Q_ID).trim() : null;
                  if (!oracleCompId || !code) continue;

                  const isDeletedVal = rObj.DEL;
                  compsToInsert.push({
                    comp_id: oracleCompId,
                    structure_id: resolvedStructureId,
                    code: code,
                    id_no: idNo || null,
                    q_id: qId,
                    is_deleted: (isDeletedVal === 1 || String(isDeletedVal) === '1') ? true : false,
                    metadata: { auto_migrated: true, description: desc || null }
                  });
                }

                if (compsToInsert.length > 0) {
                  const { data: inserted, error: insErr } = await supabase
                    .from('structure_components')
                    .insert(compsToInsert)
                    .select('id, comp_id, q_id, code');

                  if (insErr) {
                    logs.push(`WARNING: Bulk auto-migrating components failed: ${insErr.message}. Trying one-by-one...`);
                    // Fallback: try inserting one-by-one to skip any individual failures
                    for (const comp of compsToInsert) {
                      const { data: singleIns, error: singleErr } = await supabase
                        .from('structure_components')
                        .insert(comp)
                        .select('id, comp_id, q_id, code')
                        .maybeSingle();
                      if (singleIns) {
                        const pgId = Number(singleIns.id);
                        const oracleCompId = Number(singleIns.comp_id);
                        compIdMap.set(oracleCompId, pgId);
                        compTypeCache.set(oracleCompId, String(singleIns.code || '').trim());
                        if (singleIns.q_id) {
                          qIdMap.set(String(singleIns.q_id).trim().toUpperCase(), pgId);
                        }
                      }
                    }
                    logs.push(`Individually inserted ${compIdMap.size} component(s).`);
                  } else if (inserted) {
                    inserted.forEach((comp: any) => {
                      const pgId = Number(comp.id);
                      const oracleCompId = Number(comp.comp_id);
                      compIdMap.set(oracleCompId, pgId);
                      compTypeCache.set(oracleCompId, String(comp.code || '').trim());
                      if (comp.q_id) {
                        qIdMap.set(String(comp.q_id).trim().toUpperCase(), pgId);
                      }
                    });
                    logs.push(`Auto-migrated ${inserted.length} component(s) from Oracle ALLCOMPID to PostgreSQL.`);
                  }
                }
              }
            }
          } catch (err: any) {
            logs.push(`WARNING: Auto-component migration failed: ${err.message}`);
          }
        }

        // Pre-fetch all inspection_type rows from Supabase to dynamically resolve type IDs
        const inspTypeMap = new Map<string, number>();
        try {
          const { data: inspTypesDb } = await supabase.from('inspection_type').select('id, code');
          inspTypesDb?.forEach((t: any) => {
            if (t.code) inspTypeMap.set(t.code.toUpperCase(), Number(t.id));
          });
        } catch (err: any) {
          logs.push(`WARNING: Pre-fetching inspection type IDs failed: ${err.message}`);
        }

        // Pre-fetch all COMP_NOT_INSP comments to map incomplete reasons
        const compNotInspMap = new Map<number, string>();
        const compNotInspCols = await getOracleTableColumns(oracleConn, 'COMP_NOT_INSP');
        if (compNotInspCols.size > 0 && compNotInspCols.has('INSP_ID')) {
          report["COMP_NOT_INSP"] = { status: "failed", oracleRows: 0, migratedRows: 0, errors: [] };
          try {
            let query = `
              SELECT INSP_ID, CMNTS FROM COMP_NOT_INSP
              WHERE INSP_ID IN (
                SELECT INSP_ID FROM PLATGI WHERE STR_ID = :strId AND INSP_ID IS NOT NULL
                UNION
                SELECT INSP_ID FROM allinspid WHERE STR_ID = :strId AND INSP_ID IS NOT NULL
              )
            `;
            const binds: any = { strId: structureId };
            
            if (selectedInspNo) {
              query = `
                SELECT INSP_ID, CMNTS FROM COMP_NOT_INSP
                WHERE INSP_ID IN (
                  SELECT INSP_ID FROM PLATGI WHERE STR_ID = :strId AND INSPNO = :inspNo AND INSP_ID IS NOT NULL
                  UNION
                  SELECT INSP_ID FROM allinspid WHERE STR_ID = :strId AND INSPNO = :inspNo AND INSP_ID IS NOT NULL
                )
              `;
              binds.inspNo = selectedInspNo;
            }
            
            const notInspRes = await oracleConn.execute(query, binds);
            if (notInspRes.rows) {
              report["COMP_NOT_INSP"].oracleRows = notInspRes.rows.length;
              for (const r of notInspRes.rows as any[]) {
                const rObj = Array.isArray(r) ? { INSP_ID: r[0], CMNTS: r[1] } : r;
                const oInspId = Number(rObj.INSP_ID);
                if (oInspId) {
                  compNotInspMap.set(oInspId, String(rObj.CMNTS || '').trim());
                }
              }
              report["COMP_NOT_INSP"].status = "success";
              logs.push(`Successfully loaded ${compNotInspMap.size} incomplete inspection reason records from 'COMP_NOT_INSP'.`);
            } else {
              report["COMP_NOT_INSP"].status = "success";
            }
          } catch (err: any) {
            logs.push(`WARNING: Fetching COMP_NOT_INSP comments failed: ${err.message}`);
            report["COMP_NOT_INSP"].errors.push(err.message);
          }
        }

        // Pre-fetch defect keys mapping from U_DEFECT
        const defectKeysSet = new Set<string>();
        const defectCols = await getOracleTableColumns(oracleConn, 'u_defect');
        if (defectCols.size > 0 && defectCols.has('STR_ID')) {
          try {
            const defectRes = await oracleConn.execute(`
              SELECT INSP_ID, COMP_ID FROM U_DEFECT WHERE STR_ID = :strId AND INSP_ID IS NOT NULL AND INSP_ID > 0
            `, { strId: structureId });
            if (defectRes.rows) {
              for (const r of defectRes.rows as any[]) {
                const rObj = Array.isArray(r) ? { INSP_ID: r[0], COMP_ID: r[1] } : r;
                const oInspId = Number(rObj.INSP_ID);
                const oCompId = Number(rObj.COMP_ID);
                if (oInspId && oCompId) {
                  defectKeysSet.add(`${oInspId}_${oCompId}`);
                }
              }
            }
          } catch (err: any) {
            logs.push(`WARNING: Pre-fetching defect keys failed: ${err.message}`);
          }
        }

        // Pre-fetch all CP additional readings from CPGRID
        const cpgridCache = new Map<string, { reading: number; location: string }[]>();
        try {
          const cpgridCols = await getOracleTableColumns(oracleConn, 'CPGRID');
          if (cpgridCols.size > 0 && cpgridCols.has('STR_ID')) {
            logs.push(`Pre-fetching all CP additional readings from 'CPGRID' for structure ID ${structureId}...`);
            const cpgridRes = await oracleConn.execute(`
              SELECT INSPNO, INSP_ID, REF_NAME, CP_VALUE FROM CPGRID WHERE STR_ID = :strId
            `, { strId: structureId });

            if (cpgridRes.rows) {
              for (const r of cpgridRes.rows as any[]) {
                const rObj = Array.isArray(r) ? {
                  INSPNO: r[0],
                  INSP_ID: r[1],
                  REF_NAME: r[2],
                  CP_VALUE: r[3]
                } : r;

                const inspNo = String(rObj.INSPNO || '').trim();
                const inspId = Number(rObj.INSP_ID);
                const refName = String(rObj.REF_NAME || '').trim();
                const cpVal = rObj.CP_VALUE !== null && rObj.CP_VALUE !== undefined ? Number(rObj.CP_VALUE) : null;

                if (inspNo && inspId && refName && cpVal !== null) {
                  const key = `${inspNo}_${inspId}`;
                  if (!cpgridCache.has(key)) {
                    cpgridCache.set(key, []);
                  }
                  // Auto-negate CP value
                  const negatedCp = cpVal > 0 ? -cpVal : cpVal;
                  cpgridCache.get(key)!.push({ reading: negatedCp, location: refName });
                }
              }
              logs.push(`Loaded ${cpgridCache.size} CP additional readings groups from CPGRID.`);
            }
          }
        } catch (err: any) {
          logs.push(`WARNING: Pre-fetching CPGRID failed: ${err.message}`);
        }

        // Pre-fetch all UT additional readings from WTGRID
        const wtgridCache = new Map<string, { reading: number; location: string }[]>();
        try {
          const wtgridCols = await getOracleTableColumns(oracleConn, 'WTGRID');
          if (wtgridCols.size > 0 && wtgridCols.has('STR_ID')) {
            logs.push(`Pre-fetching all UT additional readings from 'WTGRID' for structure ID ${structureId}...`);
            const wtgridRes = await oracleConn.execute(`
              SELECT INSPNO, INSP_ID, REF_NAME, POSITION, READ_THICK FROM WTGRID WHERE STR_ID = :strId
            `, { strId: structureId });

            if (wtgridRes.rows) {
              for (const r of wtgridRes.rows as any[]) {
                const rObj = Array.isArray(r) ? {
                  INSPNO: r[0],
                  INSP_ID: r[1],
                  REF_NAME: r[2],
                  POSITION: r[3],
                  READ_THICK: r[4]
                } : r;

                const inspNo = String(rObj.INSPNO || '').trim();
                const inspId = Number(rObj.INSP_ID);
                const refName = String(rObj.REF_NAME || '').trim();
                const position = String(rObj.POSITION || '').trim();
                const readThick = rObj.READ_THICK !== null && rObj.READ_THICK !== undefined ? Number(rObj.READ_THICK) : null;

                if (inspNo && inspId && readThick !== null) {
                  const key = `${inspNo}_${inspId}`;
                  if (!wtgridCache.has(key)) {
                    wtgridCache.set(key, []);
                  }
                  const location = [refName, position].filter(Boolean).join(' ');
                  wtgridCache.get(key)!.push({ reading: readThick, location });
                }
              }
              logs.push(`Loaded ${wtgridCache.size} UT additional readings groups from WTGRID.`);
            }
          }
        } catch (err: any) {
          logs.push(`WARNING: Pre-fetching WTGRID failed: ${err.message}`);
        }

        const migrateInspectionsForType = async (isRov: boolean) => {
          const reportKey = isRov ? "INSP_ROV" : "INSP_DIVING";
          report[reportKey] = { status: "failed", oracleRows: 0, migratedRows: 0, errors: [] };
          const typeStats: Record<string, { oracleRows: number; migratedRows: number; errors: string[] }> = {};

          let minSdX = 0, maxSdX = 1;
          let minSdY = 0, maxSdY = 1;
          let hasCoordinates = false;
          let structureName = '';
          let primaryInspections: any[] = [];
          let qCols: string[] = [];

          if (isRov) {
            if (platgiCols.size === 0 || !platgiCols.has('INSP_ID')) {
              logs.push(`No PLATGI table or INSP_ID column found for ROV. Skipping.`);
              report[reportKey].status = "skipped";
              return;
            }
            logs.push(`Fetching primary inspections from Oracle 'PLATGI' (ROV Platform)...`);

            const dateCol = platgiCols.has('INSP_DATE') ? 'INSP_DATE' : (platgiCols.has('I_DATE') ? 'I_DATE' : 'I_DATE');
            const timeCol = platgiCols.has('INSP_TIME') ? 'INSP_TIME' : (platgiCols.has('I_TIME') ? 'I_TIME' : 'I_TIME');

            qCols = ['INSP_ID', 'INSPNO', 'COMP_ID', dateCol, timeCol, 'TAPE_NO', 'DIVE_NO'];
            if (platgiCols.has('INSP_SCODE')) qCols.push('INSP_SCODE as INSP_TYPE');
            else if (platgiCols.has('INSP_TYPE')) qCols.push('INSP_TYPE');
            else if (platgiCols.has('CODE')) qCols.push('CODE as INSP_TYPE');
            
            if (platgiCols.has('ELEVATION')) qCols.push('ELEVATION');
            else if (platgiCols.has('ELV')) qCols.push('ELV as ELEVATION');
            
            if (platgiCols.has('KP')) qCols.push('KP');

            const extraPlatgiCols = [
              'NORTHING', 'EASTING', 'CP_RDG', 'DEBRIS', 'COMP_COND', 
              'COAT_COND', 'COUNTER_NO', 'COINTER_NO', 'CR_USER', 'COMMENTS', 
              'DESCRIPTION', 'DESCR', 'COMP_TYPE', 'MG_COND',
              'INSP_COND', 'INSPCOND', 'CMNTS', 'SD_XPOS', 'SD_YPOS'
            ];
            extraPlatgiCols.forEach(col => {
              if (platgiCols.has(col) && !qCols.includes(col)) {
                qCols.push(col);
              }
            });

            const whereCond = platgiCols.has('DESCRIPTION')
              ? "(DESCRIPTION IS NULL OR (DESCRIPTION != 'TAPE LOG' AND NOT (DESCRIPTION IN ('CP LOG', 'IMAGE LOG') AND (COMP_ID IS NULL OR COMP_ID = 0))))"
              : (platgiCols.has('DESCR') ? "(DESCR IS NULL OR (DESCR != 'TAPE LOG' AND NOT (DESCR IN ('CP LOG', 'IMAGE LOG') AND (COMP_ID IS NULL OR COMP_ID = 0))))" : "1=1");

            try {
              const result = await oracleConn.execute(`
                SELECT ${qCols.join(', ')} 
                FROM PLATGI 
                WHERE STR_ID = :strId AND ${whereCond} AND INSP_ID IS NOT NULL AND INSP_ID > 0
              `, { strId: structureId });
              primaryInspections = result.rows || [];
            } catch (err: any) {
              logs.push(`ERROR fetching ROV inspections: ${err.message}`);
              report[reportKey].errors.push(err.message);
              return;
            }

            // Query for eliminated CP LOG and IMAGE LOG records for logging/reporting
            try {
              const descColForElim = platgiCols.has('DESCRIPTION') ? 'DESCRIPTION' : (platgiCols.has('DESCR') ? 'DESCR' : null);
              const scodeColForElim = platgiCols.has('INSP_SCODE') ? 'INSP_SCODE' : (platgiCols.has('SCODE') ? 'SCODE' : (platgiCols.has('CODE') ? 'CODE' : null));
              
              if (descColForElim && scodeColForElim) {
                const elimResult = await oracleConn.execute(`
                  SELECT INSP_ID, INSPNO, COMP_ID, ${descColForElim} as LOG_DESC, ${scodeColForElim} as TYPE_CODE
                  FROM PLATGI
                  WHERE STR_ID = :strId AND INSP_ID IS NOT NULL AND INSP_ID > 0
                    AND ${descColForElim} IN ('CP LOG', 'IMAGE LOG')
                    AND (COMP_ID IS NULL OR COMP_ID = 0)
                `, { strId: structureId });
                
                if (elimResult.rows && elimResult.rows.length > 0) {
                  let filteredElimRows = elimResult.rows;
                  // If selectedInspNo is provided, filter by that
                  if (selectedInspNo) {
                    filteredElimRows = elimResult.rows.filter((row: any) => {
                      const val = String(row.INSPNO || row.inspno || row[1] || '').trim();
                      return val === selectedInspNo;
                    });
                  }
                  
                  if (filteredElimRows.length > 0) {
                    logs.push(`INFO: Found ${filteredElimRows.length} eliminated/skipped logs (CP LOG / IMAGE LOG with COMP_ID null or 0):`);
                    const countsByType: Record<string, number> = {};
                    filteredElimRows.forEach((row: any) => {
                      const typeCode = String(row.TYPE_CODE || row.type_code || row[4] || 'UNKNOWN').trim();
                      const desc = String(row.LOG_DESC || row.log_desc || row[3] || 'UNKNOWN').trim();
                      const inspId = row.INSP_ID || row.insp_id || row[0];
                      const compId = row.COMP_ID || row.comp_id || row[2];
                      countsByType[typeCode] = (countsByType[typeCode] || 0) + 1;
                      logs.push(` - Skipped Record: INSP_ID ${inspId}, Type: ${typeCode}, Desc: ${desc}, COMP_ID: ${compId}`);
                    });
                    
                    logs.push(`INFO: Summary of eliminated logs by Inspection Type:`);
                    Object.entries(countsByType).forEach(([type, count]) => {
                      logs.push(`   * Type ${type}: ${count} record(s) eliminated`);
                    });
                  }
                }
              }
            } catch (err: any) {
              logs.push(`Warning: Failed to query eliminated log list: ${err.message}`);
            }

            // Query platform title
            try {
              const { data: strData } = await (supabase.from as any)('platform')
                .select('title')
                .eq('id', resolvedStructureId)
                .maybeSingle();
              if (strData) {
                structureName = strData.title || '';
                logs.push(`Loaded platform name: "${structureName}" for ID ${resolvedStructureId}.`);
              }
            } catch (err: any) {
              logs.push(`Warning: Failed to fetch platform name: ${err.message}`);
            }

            // Query SD_XPOS and SD_YPOS bounds from Oracle
            if (platgiCols.has('SD_XPOS') && platgiCols.has('SD_YPOS')) {
              try {
                const coordsRes = await oracleConn.execute(
                  `SELECT MIN(SD_XPOS), MAX(SD_XPOS), MIN(SD_YPOS), MAX(SD_YPOS) 
                   FROM PLATGI 
                   WHERE STR_ID = :strId AND (SD_XPOS IS NOT NULL OR SD_YPOS IS NOT NULL)`,
                  { strId: structureId }
                );
                if (coordsRes.rows && coordsRes.rows.length > 0) {
                  const crow = coordsRes.rows[0];
                  const rMinX = crow[0] !== null && crow[0] !== undefined ? Number(crow[0]) : null;
                  const rMaxX = crow[1] !== null && crow[1] !== undefined ? Number(crow[1]) : null;
                  const rMinY = crow[2] !== null && crow[2] !== undefined ? Number(crow[2]) : null;
                  const rMaxY = crow[3] !== null && crow[3] !== undefined ? Number(crow[3]) : null;
                  
                  if (rMinX !== null && rMaxX !== null && rMinY !== null && rMaxY !== null && rMaxX > rMinX && rMaxY > rMinY) {
                    minSdX = rMinX;
                    maxSdX = rMaxX;
                    minSdY = rMinY;
                    maxSdY = rMaxY;
                    hasCoordinates = true;
                    logs.push(`Loaded SD_XPOS bounds [${minSdX}, ${maxSdX}] and SD_YPOS bounds [${minSdY}, ${maxSdY}] for structure ${structureId}.`);
                  }
                }
              } catch (err: any) {
                logs.push(`Warning: Failed to fetch SD_XPOS/SD_YPOS bounds from Oracle: ${err.message}`);
              }
            }
          } else {
            // Diving / Pipeline inspections from ALLINSPID
            const allinspidCols = await getOracleTableColumns(oracleConn, 'ALLINSPID');
            if (allinspidCols.size === 0 || !allinspidCols.has('INSP_ID')) {
              logs.push(`No ALLINSPID table or INSP_ID column found for Diving. Skipping.`);
              report[reportKey].status = "skipped";
              return;
            }
            logs.push(`Fetching primary inspections from Oracle 'ALLINSPID' (Diving / Pipeline)...`);

            qCols = ['INSP_ID', 'INSPNO', 'COMP_ID'];
            if (allinspidCols.has('INSP_DATE')) qCols.push('INSP_DATE');
            if (allinspidCols.has('INSP_TIME')) qCols.push('INSP_TIME');
            if (allinspidCols.has('TAPE_NO')) qCols.push('TAPE_NO');
            if (allinspidCols.has('DIVE_NO')) qCols.push('DIVE_NO');
            
            if (allinspidCols.has('INSP_TYPE')) qCols.push('INSP_TYPE');
            else if (allinspidCols.has('CODE')) qCols.push('CODE as INSP_TYPE');
            if (allinspidCols.has('ELEVATION')) qCols.push('ELEVATION');
            if (allinspidCols.has('KP')) qCols.push('KP');

            try {
              const result = await oracleConn.execute(`
                SELECT ${qCols.join(', ')} 
                FROM ALLINSPID 
                WHERE STR_ID = :strId AND INSP_ID IS NOT NULL AND INSP_ID > 0 AND INSP_TYPE IS NOT NULL
                  AND TRIM(UPPER(INSP_TYPE)) NOT IN ('PLATGI', 'LOGS', 'EXSUM', 'VIDEO')
              `, { strId: structureId });
              primaryInspections = result.rows || [];
            } catch (err: any) {
              logs.push(`ERROR fetching Diving inspections: ${err.message}`);
              report[reportKey].errors.push(err.message);
              return;
            }
          }

          // Filter by selectedInspNo if provided
          if (selectedInspNo && primaryInspections.length > 0) {
            const inspNoIdx = qCols.findIndex(c => c.toUpperCase() === 'INSPNO');
            primaryInspections = primaryInspections.filter(row => {
              const val = String(row.INSPNO || (Array.isArray(row) ? row[inspNoIdx] : '') || '').trim();
              return val === selectedInspNo;
            });
            logs.push(`Filtered primary inspections to ${primaryInspections.length} rows for INSPNO ${selectedInspNo}.`);
          }

          if (primaryInspections.length === 0) {
            logs.push(`No ${isRov ? 'ROV' : 'Diving'} primary inspection records found in Oracle.`);
            report[reportKey].status = "success";
            return;
          }

          report[reportKey].oracleRows = primaryInspections.length;

          // Fetch type-specific data for these inspection IDs
          const typeDataByInspId: Record<number, any> = {};

          if (isRov) {
            // ROV platform inspections reside in the PLATGI table
            const typeMappingKeys = Object.keys(mappings).filter(k => k.startsWith('INSP_ROV_'));
            if (typeMappingKeys.length > 0) {
              logs.push(`Extracting type-specific fields for ROV inspection records...`);
              for (const mapKey of typeMappingKeys) {
                const typeCode = mapKey.replace('INSP_ROV_', '');
                const fieldMappings = mappings[mapKey];
                if (!fieldMappings || fieldMappings.length === 0) continue;
                
                // Filter columns to only fetch those that exist in the Oracle PLATGI schema
                const oracleColsToFetch = Array.from(new Set(
                  fieldMappings
                    .map((m: any) => String(m.oracleCol).toUpperCase())
                    .filter((col: string) => platgiCols.has(col))
                ));
                if (!oracleColsToFetch.includes('INSP_ID')) {
                  oracleColsToFetch.push('INSP_ID');
                }
                
                try {
                  const binds: any = { strId: structureId, typeCode };
                  const scodeCol = platgiCols.has('INSP_SCODE') ? 'INSP_SCODE' : 'SCODE';
                  const query = `SELECT ${oracleColsToFetch.join(', ')} FROM PLATGI WHERE STR_ID = :strId AND ${scodeCol} = :typeCode AND INSP_ID IS NOT NULL`;
                  
                  const typeRes = await oracleConn.execute(query, binds);
                  if (typeRes.rows) {
                    for (const row of typeRes.rows as any[]) {
                      const inspIdIdx = oracleColsToFetch.indexOf('INSP_ID');
                      const inspId = Number(row.INSP_ID || (Array.isArray(row) ? row[inspIdIdx] : null));
                      if (!inspId) continue;
                      
                      const mappedData: any = {};
                      fieldMappings.forEach((m: any) => {
                        const colName = String(m.oracleCol).toUpperCase();
                        let val = null;
                        if (Array.isArray(row)) {
                          val = row[oracleColsToFetch.indexOf(colName)];
                        } else {
                          val = row[colName];
                        }
                        if (val !== undefined && val !== null) {
                          mappedData[m.pgCol] = val;
                        }
                      });
                      
                      typeDataByInspId[inspId] = {
                        ...(typeDataByInspId[inspId] || {}),
                        ...mappedData
                      };
                    }
                  }
                } catch (err: any) {
                  logs.push(`Warning: Failed to fetch type-specific data for ROV ${typeCode} (${err.message})`);
                }
              }
            }
          } else {
            // Diving inspections reside in different tables matching the Oracle INSP_TYPE code (e.g. SZONE, MGROW, etc.)
            const activeDivingTypes = Array.from(new Set(primaryInspections.map(row => {
              const rowObj: any = {};
              if (Array.isArray(row)) {
                qCols.forEach((col, idx) => {
                  const cleanColName = col.includes(' as ') ? col.split(' as ')[1].trim() : col;
                  rowObj[cleanColName] = row[idx];
                });
              } else {
                Object.assign(rowObj, row);
              }
              return String(rowObj.INSP_TYPE || '').trim().toUpperCase();
            }).filter(Boolean)));

            if (activeDivingTypes.length > 0) {
              logs.push(`Dynamically extracting all columns from Oracle diving inspection type tables: ${activeDivingTypes.join(', ')}...`);
              for (const typeCode of activeDivingTypes) {
                try {
                  // Verify that the table actually exists in Oracle
                  const typeCols = await getOracleTableColumns(oracleConn, typeCode);
                  if (typeCols.size === 0) {
                    logs.push(`Warning: Diving inspection type table ${typeCode} does not exist in Oracle. Skipping.`);
                    continue;
                  }

                  logs.push(`Querying all columns from Oracle diving table ${typeCode}...`);
                  const query = `SELECT * FROM ${typeCode} WHERE STR_ID = :strId AND INSP_ID IS NOT NULL`;
                  const typeRes = await oracleConn.execute(query, { strId: structureId });

                  if (typeRes.rows) {
                    const metaNames = typeRes.metaData.map((m: any) => m.name.toUpperCase());
                    for (const row of typeRes.rows as any[]) {
                      // Extract INSP_ID dynamically (handle both Array and Object row formats)
                      let inspIdVal = null;
                      if (Array.isArray(row)) {
                        const inspIdIdx = metaNames.indexOf('INSP_ID');
                        if (inspIdIdx !== -1) {
                          inspIdVal = row[inspIdIdx];
                        }
                      } else if (row && typeof row === 'object') {
                        inspIdVal = row.INSP_ID !== undefined ? row.INSP_ID : row.insp_id;
                      }

                      const inspId = Number(inspIdVal);
                      if (!inspId) continue;

                      const mappedData: any = {};
                      metaNames.forEach((colName: string, idx: number) => {
                        let val = null;
                        if (Array.isArray(row)) {
                          val = row[idx];
                        } else if (row && typeof row === 'object') {
                          val = row[colName] !== undefined ? row[colName] : row[colName.toLowerCase()];
                        }

                        if (val !== undefined && val !== null) {
                          const lowerColName = colName.toLowerCase();
                          mappedData[lowerColName] = val;
                          mappedData[colName] = val;
                          
                          // Auto-resolve specific common fields
                          if (colName === 'DIVE_NO') mappedData.dive_job_id = val;
                          if (colName === 'TAPE_NO') mappedData.tape_id = val;
                          
                          if (typeCode === 'NAVIG') {
                            if (colName === 'I_DATE') mappedData.inspection_date = val;
                            if (colName === 'TIME') mappedData.inspection_time = val;
                          } else {
                            if (colName === 'INSP_DATE') mappedData.inspection_date = val;
                            if (colName === 'INSP_TIME') mappedData.inspection_time = val;
                          }
                        }
                      });

                      // Apply custom mappings if configured in payload
                      const mapKey = Object.keys(mappings).find(k => {
                        const c = k.replace('INSP_DIVING_', '').replace('INSP_DIV_', '').toUpperCase();
                        return c === typeCode;
                      });
                      if (mapKey && mappings[mapKey]) {
                        mappings[mapKey].forEach((m: any) => {
                          const cName = String(m.oracleCol).toUpperCase();
                          let val = null;
                          if (Array.isArray(row)) {
                            const valIdx = metaNames.indexOf(cName);
                            if (valIdx > -1) {
                              val = row[valIdx];
                            }
                          } else if (row && typeof row === 'object') {
                            val = row[cName] !== undefined ? row[cName] : row[cName.toLowerCase()];
                          }

                          if (val !== undefined && val !== null) {
                            mappedData[m.pgCol] = val;
                          }
                        });
                      }

                      typeDataByInspId[inspId] = {
                        ...(typeDataByInspId[inspId] || {}),
                        ...mappedData
                      };
                    }
                  }
                } catch (err: any) {
                  logs.push(`Warning: Failed to fetch dynamic data for diving type ${typeCode} (${err.message})`);
                }
              }
            }
          }

          const recordsToInsert: any[] = [];

          // Helper to map a numeric percentage to the standard range bucket
          const mapPercentToRange = (val: number): string => {
            if (val <= 20) return "0-20%";
            if (val <= 40) return "20-40%";
            if (val <= 60) return "40-60%";
            if (val <= 80) return "60-80%";
            return "80-100%";
          };

          // Helper to map a "XX-YY%" range string directly to the standard bucket
          const mapRangeStringToBucket = (rangeStr: string): string | null => {
            const buckets = ["0-20%", "20-40%", "40-60%", "60-80%", "80-100%"];
            const normalized = rangeStr.replace(/\s/g, '');
            for (const b of buckets) {
              if (normalized === b.replace('%', '') || normalized === b) return b;
            }
            // If it's a single number with %, parse it
            const singleMatch = normalized.match(/^(\d+)%?$/);
            if (singleMatch) return mapPercentToRange(Number(singleMatch[1]));
            // If it's a range like "80-100", use the upper bound
            const rangeMatch = normalized.match(/^(\d+)-(\d+)%?$/);
            if (rangeMatch) return mapPercentToRange(Number(rangeMatch[2]));
            return null;
          };

          // Helper to split comments for marine growth
          const parseMarineGrowthFromComment = (comment: string) => {
            if (!comment) return {};
            const cleanComment = comment.trim();
            const lowerComment = cleanComment.toLowerCase();
            let softMg: string | null = null;
            let hardMg: string | null = null;

            // Pattern 1: Explicit separate values e.g. "Soft: 20%", "Hard: 10%", "Soft 15%", "Hard 25%"
            const softMatch = lowerComment.match(/soft\s*(?:marine\s*growth)?\s*:?\s*(\d+(?:-\d+)?)\s*%/i);
            const hardMatch = lowerComment.match(/hard\s*(?:marine\s*growth)?\s*:?\s*(\d+(?:-\d+)?)\s*%/i);

            if (softMatch) softMg = mapRangeStringToBucket(softMatch[1]) || null;
            if (hardMatch) hardMg = mapRangeStringToBucket(hardMatch[1]) || null;

            // Pattern 1b: Percentage followed by Hard/Soft e.g. "60% Hard", "80%H", "40% soft", "60%S"
            if (!hardMg) {
              const hardPctMatch = lowerComment.match(/(\d+(?:-\d+)?)\s*%\s*(?:hard|h)\b/i);
              if (hardPctMatch) hardMg = mapRangeStringToBucket(hardPctMatch[1]) || null;
            }
            if (!softMg) {
              const softPctMatch = lowerComment.match(/(\d+(?:-\d+)?)\s*%\s*(?:soft|s)\b/i);
              if (softPctMatch) softMg = mapRangeStringToBucket(softPctMatch[1]) || null;
            }

            // Pattern 2: Combined pattern e.g. "80-100% COVERAGE OF HARD AND SOFT GROWTH"
            // or "60-80% HARD AND SOFT MARINE GROWTH", "40% COVERAGE OF HARD & SOFT"
            if (!softMg && !hardMg) {
              const combinedMatch = lowerComment.match(/(\d+(?:-\d+)?)\s*%\s*(?:coverage\s+(?:of\s+)?)?(?:hard\s+(?:and|&)\s+soft|soft\s+(?:and|&)\s+hard)\s*(?:marine\s*)?(?:growth)?/i);
              if (combinedMatch) {
                const bucket = mapRangeStringToBucket(combinedMatch[1]);
                if (bucket) {
                  softMg = bucket;
                  hardMg = bucket;
                }
              }
            }

            // Pattern 3: Single marine growth mention e.g. "60-80% MARINE GROWTH" or "50% MG"
            if (!softMg && !hardMg) {
              const singleMgMatch = lowerComment.match(/(\d+(?:-\d+)?)\s*%\s*(?:coverage\s+(?:of\s+)?)?\s*(?:marine\s*growth|mg\b)/i);
              if (singleMgMatch) {
                const bucket = mapRangeStringToBucket(singleMgMatch[1]);
                if (bucket) {
                  // If no hard/soft specified, check if comment mentions which type
                  const hasHard = /hard/i.test(lowerComment);
                  const hasSoft = /soft/i.test(lowerComment);
                  if (hasHard && !hasSoft) hardMg = bucket;
                  else if (hasSoft && !hasHard) softMg = bucket;
                  else {
                    // Ambiguous or both — assign to both
                    softMg = bucket;
                    hardMg = bucket;
                  }
                }
              }
            }

            // Pattern 4: "All Over" or "100%" growth
            if (!softMg && !hardMg) {
              if (/all\s*over/i.test(lowerComment) && /(?:marine\s*)?growth|mg\b/i.test(lowerComment)) {
                softMg = "All Over";
                hardMg = "All Over";
              }
            }

            return { softMg, hardMg };
          };

          // Helper to parse MGI thickness clock position values from comments
          const parseMgiThicknessFromComment = (comment: string) => {
            const result: Record<string, number | null> = {
              mgi_hard_thickness_at_12: null,
              mgi_hard_thickness_at_3: null,
              mgi_hard_thickness_at_6: null,
              mgi_hard_thickness_at_9: null,
              mgi_soft_thickness_at_12: null,
              mgi_soft_thickness_at_3: null,
              mgi_soft_thickness_at_6: null,
              mgi_soft_thickness_at_9: null,
            };

            if (!comment) return result;

            const lowerComment = comment.toLowerCase();

            // Regexes for clock position keywords (longer alternatives first to avoid prefix issues)
            const clockRegex = /(?:at\s*|@\s*)?\b(12|3|6|9)\s*(?:o'clock|oclock|o\s*clock|o'clk|oclk|clock|clk|oc|o)\b/gi;

            const matches: Array<{ clockPos: number; startIndex: number; endIndex: number }> = [];
            let match;
            while ((match = clockRegex.exec(lowerComment)) !== null) {
              matches.push({
                clockPos: parseInt(match[1]),
                startIndex: match.index,
                endIndex: match.index + match[0].length
              });
            }

            if (matches.length === 0) {
              return result;
            }

            // Sort matches by start index
            matches.sort((a, b) => a.startIndex - b.startIndex);

            // Extract chunks
            for (let i = 0; i < matches.length; i++) {
              const current = matches[i];
              const next = matches[i + 1];
              
              // Chunk goes from the start of the current match to the start of the next match (or end of comment)
              const chunkStart = current.startIndex;
              const chunkEnd = next ? next.startIndex : lowerComment.length;
              const chunkText = lowerComment.substring(chunkStart, chunkEnd);

              // Find all thickness values like "5mm" or "5.5 mm" within this chunk
              const thicknessRegex = /(\d+(?:\.\d+)?)\s*mm\b/g;
              let thickMatch;
              while ((thickMatch = thicknessRegex.exec(chunkText)) !== null) {
                const val = parseFloat(thickMatch[1]);
                if (isNaN(val)) continue;

                // Check context in a window of 15 chars before and after the match within the chunk
                const thickIndexInChunk = thickMatch.index;
                const afterText = chunkText.substring(thickIndexInChunk + thickMatch[0].length, thickIndexInChunk + thickMatch[0].length + 15);
                const beforeText = chunkText.substring(Math.max(0, thickIndexInChunk - 15), thickIndexInChunk);

                if (afterText.includes("soft") || beforeText.includes("soft")) {
                  result[`mgi_soft_thickness_at_${current.clockPos}`] = val;
                } else {
                  result[`mgi_hard_thickness_at_${current.clockPos}`] = val;
                }
              }
            }

            return result;
          };

          // Helper to parse anode details from comments
          const parseAnodeDetails = (comment: string) => {
            if (!comment) return {};
            const cleanComment = comment.trim();
            const lowerComment = cleanComment.toLowerCase();

            let anodeType: any = null;
            let depletion: any = null;

            // Split comment by semicolon first (plain split to avoid Tailwind CSS regex static analysis bugs)
            const sections = cleanComment.split(';');

            // Construct regular expressions dynamically to shield them from Tailwind scanner
            const typeRegex = new RegExp("\\btype\\s*(?:-|:|\\s)?\\s*([a-g0-9]+)\\b", "i");
            const rangeRegex = new RegExp("(\\d+)\\s*-\\s*(\\d+)\\s*%");
            const pctRegex = new RegExp("(\\d+)\\s*%");

            for (const sec of sections) {
              const trimmedSec = sec.trim();
              const lowerSec = trimmedSec.toLowerCase();

              // 1. Parse Anode Type
              // If section mentions "anode" and we haven't found anodeType yet
              if (lowerSec.includes("anode") && !anodeType) {
                // Check if it has a pattern like "type-X" or "type X"
                const typeMatch = lowerSec.match(typeRegex);
                if (typeMatch) {
                  const code = typeMatch[1].toLowerCase().trim();
                  const candidates = [`type ${code}`, `anode type ${code}`, code];
                  for (const cand of candidates) {
                    if (anodeTypeLib.has(cand)) {
                      anodeType = anodeTypeLib.get(cand);
                      break;
                    }
                  }
                }

                // If we didn't find it by type match, maybe the word after "anode:" is in the library?
                if (!anodeType) {
                  const colonParts = trimmedSec.split(":");
                  if (colonParts.length > 1) {
                    const valPart = colonParts[1].replace(/[-]/g, " ").trim().toLowerCase();
                    const candidates = [valPart, valPart.split(/\s+/)[0]];
                    for (const cand of candidates) {
                      if (anodeTypeLib.has(cand)) {
                        anodeType = anodeTypeLib.get(cand);
                        break;
                      }
                    }
                  }
                }
              }

              // 2. Parse Depletion from section
              if ((lowerSec.includes("deplet") || lowerSec.includes("%")) && !depletion) {
                let category = "Bar";
                if (lowerSec.includes("bracelet")) category = "Bracelet";
                else if (lowerSec.includes("collar")) category = "Collar";
                else if (lowerSec.includes("sled")) category = "Sled";
                else if (lowerSec.includes("bar")) category = "Bar";

                const rangeMatch = lowerSec.match(rangeRegex);
                if (rangeMatch) {
                  const start = parseInt(rangeMatch[1]);
                  const end = parseInt(rangeMatch[2]);
                  depletion = `${category}: ${start} - ${end}% Depletion`;
                } else {
                  const pctMatch = lowerSec.match(pctRegex);
                  if (pctMatch) {
                    const pct = parseInt(pctMatch[1]);
                    if (pct >= 0 && pct <= 25) depletion = `${category}: 0 - 25% Depletion`;
                    else if (pct > 25 && pct <= 50) depletion = `${category}: 25 - 50% Depletion`;
                    else if (pct > 50 && pct <= 75) depletion = `${category}: 50 - 75% Depletion`;
                    else if (pct > 75 && pct <= 100) depletion = `${category}: 75 - 100% Depletion`;
                  } else if (lowerSec.includes("unable to estimate") || lowerSec.includes("unable to assess") || lowerSec.includes("cannot estimate")) {
                    depletion = `${category}: Unable to Estimate`;
                  }
                }
              }
            }

            // Fallback for anode type globally if not found in sections
            if (!anodeType) {
              const typeMatch = lowerComment.match(typeRegex);
              if (typeMatch) {
                const code = typeMatch[1].toLowerCase().trim();
                const candidates = [`type ${code}`, `anode type ${code}`, code];
                for (const cand of candidates) {
                  if (anodeTypeLib.has(cand)) {
                    anodeType = anodeTypeLib.get(cand);
                    break;
                  }
                }
              }
            }

            // Fallback for depletion globally if not found in sections
            if (!depletion) {
              let category = "Bar";
              if (lowerComment.includes("bracelet")) category = "Bracelet";
              else if (lowerComment.includes("collar")) category = "Collar";
              else if (lowerComment.includes("sled")) category = "Sled";
              else if (lowerComment.includes("bar")) category = "Bar";

              const rangeMatch = lowerComment.match(rangeRegex);
              if (rangeMatch) {
                const start = parseInt(rangeMatch[1]);
                const end = parseInt(rangeMatch[2]);
                depletion = `${category}: ${start} - ${end}% Depletion`;
              } else {
                const pctMatch = lowerComment.match(pctRegex);
                if (pctMatch) {
                  const pct = parseInt(pctMatch[1]);
                  if (pct >= 0 && pct <= 25) depletion = `${category}: 0 - 25% Depletion`;
                  else if (pct > 25 && pct <= 50) depletion = `${category}: 25 - 50% Depletion`;
                  else if (pct > 50 && pct <= 75) depletion = `${category}: 50 - 75% Depletion`;
                  else if (pct > 75 && pct <= 100) depletion = `${category}: 75 - 100% Depletion`;
                }
              }
            }

            return { depletion, anodeType };
          };

          // Helper to parse debris dimensions from comments
          const parseDebrisDimensions = (comment: string) => {
            if (!comment) return {
              length: null, lengthUnit: null,
              width: null, widthUnit: null,
              height: null, heightUnit: null,
              diameter: null, diameterUnit: null
            };
            const lowerComment = comment.toLowerCase();
            let length: number | null = null;
            let lengthUnit: string | null = null;
            let width: number | null = null;
            let widthUnit: string | null = null;
            let height: number | null = null;
            let heightUnit: string | null = null;
            let diameter: number | null = null;
            let diameterUnit: string | null = null;

            const parseNum = (str: string) => {
              const parsed = parseFloat(str);
              return isNaN(parsed) ? null : parsed;
            };

            const normalizeUnit = (u: string | null) => {
              if (!u) return null;
              u = u.trim().toLowerCase();
              if (u === 'in' || u === 'inch' || u === 'inches') return 'in';
              if (u === 'mm') return 'mm';
              if (u === 'm' || u === 'meter' || u === 'meters') return 'm';
              if (u === 'ft' || u === 'feet') return 'ft';
              return 'm';
            };

            const lengthMatch = lowerComment.match(/(\d+(?:\.\d+)?)\s*(m|mm|inch|in|ft|feet)?\s*(?:in\s+)?length/i);
            if (lengthMatch) {
              length = parseNum(lengthMatch[1]);
              lengthUnit = normalizeUnit(lengthMatch[2]) || 'm';
            }

            const widthMatch = lowerComment.match(/(\d+(?:\.\d+)?)\s*(m|mm|inch|in|ft|feet)?\s*width/i);
            if (widthMatch) {
              width = parseNum(widthMatch[1]);
              widthUnit = normalizeUnit(widthMatch[2]) || 'm';
            }

            const heightMatch = lowerComment.match(/(\d+(?:\.\d+)?)\s*(m|mm|inch|in|ft|feet)?\s*(?:in\s+)?(?:height|high\b)/i);
            if (heightMatch) {
              height = parseNum(heightMatch[1]);
              heightUnit = normalizeUnit(heightMatch[2]) || 'm';
            }

            const diaMatch = lowerComment.match(/(\d+(?:\.\d+)?)\s*(m|mm|inch|inches|in|ft|feet)?\s*(?:in\s+)?(?:diameter|dia\b)/i);
            if (diaMatch) {
              diameter = parseNum(diaMatch[1]);
              diameterUnit = normalizeUnit(diaMatch[2]) || 'm';
            }

            if (!length && !width) {
              const crossMatch = lowerComment.match(/(\d+(?:\.\d+)?)\s*(m|mm|in|ft)?\s*[x×]\s*(\d+(?:\.\d+)?)\s*(m|mm|in|ft)?/i);
              if (crossMatch) {
                length = parseNum(crossMatch[1]);
                width = parseNum(crossMatch[3]);
                
                const u2 = normalizeUnit(crossMatch[4]);
                const u1 = normalizeUnit(crossMatch[2]);
                
                lengthUnit = u1 || u2 || 'm';
                widthUnit = u2 || u1 || 'm';
              }
            }

            return {
              length, lengthUnit: length ? (lengthUnit || 'm') : null,
              width, widthUnit: width ? (widthUnit || 'm') : null,
              height, heightUnit: height ? (heightUnit || 'm') : null,
              diameter, diameterUnit: diameter ? (diameterUnit || 'm') : null
            };
          };

          // Helper to predict material type based on comment keywords
          const predictMaterialFromComment = (comment: string): string => {
            if (!comment) return 'Unknown';
            const lower = comment.toLowerCase();
            if (lower.includes('non-metallic') || lower.includes('non metallic')) return 'Non-Metallic';
            if (lower.includes('metallic') || lower.includes('metal')) return 'Metallic';

            const metallicKeywords = [
              'scaffold', 'pole', 'drum', 'bar', 'rail', 'strip', 'iron', 'steel', 
              'chain', 'shackle', 'bolt', 'pipe', 'plate', 'aluminum', 'copper', 
              'zinc', 'anode', 'bracket', 'clamp', 'structural'
            ];
            if (metallicKeywords.some(kw => lower.includes(kw))) {
              return 'Metallic';
            }

            const nonMetallicKeywords = [
              'rubber', 'hose', 'rope', 'fishing', 'net', 'plastic', 'nylon', 
              'wood', 'timber', 'concrete', 'sandbag', 'grout', 'bag', 'cloth', 
              'textile', 'sling', 'tyre', 'tire', 'synthetic', 'fiber'
            ];
            if (nonMetallicKeywords.some(kw => lower.includes(kw))) {
              return 'Non-Metallic';
            }

            return 'Unknown';
          };

          // Helper to clean out coordinates and dimensions and extract clean debris description
          const extractDebrisDesc = (comment: string) => {
            if (!comment) return '';
            let clean = comment.replace(/\r\n/g, ' ').replace(/\n/g, ' ');
            
            clean = clean.replace(/approx(?:imate(?:ly)?)?\b\.?\s*\d+\s*m\s*from\s*(?:leg\s*)?[a-z]\d+/gi, '');
            clean = clean.replace(/approx(?:imate(?:ly)?)?\b\.?\s*\d+\s*m\s*from\s*[^,;.\n]*/gi, '');
            
            clean = clean.replace(/(?:approx(?:imate(?:ly)?)?\b\.?\s*)?\d+(?:\.\d+)?\s*(?:m|mm|inch|inches|in|ft|feet)?\s*(?:in\s+)?(?:diameter|dia\b)/gi, '');
            clean = clean.replace(/(?:approx(?:imate(?:ly)?)?\b\.?\s*)?\d+(?:\.\d+)?\s*(?:m|mm|inch|in|ft|feet)?\s*(?:in\s+)?width/gi, '');
            clean = clean.replace(/(?:approx(?:imate(?:ly)?)?\b\.?\s*)?\d+(?:\.\d+)?\s*(?:m|mm|inch|in|ft|feet)?\s*(?:in\s+)?length/gi, '');
            clean = clean.replace(/(?:approx(?:imate(?:ly)?)?\b\.?\s*)?\d+(?:\.\d+)?\s*(?:m|mm|inch|in|ft|feet)?\s*(?:in\s+)?(?:height|high\b)/gi, '');
            clean = clean.replace(/\d+(?:\.\d+)?\s*(?:m|mm|in|ft)?\s*[x×]\s*\d+(?:\.\d+)?\s*(?:m|mm|in|ft)?/gi, '');
            
            clean = clean.replace(/\bapprox(?:imate(?:ly)?)?\b\.?/gi, '');
            clean = clean.replace(/\b(?:in\s+)?length\b/gi, '');
            clean = clean.replace(/\b(?:in\s+)?width\b/gi, '');
            clean = clean.replace(/\b(?:in\s+)?(?:height|high\b)\b/gi, '');
            clean = clean.replace(/\b(?:in\s+)?diameter\b/gi, '');
            clean = clean.replace(/\bx\b/gi, '');
            clean = clean.replace(/\bin\b/gi, '');
            
            clean = clean.replace(/[,;.:\-\r\n\t()]/g, ' ');
            clean = clean.replace(/\s+/g, ' ').trim();
            
            if (clean.length > 0) {
              clean = clean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
            }
            return clean;
          };

          // Helper to calculate Seabed Survey spatial properties from x/y normalized coordinates
          const calculateSeabedGeometry = (x: number, y: number, structureName: string) => {
            const legCount = structureName.includes('8') ? 8 : 4;
            const padding = 80;
            const VIEW_SIZE = 600;
            const CENTER = VIEW_SIZE / 2;
            const innerSize = VIEW_SIZE - (padding * 2);

            let rows = 2;
            let cols = 2;
            if (legCount === 8) { rows = 2; cols = 4; }

            const dx = innerSize / (cols - 1 || 1) * 0.4;
            const dy = innerSize / (rows - 1 || 1) * 0.4;

            const legPositions: { x: number; y: number; name: string }[] = [];
            for (let r = 0; r < rows; r++) {
              for (let c = 0; c < cols; c++) {
                const rowName = String.fromCharCode(65 + r);
                legPositions.push({
                  x: CENTER + (c - (cols - 1) / 2) * dx,
                  y: CENTER + (r - (rows - 1) / 2) * dy,
                  name: `${rowName}${c + 1}`
                });
              }
            }

            const minX = Math.min(...legPositions.map(p => p.x));
            const minY = Math.min(...legPositions.map(p => p.y));
            const maxX = Math.max(...legPositions.map(p => p.x));
            const maxY = Math.max(...legPositions.map(p => p.y));

            const maxDistValue = 21;
            const distanceOffset = 0;
            const availableX = (VIEW_SIZE - (maxX - minX)) / 2 - 20;
            const availableY = (VIEW_SIZE - (maxY - minY)) / 2 - 20;
            const minAvailable = Math.min(availableX, availableY);
            const pxPerMeter = minAvailable / maxDistValue;

            const toScreen = (v: number) => (v / 100) * VIEW_SIZE;
            const screenX = toScreen(x);
            const screenY = toScreen(y);

            let dxBorder = 0;
            if (screenX < minX) dxBorder = minX - screenX;
            else if (screenX > maxX) dxBorder = screenX - maxX;

            let dyBorder = 0;
            if (screenY < minY) dyBorder = minY - screenY;
            else if (screenY > maxY) dyBorder = screenY - maxY;

            const visualDist = Math.max(dxBorder, dyBorder) / pxPerMeter;
            const logicalDist = visualDist + distanceOffset;

            const dxCenter = screenX - CENTER;
            const dyCenter = screenY - CENTER;

            let angle = Math.atan2(dxCenter, -dyCenter) * (180 / Math.PI);
            if (angle < 0) angle += 360;

            let face = 'Unknown';
            let startLeg = '';
            let endLeg = '';

            const tl = 'A1';
            const tr = `A${cols}`;
            const bl = `${String.fromCharCode(64 + rows)}1`;
            const br = `${String.fromCharCode(64 + rows)}${cols}`;

            if (angle >= 315 || angle < 45) { face = 'NORTH'; startLeg = tl; endLeg = tr; }
            else if (angle >= 45 && angle < 135) { face = 'EAST'; startLeg = tr; endLeg = br; }
            else if (angle >= 135 && angle < 225) { face = 'SOUTH'; startLeg = bl; endLeg = br; }
            else { face = 'WEST'; startLeg = tl; endLeg = bl; }

            let nearestLeg = startLeg;
            let distToNearestLeg = 0;

            const startPos = legPositions.find(p => p.name === startLeg);
            const endPos = legPositions.find(p => p.name === endLeg);

            if (startPos && endPos) {
              const dStart = Math.sqrt(Math.pow(screenX - startPos.x, 2) + Math.pow(screenY - startPos.y, 2));
              const dEnd = Math.sqrt(Math.pow(screenX - endPos.x, 2) + Math.pow(screenY - endPos.y, 2));

              if (dStart < dEnd) {
                nearestLeg = startLeg;
                distToNearestLeg = dStart / pxPerMeter;
              } else {
                nearestLeg = endLeg;
                distToNearestLeg = dEnd / pxPerMeter;
              }
            }

            return {
              distance: logicalDist,
              nearestLeg,
              distToNearestLeg,
              face
            };
          };

          const inspIdIdx = qCols.findIndex(c => c.toUpperCase() === 'INSP_ID');
          const inspnoIdx = qCols.findIndex(c => c.toUpperCase() === 'INSPNO');
          const compIdIdx = qCols.findIndex(c => c.toUpperCase() === 'COMP_ID');
          const dateIdx = qCols.findIndex(c => ['INSP_DATE', 'I_DATE', 'LOG_DATE'].includes(c.toUpperCase()));
          const timeIdx = qCols.findIndex(c => ['INSP_TIME', 'I_TIME', 'LOG_TIME'].includes(c.toUpperCase()));
          const tapeNoIdx = qCols.findIndex(c => c.toUpperCase() === 'TAPE_NO');
          const diveNoIdx = qCols.findIndex(c => c.toUpperCase() === 'DIVE_NO');
          const typeIdx = qCols.findIndex(c => c.toUpperCase() === 'INSP_TYPE');
          const elvIdx = qCols.findIndex(c => ['ELEVATION', 'ELV'].includes(c.toUpperCase()));
          const kpIdx = qCols.findIndex(c => c.toUpperCase() === 'KP');

          for (const row of primaryInspections) {
            const rowObj: any = {};
            if (Array.isArray(row)) {
              qCols.forEach((col, idx) => {
                const cleanColName = col.includes(' as ') ? col.split(' as ')[1].trim() : col;
                rowObj[cleanColName] = row[idx];
              });
            } else {
              Object.assign(rowObj, row);
            }

            const legacyInspId = Number(rowObj.INSP_ID || rowObj[qCols[inspIdIdx]]);
            const legacyInspNo = String(rowObj.INSPNO || rowObj[qCols[inspnoIdx]] || "").trim();
            const legacyCompId = Number(rowObj.COMP_ID || rowObj[qCols[compIdIdx]]);

            // Extract type specific data early
            const mappedTypeData = typeDataByInspId[legacyInspId] || {};

            const getValidStrVal = (...vals: any[]) => {
              for (const val of vals) {
                if (val !== undefined && val !== null) {
                  const str = String(val).trim();
                  const lower = str.toLowerCase();
                  if (str !== "" && lower !== "0" && lower !== "null" && lower !== "undefined" && lower !== "none") {
                    return str;
                  }
                }
              }
              return "";
            };

            const legacyTapeNo = getValidStrVal(
              mappedTypeData.tape_id,
              mappedTypeData.TAPE_NO,
              mappedTypeData.tapeNo,
              mappedTypeData.TAPENO,
              rowObj.TAPE_NO,
              tapeNoIdx > -1 ? rowObj[qCols[tapeNoIdx]] : null
            );

            let legacyDiveNo = getValidStrVal(
              mappedTypeData.dive_job_id,
              mappedTypeData.rov_job_id,
              mappedTypeData.DIVE_NO,
              mappedTypeData.dive_no,
              mappedTypeData.DIVE_JOB_ID,
              mappedTypeData.diveNo,
              mappedTypeData.DIVENO,
              rowObj.DIVE_NO,
              diveNoIdx > -1 ? rowObj[qCols[diveNoIdx]] : null
            );

            if (!legacyDiveNo) {
              const upperTape = legacyTapeNo.toUpperCase();
              const upperInsp = legacyInspNo.toUpperCase();
              if (legacyTapeNo && tapeToDiveMap.has(upperTape)) {
                legacyDiveNo = tapeToDiveMap.get(upperTape)!;
              } else if (legacyInspNo && inspNoToDiveMap.has(upperInsp)) {
                legacyDiveNo = inspNoToDiveMap.get(upperInsp)!;
              }
            }

            if (!legacyDiveNo) {
              if (!isRov) {
                // For Diving, if no dive number is resolved, fallback to a default dive log group
                legacyDiveNo = `DEFAULT-${legacyInspNo || 'JOB'}-DIV`;
              } else {
                continue;
              }
            }

            const legacyInspType = String(rowObj.INSP_TYPE || (typeIdx > -1 ? rowObj[qCols[typeIdx]] : "") || "").trim();
            const typCode = legacyInspType.toUpperCase().trim() || 'UNKNOWN';

            if (!typeStats[typCode]) {
              typeStats[typCode] = { oracleRows: 0, migratedRows: 0, errors: [] };
            }
            typeStats[typCode].oracleRows++;

             let pgCompId = compIdMap.get(legacyCompId);
             if (!pgCompId && legacyCompId) {
               const legacyQId = oracleCompIdToQId.get(legacyCompId);
               if (legacyQId) {
                 pgCompId = qIdMap.get(legacyQId.toUpperCase()) || undefined;
                 if (pgCompId) {
                   logs.push(`Healed component mapping for COMP_ID ${legacyCompId}: matched by Q_ID "${legacyQId}" to Postgres ID ${pgCompId}.`);
                   compIdMap.set(legacyCompId, pgCompId);
                   if (!compTypeCache.has(legacyCompId)) {
                     compTypeCache.set(legacyCompId, compTypeCache.get(pgCompId) || '');
                   }
                   
                   // Heal permanently in PostgreSQL structure_components
                   supabase.from('structure_components')
                     .update({ comp_id: legacyCompId })
                     .eq('id', pgCompId)
                     .then(({ error }) => {
                       if (error) {
                         console.error(`Failed to permanently heal comp_id ${legacyCompId} in Supabase:`, error.message);
                       }
                     });
                 }
               }
             }

             if (!pgCompId) {
               if (legacyCompId === 0 || !legacyCompId) {
                 // For calibrations or general inspections without a component, fallback to the first structural component to satisfy NOT NULL foreign key constraints
                 pgCompId = compIdMap.values().next().value || null;
               }
               if (!pgCompId) {
                 typeStats[typCode].errors.push(`Skipped record ${legacyInspId}: Component ID ${legacyCompId} not found in PostgreSQL structure_components`);
                 continue;
               }
             }

            const pgJpId = jpIdMap.get(legacyInspNo) || null;

            const jobKey = `${legacyInspNo}_${legacyDiveNo}`;
            let rovJobId = isRov ? (rovJobsCache.get(jobKey) || null) : null;
            let diveJobId = !isRov ? (diveJobsCache.get(jobKey) || null) : null;

            // Get or create fallback job if missing and constraint requires it
            if (isRov && !rovJobId && legacyDiveNo) {
              const { data: fallbackJob } = await (supabase.from as any)("insp_rov_jobs")
                .insert({
                  deployment_no: legacyDiveNo,
                  structure_id: resolvedStructureId,
                  jobpack_id: pgJpId || null,
                  sow_report_no: jobpackDefaultPrefixMap.get(legacyInspNo) || null,
                  rov_serial_no: 'ROV-01',
                  rov_operator: 'FALLBACK',
                  rov_supervisor: 'FALLBACK',
                  report_coordinator: 'FALLBACK',
                  deployment_date: formatLocalDateOnly(new Date()),
                  start_time: '00:00:00',
                  end_time: '00:00:00',
                  status: 'COMPLETED',
                  additional_info: { is_fallback: true, original_dive_no: legacyDiveNo },
                  cr_user: 'migration',
                  workunit: '000'
                })
                .select("rov_job_id")
                .single();
              if (fallbackJob) {
                rovJobId = Number(fallbackJob.rov_job_id);
                rovJobsCache.set(jobKey, rovJobId);
              }
            } else if (!isRov && !diveJobId && legacyDiveNo) {
              const { data: fallbackJob } = await (supabase.from as any)("insp_dive_jobs")
                .insert({
                  dive_no: legacyDiveNo,
                  structure_id: resolvedStructureId,
                  jobpack_id: pgJpId || null,
                  sow_report_no: jobpackDefaultPrefixMap.get(legacyInspNo) || null,
                  dive_type: 'AIR',
                  diver_name: 'FALLBACK',
                  dive_supervisor: 'FALLBACK',
                  report_coordinator: 'FALLBACK',
                  dive_date: formatLocalDateOnly(new Date()),
                  start_time: '00:00:00',
                  end_time: '00:00:00',
                  status: 'COMPLETED',
                  additional_info: { is_fallback: true, original_dive_no: legacyDiveNo },
                  cr_user: 'migration',
                })
                .select("dive_job_id")
                .single();
              if (fallbackJob) {
                diveJobId = Number(fallbackJob.dive_job_id);
                diveJobsCache.set(jobKey, diveJobId);
              }
            }

            // If we still don't have a diveJobId (for Diving) or rovJobId (for ROV), resolve to a structure-level default fallback job!
            if (!isRov && !diveJobId) {
              const defaultJobKey = `${legacyInspNo}_DEFAULT_DIV`;
              diveJobId = diveJobsCache.get(defaultJobKey) || null;
              if (!diveJobId) {
                // Check if a default dive job already exists in Postgres
                const defaultDiveNo = `DEFAULT-${legacyInspNo || 'JOB'}-DIV`;
                const { data: existingDefault } = await (supabase.from as any)("insp_dive_jobs")
                  .select("dive_job_id")
                  .eq("dive_no", defaultDiveNo)
                  .maybeSingle();
                
                if (existingDefault) {
                  diveJobId = Number(existingDefault.dive_job_id);
                  diveJobsCache.set(defaultJobKey, diveJobId);
                } else {
                  // Create a default dive job in Postgres
                  const { data: newDefault, error: defErr } = await (supabase.from as any)("insp_dive_jobs")
                    .insert({
                      dive_no: defaultDiveNo,
                      structure_id: resolvedStructureId,
                      jobpack_id: pgJpId || null,
                      sow_report_no: jobpackDefaultPrefixMap.get(legacyInspNo) || null,
                      dive_type: 'AIR',
                      diver_name: 'DEFAULT FALLBACK',
                      dive_supervisor: 'DEFAULT FALLBACK',
                      report_coordinator: 'DEFAULT FALLBACK',
                      dive_date: formatLocalDateOnly(new Date()),
                      start_time: '00:00:00',
                      end_time: '00:00:00',
                      status: 'COMPLETED',
                      additional_info: { is_default_fallback: true },
                      cr_user: 'migration',
                    })
                    .select("dive_job_id")
                    .single();
                  
                  if (newDefault) {
                    diveJobId = Number(newDefault.dive_job_id);
                    diveJobsCache.set(defaultJobKey, diveJobId);
                    logs.push(`Created structure-level default fallback Diving Job ID: ${diveJobId}`);
                  } else {
                    logs.push(`WARNING: Failed to create default fallback Diving Job: ${defErr?.message}`);
                  }
                }
              }
            } else if (isRov && !rovJobId) {
              const defaultJobKey = `${legacyInspNo}_DEFAULT_ROV`;
              rovJobId = rovJobsCache.get(defaultJobKey) || null;
              if (!rovJobId) {
                const defaultDeploymentNo = `DEFAULT-${legacyInspNo || 'JOB'}-ROV`;
                const { data: existingDefault } = await (supabase.from as any)("insp_rov_jobs")
                  .select("rov_job_id")
                  .eq("deployment_no", defaultDeploymentNo)
                  .maybeSingle();
                
                if (existingDefault) {
                  rovJobId = Number(existingDefault.rov_job_id);
                  rovJobsCache.set(defaultJobKey, rovJobId);
                } else {
                  const { data: newDefault, error: defErr } = await (supabase.from as any)("insp_rov_jobs")
                    .insert({
                      deployment_no: defaultDeploymentNo,
                      structure_id: resolvedStructureId,
                      jobpack_id: pgJpId || null,
                      sow_report_no: jobpackDefaultPrefixMap.get(legacyInspNo) || null,
                      rov_serial_no: 'ROV-01',
                      rov_operator: 'DEFAULT FALLBACK',
                      rov_supervisor: 'DEFAULT FALLBACK',
                      report_coordinator: 'DEFAULT FALLBACK',
                      deployment_date: formatLocalDateOnly(new Date()),
                      start_time: '00:00:00',
                      end_time: '00:00:00',
                      status: 'COMPLETED',
                      additional_info: { is_default_fallback: true },
                      cr_user: 'migration',
                      workunit: '000'
                    })
                    .select("rov_job_id")
                    .single();
                  
                  if (newDefault) {
                    rovJobId = Number(newDefault.rov_job_id);
                    rovJobsCache.set(defaultJobKey, rovJobId);
                    logs.push(`Created structure-level default fallback ROV Job ID: ${rovJobId}`);
                  } else {
                    logs.push(`WARNING: Failed to create default fallback ROV Job: ${defErr?.message}`);
                  }
                }
              }
            }

            const tapeKey = `${isRov ? 'ROV' : 'DIV'}_${legacyTapeNo}_${legacyDiveNo}_${legacyInspNo}`;
            const pgTapeId = tapesCache.get(tapeKey) || tapesCache.get(`${isRov ? 'ROV' : 'DIV'}_${legacyTapeNo}_${legacyDiveNo}`) || null;



            const sowReportNo = getSowReportNo(legacyInspNo, legacyCompId, typCode.toUpperCase());

            const rowDateVal = rowObj.INSP_DATE || rowObj.I_DATE || rowObj.i_date || rowObj.I_Date || rowObj.LOG_DATE || mappedTypeData.inspection_date || mappedTypeData.INSP_DATE || mappedTypeData.I_DATE || mappedTypeData.i_date || mappedTypeData.I_Date;
            const rowTimeVal = rowObj.INSP_TIME || rowObj.I_TIME || rowObj.i_time || rowObj.I_Time || rowObj.TIME || rowObj.time || rowObj.LOG_TIME || mappedTypeData.inspection_time || mappedTypeData.INSP_TIME || mappedTypeData.I_TIME || mappedTypeData.i_time || mappedTypeData.TIME || mappedTypeData.time;
            const dateStr = combineDateTime(rowDateVal, rowTimeVal);
            const timeStr = formatTimeOnly(rowTimeVal);

            const compCode = compTypeCache.get(legacyCompId) || '';

            // Extract comment observations for marine growth and anode parsing
            // Try multiple source fields: COMMENTS, DESCRIPTION, MG_COND, and for diving: INSP_COND
            const commentsText = String(rowObj.COMMENTS || rowObj.CMNTS || '').trim();
            const descriptionText = String(rowObj.DESCRIPTION || rowObj.DESCR || '').trim();
            const mgCondText = String(rowObj.MG_COND || rowObj.mg_cond || '').trim();
            const inspCondText = String(rowObj.INSP_COND || rowObj.INSPCOND || '').trim();

             // Combine all text sources for marine growth parsing
            const allTextForMgParsing = [commentsText, descriptionText, mgCondText, inspCondText].filter(Boolean).join(' ; ');
            const mgDetails = parseMarineGrowthFromComment(allTextForMgParsing);
            const mgiThicknessDetails = parseMgiThicknessFromComment(allTextForMgParsing);
            const anodeDetails = parseAnodeDetails(commentsText);

            // Merge details into mappedTypeData (these will flow through combinedData)
            if (mgDetails.softMg) mappedTypeData.marine_growth_soft = mgDetails.softMg;
            if (mgDetails.hardMg) mappedTypeData.marine_growth_hard = mgDetails.hardMg;
            Object.entries(mgiThicknessDetails).forEach(([k, v]) => {
              if (v !== null) {
                mappedTypeData[k] = v;
              }
            });
            if (anodeDetails.depletion) {
              mappedTypeData.depletion = anodeDetails.depletion;
              mappedTypeData.anode_depletion = anodeDetails.depletion;
            }
            if (anodeDetails.anodeType) mappedTypeData.anode_type = anodeDetails.anodeType;

            const incompleteReason = compNotInspMap.get(legacyInspId) || null;
            const hasAnomaly = defectKeysSet.has(`${legacyInspId}_${legacyCompId}`);

            const getCounterNoVal = () => {
              if (!isRov) return null;
              const val = rowObj.COUNTER_NO !== undefined && rowObj.COUNTER_NO !== null ? rowObj.COUNTER_NO : rowObj.COINTER_NO;
              if (val === undefined || val === null) return null;
              
              const strVal = String(val).trim();
              if (!strVal) return null;

              if (strVal.includes(':')) {
                const parts = strVal.split(':');
                if (parts.length === 3) {
                  return String(Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]));
                } else if (parts.length === 2) {
                  return String(Number(parts[0]) * 60 + Number(parts[1]));
                }
              }

              const numVal = parseInt(strVal);
              if (isNaN(numVal)) return null;

              const sec = numVal % 100;
              const min = Math.floor((numVal % 10000) / 100);
              const hrs = Math.floor(numVal / 10000);

              const totalSeconds = hrs * 3600 + min * 60 + sec;
              return String(totalSeconds);
            };

            const elevationRaw = rowObj.ELEVATION || rowObj.ELV || (elvIdx > -1 ? rowObj[qCols[elvIdx]] : null) || mappedTypeData.elevation || mappedTypeData.ELEVATION;
            const elevationVal = elevationRaw !== undefined && elevationRaw !== null ? Number(elevationRaw) : null;

            const kpRaw = rowObj.KP || (kpIdx > -1 ? rowObj[qCols[kpIdx]] : null) || mappedTypeData.fp_kp || mappedTypeData.KP;
            const kpVal = kpRaw !== undefined && kpRaw !== null ? String(kpRaw).trim() : null;

            const combinedData: any = {
              ...rowObj,
              ...mappedTypeData
            };

            const inspectionDataObj: any = {
              inspno: legacyInspNo,
              str_id: String(structureId),
              comp_id: String(legacyCompId),
              insp_id: String(legacyInspId)
            };

            Object.keys(combinedData).forEach(k => {
              let val = combinedData[k];
              // Perform case normalization based on Postgres u_lib_list descriptions
              if (isRov && typeof val === 'string') {
                const trimmedLower = val.toLowerCase().trim();
                if (libDescMap.has(trimmedLower)) {
                  val = libDescMap.get(trimmedLower);
                }
              }
              inspectionDataObj[k] = val;
              inspectionDataObj[k.toLowerCase()] = val;
            });

            // Copy Oracle observation text to Postgres findings field
            // ROV inspections: use COMMENTS field from PLATGI table
            // Diving inspections: use INSP_COND field from type-specific tables
            // This MUST happen AFTER the combinedData loop above so the findings value is not overwritten
            let findingsVal = '';
            if (isRov) {
              // ROV: use COMMENTS / CMNTS from PLATGI
              findingsVal = String(rowObj.COMMENTS || rowObj.CMNTS || rowObj.comments || rowObj.cmnts || combinedData?.comments || combinedData?.COMMENTS || combinedData?.CMNTS || combinedData?.cmnts || '').trim();
            } else {
              // Diving: use INSP_COND from the diving inspection type tables
              findingsVal = String(rowObj.INSP_COND || rowObj.INSPCOND || rowObj.insp_cond || rowObj.inspcond || combinedData?.INSP_COND || combinedData?.insp_cond || combinedData?.INSPCOND || combinedData?.inspcond || '').trim();
            }

            // 1. Clean up marine growth details from findingsVal if parsed successfully (Requirement 1)
            let cleanedFindings = findingsVal;
            if (findingsVal && (mgDetails.softMg || mgDetails.hardMg)) {
              cleanedFindings = cleanedFindings.replace(/soft\s*(?:marine\s*growth)?\s*:?\s*(\d+(?:-\d+)?)\s*%/gi, '');
              cleanedFindings = cleanedFindings.replace(/hard\s*(?:marine\s*growth)?\s*:?\s*(\d+(?:-\d+)?)\s*%/gi, '');
              cleanedFindings = cleanedFindings.replace(/(\d+(?:-\d+)?)\s*%\s*(?:coverage\s+(?:of\s+)?)?(?:hard\s+(?:and|&)\s+soft|soft\s+(?:and|&)\s+hard)\s*(?:marine\s*)?(?:growth)?/gi, '');
              cleanedFindings = cleanedFindings.replace(/(\d+(?:-\d+)?)\s*%\s*(?:coverage\s+(?:of\s+)?)?\s*(?:marine\s*growth|mg\b)/gi, '');
              cleanedFindings = cleanedFindings.replace(/all\s*over\s+(?:marine\s*)?growth|all\s*over\s+mg\b/gi, '');
              
              cleanedFindings = cleanedFindings.replace(/[,;.:\-\s]+[,;.:\-]/g, ';');
              cleanedFindings = cleanedFindings.replace(/\s+/g, ' ').trim();
              cleanedFindings = cleanedFindings.replace(/^[;,:\-\s]+|[;,:\-\s]+$/g, '');
            }

            if (findingsVal) {
              inspectionDataObj.findings = cleanedFindings;
              inspectionDataObj.finding = cleanedFindings;
              findingsVal = cleanedFindings; // Strip percentage details from description column too!
            }

            // Explicitly re-apply parsed marine growth values after the combinedData loop
            // to ensure they take precedence over any raw Oracle data
            if (mgDetails.softMg) {
              inspectionDataObj.marine_growth_soft = mgDetails.softMg;
            }
            if (mgDetails.hardMg) {
              inspectionDataObj.marine_growth_hard = mgDetails.hardMg;
            }

             // Explicitly re-apply parsed MGI clock thickness values to ensure they override legacy records
            Object.entries(mgiThicknessDetails).forEach(([k, v]) => {
              if (v !== null) {
                inspectionDataObj[k] = v;
              }
            });

            // Explicitly re-apply parsed Anode details
            if (anodeDetails.anodeType) {
              inspectionDataObj.anode_type = anodeDetails.anodeType;
            }
            if (anodeDetails.depletion) {
              inspectionDataObj.anode_depletion = anodeDetails.depletion;
              inspectionDataObj.depletion = anodeDetails.depletion;
            }

            // 2e. Perform CP Calibration (CPCLB) Mapping
            if (typCode.toUpperCase() === 'CPCLB') {
              inspectionDataObj.calib_equipment_type = combinedData.equip !== undefined && combinedData.equip !== null ? String(combinedData.equip).trim() : null;
              inspectionDataObj.serial_number = combinedData.eq_id !== undefined && combinedData.eq_id !== null ? String(combinedData.eq_id).trim() : null;
              inspectionDataObj.calib_block = combinedData.clb_block !== undefined && combinedData.clb_block !== null ? String(combinedData.clb_block).trim() : null;

              // Voltages (auto-negate values)
              const toNegativeStr = (val: any) => {
                if (val === "" || val === null || val === undefined) return null;
                const num = Number(val);
                if (isNaN(num)) return String(val).trim();
                return String(num > 0 ? -num : num);
              };

              inspectionDataObj.pre_dive_cp_rdg = toNegativeStr(combinedData.pre_dive);
              inspectionDataObj.in_water1 = toNegativeStr(combinedData.in_water1);
              inspectionDataObj.in_water2 = toNegativeStr(combinedData.in_water2);
              inspectionDataObj.in_water3 = toNegativeStr(combinedData.in_water3);
              inspectionDataObj.post_dive_cp_rdg = toNegativeStr(combinedData.post_dive);
            }

            // 2f. Perform Cathodic Protection Survey (CPSURV) Mapping
            if (typCode.toUpperCase() === 'CPSURV') {
              const toNegativeStr = (val: any) => {
                if (val === "" || val === null || val === undefined) return null;
                const num = Number(val);
                if (isNaN(num)) return String(val).trim();
                return String(num > 0 ? -num : num);
              };

              inspectionDataObj.cp_rdg = toNegativeStr(combinedData.cp_out ?? combinedData.cp_in ?? combinedData.cp_rdg);
              inspectionDataObj.surface_condition = combinedData.surf_cond !== undefined && combinedData.surf_cond !== null ? String(combinedData.surf_cond).trim() : null;
              inspectionDataObj.cleaning_method = combinedData.clean_met !== undefined && combinedData.clean_met !== null ? String(combinedData.clean_met).trim() : null;
            }

            // 2g. Perform Splash Zone Inspection (SZONE) Mapping
            if (typCode.toUpperCase() === 'SZONE') {
              const toNegativeStr = (val: any) => {
                if (val === "" || val === null || val === undefined) return null;
                const num = Number(val);
                if (isNaN(num)) return String(val).trim();
                return String(num > 0 ? -num : num);
              };

              inspectionDataObj.cp_rdg = toNegativeStr(combinedData.cp_rdg);
              inspectionDataObj.ut_3_o_clock = combinedData.c03 !== undefined && combinedData.c03 !== null ? Number(combinedData.c03) : null;
              inspectionDataObj.ut_6_o_clock = combinedData.c06 !== undefined && combinedData.c06 !== null ? Number(combinedData.c06) : null;
              inspectionDataObj.ut_9_o_clock = combinedData.c09 !== undefined && combinedData.c09 !== null ? Number(combinedData.c09) : null;
              inspectionDataObj.ut_12_o_clock = combinedData.c12 !== undefined && combinedData.c12 !== null ? Number(combinedData.c12) : null;
              inspectionDataObj.nominal_thickness = combinedData.nom_thk !== undefined && combinedData.nom_thk !== null ? Number(combinedData.nom_thk) : null;
              inspectionDataObj.coating_coverage_percent = combinedData.coat_coverage !== undefined && combinedData.coat_coverage !== null ? Number(combinedData.coat_coverage) : null;
            }

            // 2h. Perform Marine Growth Removal (MGROW) Mapping
            if (typCode.toUpperCase() === 'MGROW') {
              // Thickness clock positions
              inspectionDataObj.mgi_hard_thickness_at_12 = combinedData.hard_thk12 !== undefined && combinedData.hard_thk12 !== null ? Number(combinedData.hard_thk12) : null;
              inspectionDataObj.mgi_hard_thickness_at_3 = combinedData.hard_thk3 !== undefined && combinedData.hard_thk3 !== null ? Number(combinedData.hard_thk3) : null;
              inspectionDataObj.mgi_hard_thickness_at_6 = combinedData.hard_thk6 !== undefined && combinedData.hard_thk6 !== null ? Number(combinedData.hard_thk6) : null;
              inspectionDataObj.mgi_hard_thickness_at_9 = combinedData.hard_thk9 !== undefined && combinedData.hard_thk9 !== null ? Number(combinedData.hard_thk9) : null;

              inspectionDataObj.mgi_soft_thickness_at_12 = combinedData.soft_thk12 !== undefined && combinedData.soft_thk12 !== null ? Number(combinedData.soft_thk12) : null;
              inspectionDataObj.mgi_soft_thickness_at_3 = combinedData.soft_thk3 !== undefined && combinedData.soft_thk3 !== null ? Number(combinedData.soft_thk3) : null;
              inspectionDataObj.mgi_soft_thickness_at_6 = combinedData.soft_thk6 !== undefined && combinedData.soft_thk6 !== null ? Number(combinedData.soft_thk6) : null;
              inspectionDataObj.mgi_soft_thickness_at_9 = combinedData.soft_thk9 !== undefined && combinedData.soft_thk9 !== null ? Number(combinedData.soft_thk9) : null;

              // Circumferential Measurements
              inspectionDataObj.circumferential_measurement_5m_above = combinedData.circum_pfive !== undefined && combinedData.circum_pfive !== null ? Number(combinedData.circum_pfive) : null;
              inspectionDataObj.circumferential_measurement_0m = combinedData.circum_zero !== undefined && combinedData.circum_zero !== null ? Number(combinedData.circum_zero) : null;
              inspectionDataObj.circumferential_measurement_5m_below = combinedData.circum_nfive !== undefined && combinedData.circum_nfive !== null ? Number(combinedData.circum_nfive) : null;

              // Dimensions and metrics
              inspectionDataObj.effective_thickness = combinedData.eff_thk !== undefined && combinedData.eff_thk !== null ? Number(combinedData.eff_thk) : null;
              inspectionDataObj.nominal_diameter = combinedData.nom_dia !== undefined && combinedData.nom_dia !== null ? Number(combinedData.nom_dia) : null;
              
              // Booleans mapping (handle 1 / 0 / null)
              const toBool = (val: any) => {
                if (val === undefined || val === null) return false;
                if (typeof val === 'boolean') return val;
                const num = Number(val);
                return num === 1;
              };

              inspectionDataObj.hard_circum = toBool(combinedData.hard_circum);
              inspectionDataObj.soft_circum = toBool(combinedData.soft_circum);
              inspectionDataObj.mgi_hard_growth = combinedData.hard_growth !== undefined && combinedData.hard_growth !== null ? Number(combinedData.hard_growth) : null;
              inspectionDataObj.mgi_soft_growth = combinedData.soft_growth !== undefined && combinedData.soft_growth !== null ? Number(combinedData.soft_growth) : null;
              inspectionDataObj.growth_circum = combinedData.growth_circum !== undefined && combinedData.growth_circum !== null ? Number(combinedData.growth_circum) : null;
              inspectionDataObj.coating_damage = toBool(combinedData.coating_damage);
              inspectionDataObj.mgi_profile = combinedData.mg_profile !== undefined && combinedData.mg_profile !== null ? String(combinedData.mg_profile).trim() : null;
            }

            // 2j. Perform Cleaning (CLEAN) Mapping
            if (typCode.toUpperCase() === 'CLEAN') {
              inspectionDataObj.cleaning_method = combinedData.clean_met !== undefined && combinedData.clean_met !== null ? String(combinedData.clean_met).trim() : (combinedData.clean_methd !== undefined && combinedData.clean_methd !== null ? String(combinedData.clean_methd).trim() : null);
              inspectionDataObj.surface_condition = combinedData.surf_cond !== undefined && combinedData.surf_cond !== null ? String(combinedData.surf_cond).trim() : null;
              inspectionDataObj.surface_condition_evaluation = combinedData.surface !== undefined && combinedData.surface !== null ? String(combinedData.surface).trim() : null;
              inspectionDataObj.cleaning_pressure = combinedData.clean_press !== undefined && combinedData.clean_press !== null ? Number(combinedData.clean_press) : null;
              inspectionDataObj.cleaning_pressure_unit = isImperial ? 'psi' : 'bar';
            }

            // 2i. Perform Selected Anode Inspection (PL_AN) Mapping
            if (typCode.toUpperCase() === 'PL_AN') {
              const toNegativeStr = (val: any) => {
                if (val === "" || val === null || val === undefined) return null;
                const num = Number(val);
                if (isNaN(num)) return String(val).trim();
                return String(num > 0 ? -num : num);
              };

              // Voltages (Auto-negate values)
              inspectionDataObj.member_cp = toNegativeStr(combinedData.memb_cp);
              inspectionDataObj.anode_cp = toNegativeStr(combinedData.cp_rdg);
              inspectionDataObj.topstub_cp = toNegativeStr(combinedData.topstub_cp);
              inspectionDataObj.bottomstub_cp = toNegativeStr(combinedData.botstub_cp);

              // Dimensions & Depletion
              inspectionDataObj.anode_type = combinedData.type !== undefined && combinedData.type !== null ? String(combinedData.type).trim() : null;
              inspectionDataObj.anode_length = combinedData.length !== undefined && combinedData.length !== null ? Number(combinedData.length) : null;
              inspectionDataObj.anode_depletion_percent = combinedData.depletion !== undefined && combinedData.depletion !== null ? Number(combinedData.depletion) : null;

              // Pittings
              inspectionDataObj.max_pitting_depth = combinedData.max_pit !== undefined && combinedData.max_pit !== null ? Number(combinedData.max_pit) : null;
              inspectionDataObj.avg_pitting_depth = combinedData.avg_pit !== undefined && combinedData.avg_pit !== null ? Number(combinedData.avg_pit) : null;
              inspectionDataObj.max_pitting_diameter = combinedData.max_dia_pit !== undefined && combinedData.max_dia_pit !== null ? Number(combinedData.max_dia_pit) : null;
              inspectionDataObj.avg_pitting_diameter = combinedData.avg_dia_pit !== undefined && combinedData.avg_dia_pit !== null ? Number(combinedData.avg_dia_pit) : null;

              // Circumference
              inspectionDataObj.circumference_c1 = combinedData.circ_c1 !== undefined && combinedData.circ_c1 !== null ? Number(combinedData.circ_c1) : null;
              inspectionDataObj.circumference_c2 = combinedData.circ_c2 !== undefined && combinedData.circ_c2 !== null ? Number(combinedData.circ_c2) : null;
              inspectionDataObj.circumference_c3 = combinedData.circ_c3 !== undefined && combinedData.circ_c3 !== null ? Number(combinedData.circ_c3) : null;

              // Secured boolean
              const toBool = (val: any) => {
                if (val === undefined || val === null) return false;
                if (typeof val === 'boolean') return val;
                const num = Number(val);
                return num === 1;
              };
              inspectionDataObj.anode_secured_to_structure = toBool(combinedData.connected);
            }

            // 2a. Perform Bolted Support Inspection (BSINS) Mapping
            if (typCode.toUpperCase() === 'BSINS') {
              const toNegNum = (val: any) => {
                if (val === null || val === undefined || String(val).trim() === "") return null;
                const num = Number(val);
                if (isNaN(num)) return null;
                return num > 0 ? -num : num;
              };

              // Map Member Fields
              inspectionDataObj.no_bolts_pres_memb = typeof combinedData.no_bolts_pres_memb === 'number' ? combinedData.no_bolts_pres_memb : (combinedData.NO_BOLTS_PRES_MEMB !== undefined && combinedData.NO_BOLTS_PRES_MEMB !== null ? Number(combinedData.NO_BOLTS_PRES_MEMB) : null);
              inspectionDataObj.no_bolts_loose_memb = typeof combinedData.no_bolts_loose_memb === 'number' ? combinedData.no_bolts_loose_memb : (combinedData.NO_BOLTS_LOSE_MEMB !== undefined && combinedData.NO_BOLTS_LOSE_MEMB !== null ? Number(combinedData.NO_BOLTS_LOSE_MEMB) : null);
              inspectionDataObj.no_bolts_miss_memb = typeof combinedData.no_bolts_miss_memb === 'number' ? combinedData.no_bolts_miss_memb : (combinedData.NO_BOLTS_MIS_MEMB !== undefined && combinedData.NO_BOLTS_MIS_MEMB !== null ? Number(combinedData.NO_BOLTS_MIS_MEMB) : null);
              
              inspectionDataObj.max_gap_top_member = typeof combinedData.max_gap_top_member === 'number' ? combinedData.max_gap_top_member : (combinedData.GAP_TOP_MEMB !== undefined && combinedData.GAP_TOP_MEMB !== null ? Number(combinedData.GAP_TOP_MEMB) : null);
              inspectionDataObj.max_gap_bottom_member = typeof combinedData.max_gap_bottom_member === 'number' ? combinedData.max_gap_bottom_member : (combinedData.GAP_BOT_MEMB !== undefined && combinedData.GAP_BOT_MEMB !== null ? Number(combinedData.GAP_BOT_MEMB) : null);
              inspectionDataObj.max_flange_misalign_member = typeof combinedData.max_flange_misalign_member === 'number' ? combinedData.max_flange_misalign_member : (combinedData.FLNG_MEMB !== undefined && combinedData.FLNG_MEMB !== null ? Number(combinedData.FLNG_MEMB) : null);
              
              inspectionDataObj.member_clamp_cp = toNegNum(combinedData.member_clamp_cp ?? combinedData.MEMB_CLMP_CP);
              inspectionDataObj.member_cp = toNegNum(combinedData.member_cp ?? combinedData.MEMB_CP);
              inspectionDataObj.member_cp_2 = toNegNum(combinedData.member_cp_2 ?? combinedData.MEMB_CP_2 ?? combinedData.MEMB_CP2);

              // Units for member fields
              inspectionDataObj.max_gap_top_member_unit = "mm";
              inspectionDataObj.max_gap_bottom_member_unit = "mm";
              inspectionDataObj.max_flange_misalign_member_unit = "mm";

              // Map Brace Fields
              inspectionDataObj.no_bolts_pres_brace = typeof combinedData.no_bolts_pres_brace === 'number' ? combinedData.no_bolts_pres_brace : (combinedData.NO_BOLTS_PRES_COMP !== undefined && combinedData.NO_BOLTS_PRES_COMP !== null ? Number(combinedData.NO_BOLTS_PRES_COMP) : null);
              inspectionDataObj.no_bolts_loose_brace = typeof combinedData.no_bolts_loose_brace === 'number' ? combinedData.no_bolts_loose_brace : (combinedData.NO_BOLTS_LOSE_COMP !== undefined && combinedData.NO_BOLTS_LOSE_COMP !== null ? Number(combinedData.NO_BOLTS_LOSE_COMP) : null);
              inspectionDataObj.no_bolts_miss_brace = typeof combinedData.no_bolts_miss_brace === 'number' ? combinedData.no_bolts_miss_brace : (combinedData.NO_BOLTS_MIS_COMP !== undefined && combinedData.NO_BOLTS_MIS_COMP !== null ? Number(combinedData.NO_BOLTS_MIS_COMP) : null);
              
              inspectionDataObj.max_gap_top_brace = typeof combinedData.max_gap_top_brace === 'number' ? combinedData.max_gap_top_brace : (combinedData.GAP_TOP_COMP !== undefined && combinedData.GAP_TOP_COMP !== null ? Number(combinedData.GAP_TOP_COMP) : null);
              inspectionDataObj.max_gap_bottom_brace = typeof combinedData.max_gap_bottom_brace === 'number' ? combinedData.max_gap_bottom_brace : (combinedData.GAP_BOT_COMP !== undefined && combinedData.GAP_BOT_COMP !== null ? Number(combinedData.GAP_BOT_COMP) : null);
              inspectionDataObj.max_flange_misalign_brace = typeof combinedData.max_flange_misalign_brace === 'number' ? combinedData.max_flange_misalign_brace : (combinedData.FLNG_COMP !== undefined && combinedData.FLNG_COMP !== null ? Number(combinedData.FLNG_COMP) : null);

              // Units for brace fields
              inspectionDataObj.max_gap_top_brace_unit = "mm";
              inspectionDataObj.max_gap_bottom_brace_unit = "mm";
              inspectionDataObj.max_flange_misalign_brace_unit = "mm";

              // Map Appurtenance Fields
              inspectionDataObj.appurtenance_clamp_type = combinedData.appurtenance_clamp_type || combinedData.RSR_CLMP_TYPE || "—";
              inspectionDataObj.appurtenance_cp = toNegNum(combinedData.appurtenance_cp ?? combinedData.RISER_CP);
              inspectionDataObj.appurtenance_clamp_cp = toNegNum(combinedData.appurtenance_clamp_cp ?? combinedData.RISER_CLMP_CP);
              inspectionDataObj.stub_cp = toNegNum(combinedData.stub_cp ?? combinedData.STUB_CP);

              // Map General Fields (Boolean Conversion)
              const toBool = (val: any) => {
                if (val === undefined || val === null) return false;
                if (typeof val === 'boolean') return val;
                const valStr = String(val).trim().toLowerCase();
                return val === 1 || val === true || valStr === '1' || valStr === 'true' || valStr === 'y' || valStr === 'yes';
              };

              inspectionDataObj.clamp_coating_satisfactory = toBool(combinedData.clamp_coating_satisfactory !== undefined ? combinedData.clamp_coating_satisfactory : combinedData.CLMP_COATING);
              inspectionDataObj.all_bolts_double_nutted = toBool(combinedData.all_bolts_double_nutted !== undefined ? combinedData.all_bolts_double_nutted : combinedData.BOLTS_NUTTED);
              inspectionDataObj.liner_present_member_end = toBool(combinedData.liner_present_member_end !== undefined ? combinedData.liner_present_member_end : combinedData.LINER_MEMB);
              inspectionDataObj.earthing_wire_or_bolt_present = toBool(combinedData.earthing_wire_or_bolt_present !== undefined ? combinedData.earthing_wire_or_bolt_present : combinedData.EARTHWIRE_BOLT);
              inspectionDataObj.liner_present_component_end = toBool(combinedData.liner_present_component_end !== undefined ? combinedData.liner_present_component_end : combinedData.LINER_COMP);
              inspectionDataObj.washers_present_all_bolts = toBool(combinedData.washers_present_all_bolts !== undefined ? combinedData.washers_present_all_bolts : combinedData.WASHER_PRES);
            }

            // 2k. Perform General Visual Inspection (GVINS) Mapping
            if (typCode.toUpperCase() === 'GVINS') {
              const mgVal = combinedData.marine_grow !== undefined && combinedData.marine_grow !== null ? Number(combinedData.marine_grow) : null;
              if (mgVal !== null && !isNaN(mgVal)) {
                const bucket = mapPercentToRange(mgVal);
                inspectionDataObj.marine_growth_soft = bucket;
                inspectionDataObj.marine_growth_hard = bucket;
              }
            }

            // 2l. Perform Riser Survey (RISER) Mapping
            if (typCode.toUpperCase() === 'RISER') {
              // 1) Direct metrics
              inspectionDataObj.wall_thickness = combinedData.wall_thk !== undefined && combinedData.wall_thk !== null ? Number(combinedData.wall_thk) : null;
              inspectionDataObj.riserbend_elevation = combinedData.elev_bottm !== undefined && combinedData.elev_bottm !== null ? Number(combinedData.elev_bottm) : null;
              inspectionDataObj.span_height = combinedData.bottm_ht !== undefined && combinedData.bottm_ht !== null ? Number(combinedData.bottm_ht) : null;

              // 2) CP readings (auto-negate values, prioritize cp_rdg from Oracle column)
              const cpRdg = combinedData.cp_rdg !== undefined && combinedData.cp_rdg !== null ? Number(combinedData.cp_rdg) : null;
              const cpIn = combinedData.cp_in !== undefined && combinedData.cp_in !== null ? Number(combinedData.cp_in) : null;
              const cpOut = combinedData.cp_out !== undefined && combinedData.cp_out !== null ? Number(combinedData.cp_out) : null;
              
              if (cpRdg !== null) {
                inspectionDataObj.cp_rdg = cpRdg > 0 ? -cpRdg : cpRdg;
              } else if (cpOut !== null) {
                inspectionDataObj.cp_rdg = cpOut > 0 ? -cpOut : cpOut;
              } else if (cpIn !== null) {
                inspectionDataObj.cp_rdg = cpIn > 0 ? -cpIn : cpIn;
              }

              // 3) Populate cp_rdg_additional repeater
              const additionalCps = [];
              if (cpIn !== null) {
                additionalCps.push({ reading: cpIn > 0 ? -cpIn : cpIn, location: "CP In" });
              }
              if (cpOut !== null) {
                additionalCps.push({ reading: cpOut > 0 ? -cpOut : cpOut, location: "CP Out" });
              }
              if (cpRdg !== null && cpRdg !== cpIn && cpRdg !== cpOut) {
                additionalCps.push({ reading: cpRdg > 0 ? -cpRdg : cpRdg, location: "CP Rdg" });
              }
              if (additionalCps.length > 0) {
                inspectionDataObj.cp_rdg_additional = additionalCps;
              }

              // 4) Dedicated Marine Growth (MG) parser for RISER table
              const mgRaw = String(combinedData.mg || '').trim();
              if (mgRaw) {
                const lowerMg = mgRaw.toLowerCase();
                let softMg: string | null = null;
                let hardMg: string | null = null;

                // Extract specific separate percentages (e.g. "60% Hard 40% Soft", "80%H 60%S")
                const hardMatch = lowerMg.match(/(\d+(?:-\d+)?)\s*%\s*(?:hard|hmg|h)\b/i);
                const softMatch = lowerMg.match(/(\d+(?:-\d+)?)\s*%\s*(?:soft|smg|s)\b/i);

                if (hardMatch) hardMg = mapRangeStringToBucket(hardMatch[1]);
                if (softMatch) softMg = mapRangeStringToBucket(softMatch[1]);

                // Fallback: check word-first patterns (e.g. "hard 30% soft 10%")
                if (!hardMg) {
                  const hardWordMatch = lowerMg.match(/(?:hard|hmg|h)\s*(?:growth|mg)?\s*:?\s*(\d+(?:-\d+)?)\s*%/i);
                  if (hardWordMatch) hardMg = mapRangeStringToBucket(hardWordMatch[1]);
                }
                if (!softMg) {
                  const softWordMatch = lowerMg.match(/(?:soft|smg|s)\s*(?:growth|mg)?\s*:?\s*(\d+(?:-\d+)?)\s*%/i);
                  if (softWordMatch) softMg = mapRangeStringToBucket(softWordMatch[1]);
                }

                // Fallback: check combined patterns (e.g. "60% to 80% hard and soft")
                if (!hardMg && !softMg) {
                  const bothMatch = lowerMg.match(/(\d+(?:-\d+)?)\s*%\s*(?:to\s+(\d+)\s*%)?\s*(?:of\s+)?(?:hard\s+(?:and|&)\s+soft|soft\s+(?:and|&)\s+hard|soft\s*&\s*hard|hard\s*&\s*soft|hard\s+and\s+soft)\b/i);
                  if (bothMatch) {
                    const val = bothMatch[2] ? `${bothMatch[1]}-${bothMatch[2]}` : bothMatch[1];
                    const bucket = mapRangeStringToBucket(val);
                    if (bucket) {
                      softMg = bucket;
                      hardMg = bucket;
                    }
                  }
                }

                // Fallback: single type mention with single percentage (e.g. "80% soft growths", "60% Hard")
                if (!hardMg && !softMg) {
                  const singleTypeMatch = lowerMg.match(/(\d+(?:-\d+)?)\s*%\s*(?:of\s+)?(?:soft\s+growth|soft|hard\s+growth|hard|hmg|smg)\b/i);
                  if (singleTypeMatch) {
                    const val = singleTypeMatch[1];
                    const bucket = mapRangeStringToBucket(val);
                    if (bucket) {
                      if (lowerMg.includes("hard") || lowerMg.includes("hmg") || lowerMg.includes(" h")) {
                        hardMg = bucket;
                      } else if (lowerMg.includes("soft") || lowerMg.includes("smg") || lowerMg.includes(" s")) {
                        softMg = bucket;
                      }
                    }
                  }
                }

                // Fallback: generic percentage (e.g. "80%", "100", "0-20%")
                if (!hardMg && !softMg) {
                  const genericMatch = lowerMg.match(/^(\d+(?:-\d+)?)\s*%?$/);
                  if (genericMatch) {
                    const bucket = mapRangeStringToBucket(genericMatch[1]);
                    if (bucket) {
                      softMg = bucket;
                      hardMg = bucket;
                    }
                  } else {
                    const num = Number(mgRaw);
                    if (!isNaN(num) && num >= 0 && num <= 100) {
                      const bucket = mapPercentToRange(num);
                      softMg = bucket;
                      hardMg = bucket;
                    }
                  }
                }

                // Populate parsed values to PostgreSQL record object
                if (softMg) inspectionDataObj.marine_growth_soft = softMg;
                if (hardMg) inspectionDataObj.marine_growth_hard = hardMg;
              }
            }

            // 2b. Perform Flooded Member Detection (RFMD) Mapping
            if (typCode.toUpperCase() === 'RFMD') {
              // 1) Map COMP_COND to member_status
              const compCondRaw = String(rowObj.COMP_COND || '').trim().toLowerCase();
              let memberStatusVal = null;
              if (compCondRaw) {
                if (compCondRaw === 'fmd unable to take' || compCondRaw.includes('unable to take') || compCondRaw.includes('unable') || compCondRaw.includes('not take')) {
                  memberStatusVal = 'Unable to Take Reading';
                } else if (compCondRaw.includes('flood') || compCondRaw === 'f') {
                  memberStatusVal = 'Flooded';
                } else if (compCondRaw.includes('dry') || compCondRaw === 'd') {
                  memberStatusVal = 'Dry';
                } else if (compCondRaw.includes('grout') || compCondRaw === 'g') {
                  memberStatusVal = 'Grouted';
                } else if (compCondRaw.includes('inconclusive') || compCondRaw === 'i') {
                  memberStatusVal = 'Inconclusive';
                } else {
                  // Fallback: convert to proper case
                  memberStatusVal = compCondRaw.split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');
                }
              }
              if (memberStatusVal) {
                inspectionDataObj.member_status = memberStatusVal;
              }

              // 2) Extract and cut density value + unit from comments/findings
              // Flexible regex: matches "density" followed by up to 40 non-digit chars (handles natural language
              // like "density measured was 1.43 g/cc", "density value: 1.03", "density: 1.025 g/cm3", etc.)
              const densityRegex = new RegExp("density[^0-9]{0,40}([0-9]+(?:\\.[0-9]+)?)\\s*(g\\/cm3|g\\/cm³|g\\/cc|kg\\/m3|kg\\/m³|lb\\/ft3|lb\\/ft³|lb\\/in3|lb\\/in³)?\\.?", "i");
              const currentComments = findingsVal || '';
              const densityMatch = currentComments.match(densityRegex);
              if (densityMatch) {
                const parsedDensity = parseFloat(densityMatch[1]);
                if (!isNaN(parsedDensity)) {
                  inspectionDataObj.density_value = parsedDensity;
                  
                  // Map the extracted unit to the proper Postgres DENSITY unit format
                  const rawUnit = (densityMatch[2] || '').toLowerCase().trim();
                  let mappedUnit = 'g/cm³'; // Default density unit
                  if (rawUnit === 'g/cm3' || rawUnit === 'g/cm³' || rawUnit === 'g/cc') {
                    mappedUnit = 'g/cm³';
                  } else if (rawUnit === 'kg/m3' || rawUnit === 'kg/m³') {
                    mappedUnit = 'kg/m³';
                  } else if (rawUnit === 'lb/ft3' || rawUnit === 'lb/ft³') {
                    mappedUnit = 'lb/ft³';
                  } else if (rawUnit === 'lb/in3' || rawUnit === 'lb/in³') {
                    mappedUnit = 'lb/in³';
                  }
                  inspectionDataObj.density_value_unit = mappedUnit;
                  
                  // Cut the entire matched density sentence from comments/findings
                  let cutComments = currentComments.replace(densityMatch[0], "");
                  cutComments = cutComments.replace(/[;,.]\s*[;,.]/g, ';')
                                           .replace(/^\s*[;,.\-:\s]+/, '')
                                           .replace(/\s*[;,.\-:\s]+$/, '')
                                           .replace(/\s+/g, ' ')
                                           .trim();
                  
                  findingsVal = cutComments;
                  inspectionDataObj.findings = cutComments;
                  inspectionDataObj.finding = cutComments;
                }
              }
            }

            // 2c. Perform ROV Scour (RSCOR) comment parsing
            if (typCode.toUpperCase() === 'RSCOR') {
              let scourComments = findingsVal || '';

              // 1) Extract scour location — supports Leg name, Node number, or Midpoint
              //    e.g. "SCOUR AT LEG: A1", "AT LEG A1", "LOCATION: A1", "AT NODE: 101A", "NODE: 203B", "AT MIDPOINT", "MID-POINT"
              const midRegex = /(?:scour\s+)?(?:at\s+)?mid\-?point/i;
              const midMatch = scourComments.match(midRegex);
              if (midMatch) {
                inspectionDataObj.scour_location = 'At Midpoint';
                scourComments = scourComments.replace(midMatch[0], '');
              } else {
                const locRegex = /(?:scour\s+)?(?:at\s+)?(?:leg|node|location)\s*[:\-]?\s*([A-Za-z0-9\-\/]+)/i;
                const locMatch = scourComments.match(locRegex);
                if (locMatch) {
                  // Determine if it was a Node or Leg reference
                  const matchedKeyword = locMatch[0].toLowerCase();
                  const isNode = matchedKeyword.includes('node');
                  const prefix = isNode ? 'At Node' : 'At Leg';
                  inspectionDataObj.scour_location = `${prefix}: ${locMatch[1].toUpperCase()}`;
                  scourComments = scourComments.replace(locMatch[0], '');
                }
              }

              // 2) Extract scour depth (e.g. "SCOUR DEPTH: 200mm", "SCOUR DEPTH 200 mm", "DEPTH: 200mm", "DEPTH 200")
              const depthRegex = /(?:scour\s+)?depth\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)\s*(mm|cm|m|in|ft)?/i;
              const depthMatch = scourComments.match(depthRegex);
              if (depthMatch) {
                const depthVal = parseFloat(depthMatch[1]);
                if (!isNaN(depthVal)) {
                  inspectionDataObj.scour_depth = depthVal;
                  // Map unit to proper format, default to mm
                  const rawDepthUnit = (depthMatch[2] || 'mm').toLowerCase();
                  inspectionDataObj.scour_depth_unit = rawDepthUnit;
                }
                scourComments = scourComments.replace(depthMatch[0], '');
              }

              // 3) Extract exposed pile flag (e.g. "PILE EXPOSED", "PILE NOT EXPOSED", "EXPOSED PILE", "NOT EXPOSED", "EXPOSED")
              const exposedRegex = /(?:pile\s+(?:not\s+)?exposed|(?:not\s+)?exposed\s+pile|pile\s+is\s+(?:not\s+)?exposed|(?:not\s+)?exposed(?:\s+pile)?)/i;
              const exposedMatch = scourComments.match(exposedRegex);
              if (exposedMatch) {
                const matchText = exposedMatch[0].toLowerCase();
                const isExposed = !matchText.includes('not');
                inspectionDataObj.Exposed_pile = isExposed ? 'Yes' : 'No';
                scourComments = scourComments.replace(exposedMatch[0], '');
              }

              // 4) Extract burial percentage (e.g. "BURIAL: 30%", "BURIAL 30%", "BURIED 30%", "BURIAL PERCENT: 30", "30% BURIED")
              const burialRegex = /(?:burial|buried)\s*(?:percent(?:age)?)?\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)\s*%?|([0-9]+(?:\.[0-9]+)?)\s*%\s*(?:burial|buried)/i;
              const burialMatch = scourComments.match(burialRegex);
              if (burialMatch) {
                const burialVal = parseFloat(burialMatch[1] || burialMatch[2]);
                if (!isNaN(burialVal)) {
                  inspectionDataObj.Burial_percent = burialVal;
                }
                scourComments = scourComments.replace(burialMatch[0], '');
              }

              // Clean up remaining comments after extraction
              scourComments = scourComments
                .replace(/[;,.]\s*[;,.]/g, ';')
                .replace(/^\s*[;,.\-:\s]+/, '')
                .replace(/\s*[;,.\-:\s]+$/, '')
                .replace(/\s+/g, ' ')
                .replace(/\bseabed\s*[:\-]?\s*/gi, '')
                .trim();

              if (scourComments !== findingsVal) {
                findingsVal = scourComments;
                inspectionDataObj.findings = scourComments;
                inspectionDataObj.finding = scourComments;
              }
            }

            // 2d. Perform ROV Riser Structural Integrity (RRISI) comment & QID parsing
            if (typCode.toUpperCase() === 'RRISI') {
              let riserComments = findingsVal || '';

              // 1) Determine Riser Part (riser_item)
              const legacyQId = legacyCompId ? oracleCompIdToQId.get(legacyCompId) : null;
              const qidStr = legacyQId ? String(legacyQId).trim().toUpperCase() : '';
              let basePart = 'Riser'; // default fallback
              if (qidStr.startsWith('R')) {
                basePart = 'Riser';
              } else if (qidStr.startsWith('J')) {
                basePart = 'J-Tube';
              } else if (qidStr.startsWith('I')) {
                basePart = 'I-Tube';
              }

              let riserPart = basePart;
              const hasRiserBend = /riser\s*bend/i.test(riserComments);
              const hasPipeline = /pipeline/i.test(riserComments);

              // CRITICAL FIX: hasRiserBend MUST take precedence over hasPipeline
              // (prevents a comment with "pipeline" at the end overriding a clear "RISER BEND" label at the beginning!)
              if (hasRiserBend) {
                if (basePart === 'Riser') {
                  riserPart = 'Riser Bend';
                } else if (basePart === 'J-Tube') {
                  riserPart = 'J-Tube Bend';
                } else if (basePart === 'I-Tube') {
                  riserPart = 'I-Tube Bend';
                }
              } else if (hasPipeline) {
                riserPart = 'Pipeline';
              }
              
              inspectionDataObj.riser_item = riserPart;

              // Cut "RISER BEND" or "Pipeline" from comments if matched to clean findings
              if (riserPart === 'Pipeline') {
                riserComments = riserComments.replace(/pipeline/i, '');
              } else if (riserPart.includes('Bend')) {
                riserComments = riserComments.replace(/riser\s*bend/i, '');
              }

              // 2) Extract suspension height (e.g. "Riser bend was suspended approximately 0.5m...")
              const suspRegex = /(?:suspended|suspen[st]ion(?:\s+(?:height|gap|of))?)(?:.{0,50}?)(?<![a-zA-Z])([0-9]+(?:\.[0-9]+)?)\s*(m|cm|mm|ft|in)?\b/i;
              const suspMatch = riserComments.match(suspRegex);
              if (suspMatch) {
                const suspVal = parseFloat(suspMatch[1]);
                if (!isNaN(suspVal)) {
                  inspectionDataObj.suspention_height = suspVal;
                  inspectionDataObj.suspention_height_unit = (suspMatch[2] || 'm').toLowerCase();
                }
                riserComments = riserComments.replace(suspMatch[0], '');
              }

              // 3) Extract distance from member (e.g. "Distance between riser bend and the leg A1 is approximately 100mm...")
              const distRegex = /distance(?:.{0,80}?)(?<![a-zA-Z])([0-9]+(?:\.[0-9]+)?)\s*(m|cm|mm|ft|in)?\b/i;
              const distMatch = riserComments.match(distRegex);
              if (distMatch) {
                const distVal = parseFloat(distMatch[1]);
                if (!isNaN(distVal)) {
                  inspectionDataObj.distance_from_member = distVal;
                  inspectionDataObj.distance_from_member_unit = (distMatch[2] || 'm').toLowerCase();
                }
                riserComments = riserComments.replace(distMatch[0], '');
              }

              // 4) Clamp-specific parsing if component type is CL
              if (compCode === 'CL') {
                // a) Extract clamp type — supports explicit "RISER CLAMP TYPE:-J", "TYPE;J;" or "TYPE: J;" or regular "Clamp type:"
                const typeMatch = riserComments.match(/(?:riser\s+)?(?:clamp\s+)?type\s*[;:\-]+\s*([A-Za-z])\b/i);
                let clampTypeVal = '';
                let clampMatchedText = '';

                if (typeMatch) {
                  const letter = typeMatch[1].toUpperCase();
                  clampMatchedText = typeMatch[0];

                  const riserClampTypeOption = `riser clamp type ${letter.toLowerCase()}`;
                  let letterName = '';
                  if (letter === 'R') {
                    letterName = 'Riser Clamp';
                  } else if (letter === 'J') {
                    letterName = 'J-Tube Clamp';
                  } else if (letter === 'I') {
                    letterName = 'I-Tube Clamp';
                  } else if (letter === 'N') {
                    letterName = 'Neoprene Clamp';
                  } else if (letter === 'G') {
                    letterName = 'Guide Clamp';
                  } else if (letter === 'S') {
                    letterName = 'Structural Clamp';
                  } else if (letter === 'M') {
                    letterName = 'Monel Clamp';
                  }

                  if (libDescMap.has(riserClampTypeOption)) {
                    clampTypeVal = libDescMap.get(riserClampTypeOption) || '';
                  } else if (letterName && libDescMap.has(letterName.toLowerCase())) {
                    clampTypeVal = libDescMap.get(letterName.toLowerCase()) || '';
                  } else {
                    clampTypeVal = `RISER CLAMP TYPE ${letter}`;
                  }
                } else {
                  const clampTypeRegex = /clamp\s+type\s*[:\-]?\s*([A-Za-z0-9\-\s]+?)(?:[;.,\n]|$)/i;
                  const clampTypeMatch = riserComments.match(clampTypeRegex);
                  if (clampTypeMatch) {
                    clampTypeVal = clampTypeMatch[1].trim();
                    clampMatchedText = clampTypeMatch[0];
                  } else {
                    const commonClampTypes = ['riser clamp', 'neoprene clamp', 'guide clamp', 'structural clamp', 'monel clamp', 'saddle clamp', 'flat bar clamp', 'half shell clamp', 'half shell'];
                    for (const ct of commonClampTypes) {
                      const reg = new RegExp(`\\b${ct}\\b`, 'i');
                      const match = riserComments.match(reg);
                      if (match) {
                        clampTypeVal = ct;
                        clampMatchedText = match[0];
                        break;
                      }
                    }
                  }
                }

                if (clampTypeVal) {
                  let finalClampType = clampTypeVal;
                  const lowerClampType = clampTypeVal.toLowerCase();
                  if (libDescMap.has(lowerClampType)) {
                    finalClampType = libDescMap.get(lowerClampType) || clampTypeVal;
                  } else {
                    finalClampType = clampTypeVal.split(' ')
                      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                      .join(' ');
                  }
                  inspectionDataObj.clamp_type = finalClampType;
                  riserComments = riserComments.replace(clampMatchedText, '');
                }

                // b) Check movement detected
                const noMovementRegex = /(?:no\s+movement|no\s+slippage|no\s+slip|no\s+displacement|no\s+rotation)/i;
                const movementRegex = /(?:movement\s+(?:detected|observed|present)|clamp\s+(?:has\s+)?(?:moved|slipped)|slippage|displacement\s+detected)/i;

                if (noMovementRegex.test(riserComments)) {
                  inspectionDataObj.movement_detected = false;
                  const match = riserComments.match(noMovementRegex);
                  if (match) riserComments = riserComments.replace(match[0], '');
                } else if (movementRegex.test(riserComments)) {
                  inspectionDataObj.movement_detected = true;
                  const match = riserComments.match(movementRegex);
                  if (match) riserComments = riserComments.replace(match[0], '');
                }

                // c) Extract max gap
                const gapRegex = /(?:max\s+)?gap(?:.{0,20}?)(?<![a-zA-Z])([0-9]+(?:\.[0-9]+)?)\s*(mm|cm|m|in|ft)?\b/i;
                const gapMatch = riserComments.match(gapRegex);
                if (gapMatch) {
                  const gapVal = parseFloat(gapMatch[1]);
                  if (!isNaN(gapVal)) {
                    inspectionDataObj.max_gap = gapVal;
                    inspectionDataObj.max_gap_unit = (gapMatch[2] || 'mm').toLowerCase();
                  }
                  riserComments = riserComments.replace(gapMatch[0], '');
                }

                // d) Extract missing bolts/nuts
                let missingCount = null;
                let missingMatchText = '';
                const boltPatternA = /(?:missing\s+)?([0-9]+)\s*(?:missing\s+)?(?:bolt|nut|stud)s?(?:\s+missing)?\b/i;
                const boltPatternB = /(?:missing\s+)(?:bolt|nut|stud)s?\s*[:\-]?\s*([0-9]+)\b/i;

                const matchB = riserComments.match(boltPatternB);
                if (matchB) {
                  missingCount = parseInt(matchB[1]);
                  missingMatchText = matchB[0];
                } else {
                  const matchA = riserComments.match(boltPatternA);
                  if (matchA) {
                    missingCount = parseInt(matchA[1]);
                    missingMatchText = matchA[0];
                  }
                }
                if (missingCount !== null && !isNaN(missingCount)) {
                  inspectionDataObj.missing_bolts_nuts = missingCount;
                  riserComments = riserComments.replace(missingMatchText, '');
                }
              }

              // Clean up remaining comments
              riserComments = riserComments
                .replace(/[;,.]\s*[;,.]/g, ';')
                .replace(/^\s*[;,.\-:\s]+/, '')
                .replace(/\s*[;,.\-:\s]+$/, '')
                .replace(/\s+/g, ' ')
                .trim();

              if (riserComments !== findingsVal) {
                findingsVal = riserComments;
                inspectionDataObj.findings = riserComments;
                inspectionDataObj.finding = riserComments;
              }
            }

            // Copy COMP_COND to component_condition if present
            const compCondVal = rowObj.COMP_COND !== undefined && rowObj.COMP_COND !== null ? String(rowObj.COMP_COND).trim() : null;
            if (compCondVal) {
              let normalizedVal = compCondVal;
              if (isRov) {
                const trimmedLower = compCondVal.toLowerCase();
                if (libDescMap.has(trimmedLower)) {
                  normalizedVal = libDescMap.get(trimmedLower) || compCondVal;
                }
              }
              inspectionDataObj.component_condition = normalizedVal;
            }

            // Copy COAT_COND to coating_condition if present
            const coatCondVal = rowObj.COAT_COND !== undefined && rowObj.COAT_COND !== null ? String(rowObj.COAT_COND).trim() : null;
            if (coatCondVal) {
              let normalizedVal = coatCondVal;
              if (isRov) {
                const trimmedLower = coatCondVal.toLowerCase();
                if (libDescMap.has(trimmedLower)) {
                  normalizedVal = libDescMap.get(trimmedLower) || coatCondVal;
                }
              }
              inspectionDataObj.coating_condition = normalizedVal;
            }

            // 2. Perform Seabed Survey Coordinate Mapping & Debris/Dimension Parsing (Requirement 2 & 3)
            if (typCode.toUpperCase() === 'RSEAB') {
              const sdX = rowObj.SD_XPOS !== undefined && rowObj.SD_XPOS !== null ? Number(rowObj.SD_XPOS) : null;
              const sdY = rowObj.SD_YPOS !== undefined && rowObj.SD_YPOS !== null ? Number(rowObj.SD_YPOS) : null;

              let mappedX: number | null = null;
              let mappedY: number | null = null;

              // Priority 1: Scale using SD_XPOS and SD_YPOS if bounds are valid
              if (sdX !== null && sdY !== null && hasCoordinates && maxSdX > minSdX && maxSdY > minSdY) {
                const xRaw = 100 - ((sdX - minSdX) / (maxSdX - minSdX) * 100);
                const yRaw = 100 - ((sdY - minSdY) / (maxSdY - minSdY) * 100);
                mappedX = parseFloat(Math.max(5, Math.min(95, xRaw)).toFixed(2));
                mappedY = parseFloat(Math.max(5, Math.min(95, yRaw)).toFixed(2));

                inspectionDataObj.sd_xpos = sdX;
                inspectionDataObj.sd_ypos = sdY;
              } else if (sdX !== null && sdY !== null) {
                // Bounds invalid/equal: create default 10-meter bounding box around coordinate to scale it!
                const width = 10;
                const xMin = sdX - width / 2;
                const xMax = sdX + width / 2;
                const yMin = sdY - width / 2;
                const yMax = sdY + width / 2;

                const xRaw = 100 - ((sdX - xMin) / (xMax - xMin) * 100);
                const yRaw = 100 - ((sdY - yMin) / (yMax - yMin) * 100);
                mappedX = parseFloat(Math.max(5, Math.min(95, xRaw)).toFixed(2));
                mappedY = parseFloat(Math.max(5, Math.min(95, yRaw)).toFixed(2));

                inspectionDataObj.sd_xpos = sdX;
                inspectionDataObj.sd_ypos = sdY;
              }

              // Priority 2: If we still don't have mappedX/mappedY, use the QID and distance to compute approx position!
              const legacyQId = legacyCompId ? oracleCompIdToQId.get(legacyCompId) : null;
              if ((mappedX === null || mappedY === null) && legacyQId) {
                const match = legacyQId.match(/S\/BED\s*\(\s*([a-zA-Z0-9]+)\s*-\s*([a-zA-Z0-9]+)\s*\)\s*-\s*(\d+(?:\.\d+)?)\s*M/i);
                if (match) {
                  const startLeg = match[1].toUpperCase();
                  const endLeg = match[2].toUpperCase();
                  const distVal = parseFloat(match[3]);

                  // Resolve Leg Positions using structureName geometry layout
                  const legCount = structureName.includes('8') ? 8 : 4;
                  const padding = 80;
                  const VIEW_SIZE = 600;
                  const CENTER = VIEW_SIZE / 2;
                  const innerSize = VIEW_SIZE - (padding * 2);

                  let rows = 2;
                  let cols = 2;
                  if (legCount === 8) { rows = 2; cols = 4; }

                  const dx = innerSize / (cols - 1 || 1) * 0.4;
                  const dy = innerSize / (rows - 1 || 1) * 0.4;

                  const legPositions: { x: number; y: number; name: string }[] = [];
                  for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                      const rowName = String.fromCharCode(65 + r);
                      legPositions.push({
                        x: CENTER + (c - (cols - 1) / 2) * dx,
                        y: CENTER + (r - (rows - 1) / 2) * dy,
                        name: `${rowName}${c + 1}`
                      });
                    }
                  }

                  const startPos = legPositions.find(p => p.name === startLeg);
                  const endPos = legPositions.find(p => p.name === endLeg);

                  if (startPos && endPos) {
                    const minX = Math.min(...legPositions.map(p => p.x));
                    const minY = Math.min(...legPositions.map(p => p.y));
                    const maxX = Math.max(...legPositions.map(p => p.x));
                    const maxY = Math.max(...legPositions.map(p => p.y));

                    const maxDistValue = 21;
                    const availableX = (VIEW_SIZE - (maxX - minX)) / 2 - 20;
                    const availableY = (VIEW_SIZE - (maxY - minY)) / 2 - 20;
                    const minAvailable = Math.min(availableX, availableY);
                    const pxPerMeter = minAvailable / maxDistValue;

                    let targetX = startPos.x;
                    let targetY = startPos.y;

                    const startRow = startLeg.charAt(0);
                    const endRow = endLeg.charAt(0);
                    const startCol = parseInt(startLeg.slice(1));
                    const endCol = parseInt(endLeg.slice(1));

                    if (startRow === endRow) {
                      // Horizontal face (NORTH or SOUTH)
                      // Offset along the line by 3m to keep it inside the sector visually
                      const signX = endCol > startCol ? 1 : -1;
                      targetX = startPos.x + signX * (3 * pxPerMeter);

                      if (startRow === 'A') {
                        // NORTH face: offset goes NORTH (upwards / subtract Y)
                        targetY = startPos.y - (distVal * pxPerMeter);
                      } else {
                        // SOUTH face: offset goes SOUTH (downwards / add Y)
                        targetY = startPos.y + (distVal * pxPerMeter);
                      }
                    } else if (startCol === endCol) {
                      // Vertical face (WEST or EAST)
                      // Offset along the line by 3m
                      const signY = endRow.charCodeAt(0) > startRow.charCodeAt(0) ? 1 : -1;
                      targetY = startPos.y + signY * (3 * pxPerMeter);

                      if (startCol === 1) {
                        // WEST face: offset goes WEST (leftwards / subtract X)
                        targetX = startPos.x - (distVal * pxPerMeter);
                      } else {
                        // EAST face: offset goes EAST (rightwards / add X)
                        targetX = startPos.x + (distVal * pxPerMeter);
                      }
                    } else {
                      // Diagonal fallback: project directly along the line
                      const vx = endPos.x - startPos.x;
                      const vy = endPos.y - startPos.y;
                      const len = Math.sqrt(vx * vx + vy * vy);
                      if (len > 0) {
                        const ux = vx / len;
                        const uy = vy / len;
                        targetX = startPos.x + ux * (distVal * pxPerMeter);
                        targetY = startPos.y + uy * (distVal * pxPerMeter);
                      }
                    }

                    let mX = parseFloat(((targetX / VIEW_SIZE) * 100).toFixed(2));
                    let mY = parseFloat(((targetY / VIEW_SIZE) * 100).toFixed(2));

                    mappedX = parseFloat(Math.max(5, Math.min(95, mX)).toFixed(2));
                    mappedY = parseFloat(Math.max(5, Math.min(95, mY)).toFixed(2));
                  }
                }
              }

              // Ultimate Fallback: Place at the center (50, 50) so it's always plotted somewhere
              if (mappedX === null || mappedY === null) {
                mappedX = 50.0;
                mappedY = 50.0;
              }

              inspectionDataObj.x = mappedX;
              inspectionDataObj.y = mappedY;

              // Backend Geometry Solver to automatically compute spatial details
              const geom = calculateSeabedGeometry(mappedX, mappedY, structureName);
              inspectionDataObj.distance_from_leg = parseFloat(geom.distance.toFixed(1));
              inspectionDataObj.nearest_leg = geom.nearestLeg;
              inspectionDataObj.dist_to_nearest_leg = parseFloat(geom.distToNearestLeg.toFixed(1));
              inspectionDataObj.face = geom.face;

              // Debris, Material & Dimensions Parsing
              const originalComment = String(rowObj.COMMENTS || rowObj.CMNTS || rowObj.comments || rowObj.cmnts || '').trim();
              if (originalComment) {
                let categoryVal = 'Debris';
                if (/seepage|gas/i.test(originalComment)) {
                  categoryVal = 'Gas Seepage';
                } else if (/crater/i.test(originalComment)) {
                  categoryVal = 'Crater';
                }

                inspectionDataObj.category = categoryVal;

                if (categoryVal === 'Debris') {
                  const dims = parseDebrisDimensions(originalComment);
                  if (dims.length !== null) {
                    inspectionDataObj.size_length = dims.length;
                    inspectionDataObj.size_length_unit = dims.lengthUnit;
                  }
                  if (dims.width !== null) {
                    inspectionDataObj.size_width = dims.width;
                    inspectionDataObj.size_width_unit = dims.widthUnit;
                  }
                  if (dims.height !== null) {
                    inspectionDataObj.size_height = dims.height;
                    inspectionDataObj.size_height_unit = dims.heightUnit;
                  }
                  if (dims.diameter !== null) {
                    inspectionDataObj.size_diameter = dims.diameter;
                    inspectionDataObj.size_diameter_unit = dims.diameterUnit;
                  }
                  
                  // Construct standard dimensions text (e.g. "1.5m x 0.5m" or "2m")
                  const dimsTextParts = [];
                  if (dims.length !== null) dimsTextParts.push(`${dims.length}${dims.lengthUnit}`);
                  if (dims.width !== null) dimsTextParts.push(`${dims.width}${dims.widthUnit}`);
                  inspectionDataObj.size_dimensions = dimsTextParts.join(' x ') || (dims.length !== null ? `${dims.length}${dims.lengthUnit}` : null);
                  inspectionDataObj.dimension_1 = inspectionDataObj.size_dimensions;

                  // Predict debris material and clean description name
                  inspectionDataObj.material = predictMaterialFromComment(originalComment);
                  inspectionDataObj.debris_desc = extractDebrisDesc(originalComment);
                }
              }
            }

            // CP additional readings from CPGRID
            const cpgridKey = `${legacyInspNo}_${legacyInspId}`;
            if (cpgridCache.has(cpgridKey)) {
              let existingCps = inspectionDataObj.cp_rdg_additional;
              if (!Array.isArray(existingCps)) {
                existingCps = [];
              }
              const cpGridReadings = cpgridCache.get(cpgridKey) || [];
              cpGridReadings.forEach(gridRdg => {
                const isDup = existingCps.some((existing: any) => 
                  existing.location === gridRdg.location && 
                  Math.abs((existing.reading || 0) - gridRdg.reading) < 0.01
                );
                if (!isDup) {
                  existingCps.push(gridRdg);
                }
              });
              if (existingCps.length > 0) {
                inspectionDataObj.cp_rdg_additional = existingCps;
              }
            }

            // UT additional readings from WTGRID
            if (wtgridCache.has(cpgridKey)) {
              let existingUts = inspectionDataObj.ut_readings_additional;
              if (!Array.isArray(existingUts)) {
                existingUts = [];
              }
              const wtGridReadings = wtgridCache.get(cpgridKey) || [];
              wtGridReadings.forEach(gridRdg => {
                const isDup = existingUts.some((existing: any) => 
                  existing.location === gridRdg.location && 
                  Math.abs((existing.reading || 0) - gridRdg.reading) < 0.01
                );
                if (!isDup) {
                  existingUts.push(gridRdg);
                }
              });
              if (existingUts.length > 0) {
                inspectionDataObj.ut_readings_additional = existingUts;
              }
            }

            if (typCode.toUpperCase() === 'MGROW' || typCode.toUpperCase() === 'RMGI') {
              const mgiProfileId = mgiProfileIdMap.get(legacyInspNo);
              if (mgiProfileId) {
                inspectionDataObj._mgi_profile_id = mgiProfileId;
              }
            }

            recordsToInsert.push({
              dive_job_id: diveJobId,
              rov_job_id: rovJobId,
              structure_id: resolvedStructureId,
              component_id: pgCompId,
              jobpack_id: pgJpId,
              sow_report_no: sowReportNo || null,
              inspection_type_code: typCode,
              inspection_type_id: inspTypeMap.get(typCode.toUpperCase()) || null,
              component_type: compCode || null,
              tape_count_no: getCounterNoVal(),
              inspection_date: dateStr,
              inspection_time: timeStr,
              tape_id: pgTapeId,
              elevation: elevationVal,
              fp_kp: kpVal,
              inspection_data: inspectionDataObj,
              description: findingsVal || null,
              incomplete_reason: incompleteReason,
              has_anomaly: hasAnomaly,
              status: incompleteReason ? 'INCOMPLETE' : 'COMPLETED',
              cr_user: 'migration',
              workunit: '000'
            });
          }

          if (recordsToInsert.length > 0) {
            const incompleteCount = recordsToInsert.filter((r: any) => r.status === 'INCOMPLETE').length;
            if (report["COMP_NOT_INSP"]) {
              report["COMP_NOT_INSP"].migratedRows = (report["COMP_NOT_INSP"].migratedRows || 0) + incompleteCount;
            }
            const { data: insertedRecords, error: bulkErr } = await supabase
              .from("insp_records")
              .insert(recordsToInsert as any)
              .select("insp_id, inspection_data");

            if (bulkErr) {
              logs.push(`ERROR bulk-inserting primary inspections for ${reportKey}: ${bulkErr.message}`);
              report[reportKey].errors.push(bulkErr.message);
              // Set status to failed for all sub-types
              Object.keys(typeStats).forEach(tCode => {
                const subKey = `${reportKey}_${tCode}`;
                report[subKey] = { status: "failed", oracleRows: typeStats[tCode].oracleRows, migratedRows: 0, errors: [bulkErr.message] };
              });
            } else if (insertedRecords) {
              insertedRecords.forEach(r => {
                const pgId = Number(r.insp_id);
                const oId = Number((r.inspection_data as any)?.INSP_ID || (r.inspection_data as any)?.insp_id);
                const tCode = String((r.inspection_data as any)?.INSP_TYPE || (r.inspection_data as any)?.insp_type || '').toUpperCase().trim() || 'UNKNOWN';
                
                if (oId) {
                  inspIdCache.set(oId, pgId);
                }
                if (tCode && typeStats[tCode]) {
                  typeStats[tCode].migratedRows++;
                }
              });
              logs.push(`Successfully migrated ${insertedRecords.length} ${isRov ? 'ROV' : 'Diving'} primary inspection records into PostgreSQL!`);
              report[reportKey].status = "success";
              report[reportKey].migratedRows = insertedRecords.length;

              // Populate report keys for each specific inspection type code!
              Object.keys(typeStats).forEach(tCode => {
                const subKey = `${reportKey}_${tCode}`;
                const stat = (typeStats[tCode].errors.length > 0 ? "failed" : "success") as "success" | "failed" | "skipped";
                report[subKey] = {
                  status: stat,
                  oracleRows: typeStats[tCode].oracleRows,
                  migratedRows: typeStats[tCode].migratedRows,
                  errors: typeStats[tCode].errors
                };
              });
            }
          } else {
            logs.push(`No valid ${isRov ? 'ROV' : 'Diving'} primary inspection records could be mapped.`);
            report[reportKey].status = "success";
            
            // Set stats for all sub-types to success with 0 migrated
            Object.keys(typeStats).forEach(tCode => {
              const subKey = `${reportKey}_${tCode}`;
              report[subKey] = { status: "success", oracleRows: typeStats[tCode].oracleRows, migratedRows: 0, errors: [] };
            });
          }
        };

        await migrateInspectionsForType(true);
        await migrateInspectionsForType(false);

        // ---------------------------------------------------------------------
        // Phase 5: Migrate Anomalies (insp_anomalies)
        report["ANOMALY"].status = "failed";
        logs.push(`Phase 5: Migrating Anomalies from Oracle 'u_defect' table...`);

        // Re-use defectCols fetched during Phase 4 pre-fetching
        if (defectCols.size > 0 && defectCols.has('STR_ID') && inspIdCache.size > 0) {
          const qCols = ['STR_ID', 'COMP_ID', 'INSP_ID'];
          
          if (defectCols.has('DFT_REF_NO')) qCols.push('DFT_REF_NO');
          else if (defectCols.has('REF_NO')) qCols.push('REF_NO as DFT_REF_NO');
          
          // Anomaly Code (AMLY_COD)
          if (defectCols.has('DFT_CODE_TYPE')) qCols.push('DFT_CODE_TYPE');
          else if (defectCols.has('DFT_CODE_TYP')) qCols.push('DFT_CODE_TYP as DFT_CODE_TYPE');
          
          // Anomaly Findings / Defect Type (AMLY_FND)
          if (defectCols.has('DEFECT_CODE')) qCols.push('DEFECT_CODE');
          else if (defectCols.has('CODE')) qCols.push('CODE as DEFECT_CODE');
          
          // Priority (AMLY_TYP)
          if (defectCols.has('DEFECT_TYPE')) qCols.push('DEFECT_TYPE');
          else if (defectCols.has('CATEGORY')) qCols.push('CATEGORY as DEFECT_TYPE');
          
          if (defectCols.has('DEFECT_DESC')) qCols.push('DEFECT_DESC');
          else if (defectCols.has('DESCR')) qCols.push('DESCR as DEFECT_DESC');
          else if (defectCols.has('DESCRIPTION')) qCols.push('DESCRIPTION as DEFECT_DESC');
          
          if (defectCols.has('SEVERITY')) qCols.push('SEVERITY');
          
          if (defectCols.has('RECOMMENDED_ACTION')) qCols.push('RECOMMENDED_ACTION');
          else if (defectCols.has('REMEDIAL')) qCols.push('REMEDIAL as RECOMMENDED_ACTION');
          
          if (defectCols.has('RECTIFID')) qCols.push('RECTIFID');
          if (defectCols.has('RECTIFID_DESC')) qCols.push('RECTIFID_DESC');
          if (defectCols.has('RECT_DATE')) qCols.push('RECT_DATE');
          
          if (defectCols.has('APPROV_BY')) qCols.push('APPROV_BY');
          if (defectCols.has('EVAL_BY')) qCols.push('EVAL_BY');

          const defectResult = await oracleConn.execute(`
            SELECT ${qCols.join(', ')} 
            FROM u_defect 
            WHERE STR_ID = :strId AND INSP_ID IS NOT NULL AND INSP_ID > 0
          `, { strId: structureId });

          let defectRows = defectResult.rows as any[];
          if (defectRows && defectRows.length > 0) {
            defectRows = defectRows.filter(row => {
              const rObj = Array.isArray(row) ? qCols.reduce((acc, col, idx) => {
                const cleanColName = col.includes(' as ') ? col.split(' as ')[1].trim() : col;
                acc[cleanColName] = row[idx];
                return acc;
              }, {} as Record<string, any>) : row;
              const oInspId = Number(rObj.INSP_ID);
              return inspIdCache.has(oInspId);
            });
            logs.push(`Filtered legacy anomalies to ${defectRows.length} record(s) matching migrated inspections.`);
          }
          if (defectRows && defectRows.length > 0) {
            report["ANOMALY"].oracleRows = defectRows.length;

            const anomaliesToInsert = [];

            for (const row of defectRows) {
              const rObj = Array.isArray(row) ? qCols.reduce((acc, col, idx) => {
                const cleanColName = col.includes(' as ') ? col.split(' as ')[1].trim() : col;
                acc[cleanColName] = row[idx];
                return acc;
              }, {} as Record<string, any>) : row;

              const oInspId = Number(rObj.INSP_ID);
              const pgInspId = inspIdCache.get(oInspId);

              if (!pgInspId) continue;

              const sevStr = String(rObj.SEVERITY || "").toLowerCase();
              let severity = 'MINOR';
              if (sevStr.includes('crit')) severity = 'CRITICAL';
              else if (sevStr.includes('maj')) severity = 'MAJOR';
              else if (sevStr.includes('mod')) severity = 'MODERATE';

              // 1. anomaly_ref_no from DFT_REF_NO
              const anomalyRefNo = rObj.DFT_REF_NO ? String(rObj.DFT_REF_NO).trim() : `ANOM-${oInspId}`;

              // 2. defect_type_code from DFT_CODE_TYPE (look up description in u_lib_list)
              const dftCodeTypRaw = rObj.DFT_CODE_TYPE ? String(rObj.DFT_CODE_TYPE).trim() : '';
              const defectTypeCode = libIdToDescMap.get(dftCodeTypRaw.toLowerCase()) || dftCodeTypRaw || 'GEN';

              // 3. defect_category_code from DEFECT_CODE (look up description in u_lib_list)
              const defectCodeRaw = rObj.DEFECT_CODE ? String(rObj.DEFECT_CODE).trim() : '';
              const defectCategoryCode = libIdToDescMap.get(defectCodeRaw.toLowerCase()) || defectCodeRaw || '';

              // 4. priority_code & priority from DEFECT_TYPE (look up description in u_lib_list)
              const defectTypeRaw = rObj.DEFECT_TYPE ? String(rObj.DEFECT_TYPE).trim() : '';
              const priorityCode = libIdToDescMap.get(defectTypeRaw.toLowerCase()) || defectTypeRaw || 'NONE';

              // 5. defect_description from DEFECT_DESC
              const defectDescription = rObj.DEFECT_DESC ? String(rObj.DEFECT_DESC).trim() : 'Legacy defect details missing';

              // 6. Rectified / Status checking
              const rectifidVal = rObj.RECTIFID !== undefined && rObj.RECTIFID !== null ? Number(rObj.RECTIFID) : null;
              
              let status = 'OPEN';
              let isRectified = false;
              let rectifiedRemarks = null;
              let rectifiedDate = null;

              if (rectifidVal === 1) {
                status = 'CLOSED';
                isRectified = true;
                rectifiedRemarks = rObj.RECTIFID_DESC ? String(rObj.RECTIFID_DESC).trim() : null;
                if (rObj.RECT_DATE) {
                  rectifiedDate = cleanOracleDate(String(rObj.RECT_DATE));
                }
              }

              // 7. approv_by -> reviewed_by and eval_by -> approved_by
              const reviewedBy = rObj.APPROV_BY ? String(rObj.APPROV_BY).trim() : null;
              const approvedBy = rObj.EVAL_BY ? String(rObj.EVAL_BY).trim() : null;

              anomaliesToInsert.push({
                anomaly_ref_no: anomalyRefNo,
                inspection_id: pgInspId,
                defect_type_code: defectTypeCode,
                priority_code: priorityCode,
                defect_category_code: defectCategoryCode,
                defect_description: defectDescription,
                severity,
                recommended_action: rObj.RECOMMENDED_ACTION ? String(rObj.RECOMMENDED_ACTION).trim() : null,
                status,
                is_rectified: isRectified,
                rectified_remarks: rectifiedRemarks,
                follow_up_notes: rectifiedRemarks, // Populate follow_up_notes for dialog UI compatibility
                rectified_date: rectifiedDate,
                reviewed_by: reviewedBy,
                approved_by: approvedBy,
                follow_up_required: status === 'OPEN',
                cr_user: 'migration',
                workunit: '000'
              });
            }

            if (anomaliesToInsert.length > 0) {
              const { error: insErr } = await supabase.from("insp_anomalies").insert(anomaliesToInsert as any);
              if (insErr) {
                logs.push(`ERROR bulk-inserting anomalies: ${insErr.message}`);
                report["ANOMALY"].errors.push(insErr.message);
              } else {
                const matchedInspIds = Array.from(new Set(anomaliesToInsert.map(a => a.inspection_id)));
                await supabase.from("insp_records").update({ has_anomaly: true }).in("insp_id", matchedInspIds);

                logs.push(`Successfully migrated ${anomaliesToInsert.length} anomalies and updated parent inspection statuses!`);
                report["ANOMALY"].status = "success";
                report["ANOMALY"].migratedRows = anomaliesToInsert.length;
              }
            } else {
              logs.push(`No legacy defects mapped to migrated Postgres inspections.`);
              report["ANOMALY"].status = "success";
            }
          } else {
            logs.push(`No defects found in Oracle 'u_defect' table.`);
            report["ANOMALY"].status = "success";
          }
        } else {
          logs.push(`Defects table not present or no inspection cache matches found.`);
          report["ANOMALY"].status = "skipped";
        }

        // ---------------------------------------------------------------------
        // Phase 6: Migrate Inspection Attachments (attachment)
        // ---------------------------------------------------------------------
        report["INSP_ATTACHMENT"].status = "failed";
        logs.push(`Phase 6: Migrating Inspection specific attachments...`);

        const attachCols = await getOracleTableColumns(oracleConn, 'U_ATTACH_1');
        if (attachCols.size > 0 && attachCols.has('INSP_ID') && inspIdCache.size > 0) {
          const qCols = ['ATTACH_ID', 'STR_ID', 'INSPNO', 'COMP_ID', 'INSP_ID'];
          if (attachCols.has('A_FILENAME')) qCols.push('A_FILENAME');
          if (attachCols.has('A_PATH')) qCols.push('A_PATH');
          if (attachCols.has('CR_DATE')) qCols.push('CR_DATE');
          if (attachCols.has('TITLE')) qCols.push('TITLE');
          if (attachCols.has('DETAILS')) qCols.push('DETAILS');
          if (attachCols.has('A_FILETYPE')) qCols.push('A_FILETYPE');

          const attachResult = await oracleConn.execute(`
            SELECT ${qCols.join(', ')} 
            FROM U_ATTACH_1 
            WHERE STR_ID = :strId 
              AND INSPNO IS NOT NULL
          `, { strId: structureId });

          let attachRows = attachResult.rows as any[];
          if (selectedInspNo && attachRows && attachRows.length > 0) {
            attachRows = attachRows.filter(row => {
              const rObj = Array.isArray(row) ? qCols.reduce((acc, col, idx) => {
                acc[col] = row[idx];
                return acc;
              }, {} as Record<string, any>) : row;
              return String(rObj.INSPNO || "").trim() === selectedInspNo;
            });
            logs.push(`Filtered legacy attachments to ${attachRows.length} record(s) matching selected INSPNO ${selectedInspNo}.`);
          }
          if (attachRows && attachRows.length > 0) {
            report["INSP_ATTACHMENT"].oracleRows = attachRows.length;

            // Load company settings and storage provider preference
            let storageProvider = "Supabase";
            let storageConfig: any = null;
            let storageHandler: any = null;
            try {
              const { data: settings } = await supabase
                .from("company_settings" as any)
                .select("storage_provider, storage_config")
                .eq("id", 1)
                .single() as any;
              if (settings) {
                storageProvider = settings.storage_provider || "Supabase";
                storageConfig = settings.storage_config;
                storageHandler = await getStorageHandler(storageProvider, storageConfig);
                logs.push(`Loaded active storage provider for attachments: "${storageProvider}"`);
              }
            } catch (prefErr: any) {
              logs.push(`WARNING: Loading company storage settings failed: ${prefErr.message}. Defaulting to Supabase.`);
            }

            const attachmentsToInsert = [];
            let copiedFilesCount = 0;

            for (const row of attachRows) {
              const rObj = Array.isArray(row) ? qCols.reduce((acc, col, idx) => {
                acc[col] = row[idx];
                return acc;
              }, {} as Record<string, any>) : row;

              const oInspId = Number(rObj.INSP_ID);
              const oCompId = Number(rObj.COMP_ID);

              const pgInspId = inspIdCache.get(oInspId);
              
              if (!pgInspId) {
                logs.push(`Skipping attachment ${rObj.ATTACH_ID}: no matching Postgres inspection (ID: ${oInspId || 'null'}) found.`);
                continue;
              }

              const mime = getMimeType(String(rObj.A_FILETYPE || ""));
              const pgRecord: any = {
                source_id: pgInspId,
                source_type: 'INSPECTION',
                name: rObj.TITLE ? String(rObj.TITLE).trim() : (rObj.A_FILENAME ? String(rObj.A_FILENAME).trim() : `Legacy_File_${rObj.ATTACH_ID}`),
                path: rObj.A_PATH ? String(rObj.A_PATH).trim() : '',
                created_at: rObj.CR_DATE ? (formatLocalISOString(rObj.CR_DATE) || formatLocalISOString(new Date())) : formatLocalISOString(new Date()),
                meta: {
                  title: rObj.TITLE ? String(rObj.TITLE).trim() : '',
                  description: rObj.DETAILS ? String(rObj.DETAILS).trim() : '',
                  original_file_name: rObj.A_FILENAME ? String(rObj.A_FILENAME).trim() : '',
                  file_path: rObj.A_PATH ? String(rObj.A_PATH).trim() : '',
                  file_type: mime,
                  type: mime.startsWith('video/') ? 'VIDEO' : (mime.startsWith('image/') ? 'PHOTO' : 'DOCUMENT'),
                  insp_id: oInspId,
                  storage_provider: 'Legacy'
                }
              };

              // Try to physically access and copy file if possible
              const fName = rObj.A_FILENAME ? String(rObj.A_FILENAME).trim() : "";
              const pDir = rObj.A_PATH ? String(rObj.A_PATH).trim() : "";
              let legacyPath = "";
              let searchLocationsAttempted = [];

              if (fName) {
                // 1. If legacyAttachmentPath was defined, search there first
                if (legacyAttachmentPath) {
                  const isCustomUrl = legacyAttachmentPath.startsWith('http://') || legacyAttachmentPath.startsWith('https://');
                  const customPath = isCustomUrl 
                    ? (legacyAttachmentPath.endsWith('/') ? `${legacyAttachmentPath}${fName}` : `${legacyAttachmentPath}/${fName}`)
                    : path.join(legacyAttachmentPath, fName);
                  
                  searchLocationsAttempted.push(customPath);
                  if (isCustomUrl || fs.existsSync(customPath)) {
                    legacyPath = customPath;
                  }
                }

                // 2. Fallback to A_PATH + A_FILENAME defined in database
                if (!legacyPath && pDir) {
                  const isFallbackUrl = pDir.startsWith('http://') || pDir.startsWith('https://');
                  const fallbackPath = isFallbackUrl
                    ? (pDir.endsWith('/') ? `${pDir}${fName}` : `${pDir}/${fName}`)
                    : path.join(pDir, fName);
                  
                  searchLocationsAttempted.push(fallbackPath);
                  if (isFallbackUrl || fs.existsSync(fallbackPath)) {
                    legacyPath = fallbackPath;
                  }
                }
              }

              let fileBuffer: Buffer | null = null;
              const isUrl = legacyPath.startsWith('http://') || legacyPath.startsWith('https://');

              if (legacyPath && storageHandler) {
                if (isUrl) {
                  // Cloud storage URL download
                  try {
                    logs.push(`Physical Copy: Downloading file from cloud drive: "${legacyPath}"...`);
                    const downloadRes = await fetch(legacyPath);
                    if (downloadRes.ok) {
                      const arrayBuffer = await downloadRes.arrayBuffer();
                      fileBuffer = Buffer.from(arrayBuffer);
                      logs.push(`Physical Copy success: Downloaded from cloud drive (${fileBuffer.length} bytes).`);
                    } else {
                      logs.push(`WARNING: Cloud drive download failed. Status: ${downloadRes.status}`);
                    }
                  } catch (downloadErr: any) {
                    logs.push(`WARNING: Cloud drive download exception: ${downloadErr.message}`);
                  }
                } else {
                  // Local or network drive filesystem read
                  if (fs.existsSync(legacyPath)) {
                    try {
                      fileBuffer = fs.readFileSync(legacyPath);
                    } catch (readErr: any) {
                      logs.push(`WARNING: Local filesystem read failed for path "${legacyPath}": ${readErr.message}`);
                    }
                  }
                }
              }

              if (fileBuffer && storageHandler) {
                try {
                  const destFileName = `${Date.now()}-${rObj.ATTACH_ID}_${fName}`;
                  logs.push(`Physical Copy: Uploading file "${fName}" to ${storageProvider} storage...`);
                  
                  const uploadRes = await storageHandler.upload(fileBuffer, destFileName, mime);
                  
                  pgRecord.path = uploadRes.publicUrl;
                  pgRecord.meta.file_url = uploadRes.publicUrl;
                  pgRecord.meta.file_path = uploadRes.filePath;
                  pgRecord.meta.bucket = "attachments";
                  pgRecord.meta.storage_provider = storageProvider;
                  logs.push(`Physical Copy success: Uploaded to ${storageProvider}. Public URL: ${uploadRes.publicUrl}`);
                  copiedFilesCount++;
                } catch (copyErr: any) {
                  logs.push(`WARNING: Physical upload copy failed for "${fName}": ${copyErr.message}`);
                }
              } else {
                if (searchLocationsAttempted.length > 0) {
                  logs.push(`Physical copy skipped: File not found or inaccessible in any attempted locations: ${searchLocationsAttempted.join(', ')}.`);
                }
              }

              // Dynamic mappings fallback (for backward compatibility if configured)
              const attachMappings = mappings["ATTACHMENT"] || [];
              attachMappings.forEach((m: any) => {
                const cName = String(m.oracleCol).toUpperCase();
                let val = rObj[cName];
                if (val !== undefined && val !== null) {
                  if (m.oracleCol.toUpperCase() === "A_FILETYPE") {
                    val = getMimeType(String(val || ""));
                  }
                  const targetCol = String(m.pgCol);
                  if (['name', 'path', 'source_id', 'source_type', 'created_at'].includes(targetCol)) {
                    pgRecord[targetCol] = coerceValue(targetCol, val);
                  } else {
                    if (!pgRecord.meta) pgRecord.meta = {};
                    pgRecord.meta[targetCol] = val;
                  }
                }
              });

              attachmentsToInsert.push(pgRecord);
            }

            if (attachmentsToInsert.length > 0) {
              const { error: insErr } = await supabase.from("attachment").insert(attachmentsToInsert);
              if (insErr) {
                logs.push(`ERROR bulk-inserting inspection attachments: ${insErr.message}`);
                report["INSP_ATTACHMENT"].errors.push(insErr.message);
              } else {
                logs.push(`Successfully migrated ${attachmentsToInsert.length} inspection attachments!`);
                report["INSP_ATTACHMENT"].status = "success";
                report["INSP_ATTACHMENT"].migratedRows = attachmentsToInsert.length;
                report["INSP_ATTACHMENT"].filesCopied = copiedFilesCount;
              }
            } else {
              logs.push(`No attachments successfully mapped to Postgres inspections.`);
              report["INSP_ATTACHMENT"].status = "success";
            }
          } else {
            logs.push(`No inspection specific attachments found in legacy database.`);
            report["INSP_ATTACHMENT"].status = "success";
          }
        } else {
          logs.push(`No legacy attachments matching migrated inspections found.`);
          report["INSP_ATTACHMENT"].status = "skipped";
        }

        // ---------------------------------------------------------------------
        // Phase 7: Synchronize SOW Items Statuses (u_sow_items)
        // ---------------------------------------------------------------------
        logs.push(`Phase 7: Synchronizing Scope of Work (u_sow_items) statuses...`);
        try {
          // 1. Fetch all inspection records for this structure at once (optimized memory-based matching)
          const { data: allRecords, error: allRecsErr } = await (supabase as any)
            .from('insp_records')
            .select('insp_id, component_id, inspection_type_id, inspection_type_code, status, elevation, sow_report_no, inspection_date')
            .eq('structure_id', resolvedStructureId);

          if (allRecsErr) {
            logs.push(`WARNING: Fetching inspection records for SOW sync failed: ${allRecsErr.message}`);
          } else {
            // Fetch all SOWs for this migrated structure
            const { data: sows, error: sowFetchErr } = await (supabase as any)
              .from('u_sow')
              .select('id, jobpack_id, report_numbers, structure_type')
              .eq('structure_id', resolvedStructureId);

            if (sowFetchErr) {
              logs.push(`WARNING: Fetching SOWs for status sync failed: ${sowFetchErr.message}`);
            } else if (sows && sows.length > 0) {
              let totalUpdatedSowItems = 0;
              let totalInsertedSowItems = 0;

              for (const sow of sows) {
                const reportsArr = sow.report_numbers || [];
                const fallbackReportNo = Array.isArray(reportsArr) && reportsArr.length > 0 ? reportsArr[0]?.number : undefined;

                // Get all SOW items belonging to this SOW
                const { data: sowItems, error: sowItemsErr } = await (supabase as any)
                  .from('u_sow_items')
                  .select('id, component_id, inspection_type_id, inspection_code, report_number, elevation_required, elevation_data, status')
                  .eq('sow_id', sow.id);

                if (sowItemsErr) {
                  logs.push(`WARNING: Fetching SOW items for SOW ID ${sow.id} failed: ${sowItemsErr.message}`);
                  continue;
                }

                // 2. Process and update existing SOW items
                const existingItems = sowItems || [];
                if (existingItems.length > 0) {
                  for (const item of existingItems) {
                    const reportNo = item.report_number || fallbackReportNo;
                    
                    // Filter matching inspection records in memory
                    const matchingRecords = (allRecords || []).filter((r: any) => 
                      r.component_id === item.component_id && 
                      (r.inspection_type_id === item.inspection_type_id || r.inspection_type_code === item.inspection_code) &&
                      (!reportNo || r.sow_report_no === reportNo)
                    );

                    let finalStatus: 'pending' | 'completed' | 'incomplete' = 'pending';
                    let updatedFields: any = {
                      updated_at: new Date().toISOString(),
                      updated_by: 'migration',
                    };

                    if (matchingRecords.length > 0) {
                      updatedFields.inspection_count = matchingRecords.length;
                      
                      // Find latest inspection date from matching records in memory
                      const dates = matchingRecords
                        .map((r: any) => r.inspection_date)
                        .filter(Boolean)
                        .sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime());
                      
                      if (dates.length > 0) {
                        updatedFields.last_inspection_date = dates[0];
                      }

                      // Handle Elevation-bound SOW Item
                      if (
                        item.elevation_required &&
                        item.elevation_data &&
                        Array.isArray(item.elevation_data)
                      ) {
                        const updatedElevationData = item.elevation_data.map((elev: any) => {
                          const start = parseFloat(elev.start);
                          const end = parseFloat(elev.end);
                          
                          const elevMatching = matchingRecords.filter((rec: any) => {
                            const elevVal = rec.elevation !== null && rec.elevation !== undefined ? parseFloat(String(rec.elevation)) : NaN;
                            return !isNaN(elevVal) && elevVal >= Math.min(start, end) && elevVal <= Math.max(start, end);
                          });

                          let elevStatus = 'pending';
                          if (elevMatching.length > 0) {
                            const anyIncomplete = elevMatching.some((r: any) => r.status === 'INCOMPLETE');
                            elevStatus = anyIncomplete ? 'incomplete' : 'completed';
                          }
                          return { ...elev, status: elevStatus };
                        });

                        updatedFields.elevation_data = updatedElevationData;

                        const allDone = updatedElevationData.every((e: any) => e.status === 'completed');
                        const anyIncomplete = updatedElevationData.some((e: any) => e.status === 'incomplete');
                        const allPending = updatedElevationData.every((e: any) => e.status === 'pending');

                        if (allDone) finalStatus = 'completed';
                        else if (allPending) finalStatus = 'pending';
                        else finalStatus = 'incomplete';
                      } else {
                        // Handle Standard SOW Item
                        const hasIncomplete = matchingRecords.some((r: any) => r.status === 'INCOMPLETE');
                        finalStatus = hasIncomplete ? 'incomplete' : 'completed';
                      }
                    } else {
                      updatedFields.inspection_count = 0;
                      updatedFields.last_inspection_date = null;
                      if (
                        item.elevation_required &&
                        item.elevation_data &&
                        Array.isArray(item.elevation_data)
                      ) {
                        updatedFields.elevation_data = item.elevation_data.map((elev: any) => ({ ...elev, status: 'pending' }));
                      }
                    }

                    updatedFields.status = finalStatus;

                    const { error: updateErr } = await (supabase as any)
                      .from('u_sow_items')
                      .update(updatedFields)
                      .eq('id', item.id);

                    if (updateErr) {
                      console.error(`[SOW Post-Migration Sync] Update failed for item ${item.id}:`, updateErr);
                    } else {
                      totalUpdatedSowItems++;
                    }
                  }
                }

                // 3. Identify and bulk insert missing SOW items
                const existingKeys = new Set(existingItems.map((item: any) => `${item.component_id}:${item.inspection_type_id}`));
                const recordGroups: Record<string, any[]> = {};
                
                for (const rec of (allRecords || [])) {
                  if (!rec.component_id || !rec.inspection_type_id) continue;
                  
                  const key = `${rec.component_id}:${rec.inspection_type_id}`;
                  if (!existingKeys.has(key)) {
                    if (!recordGroups[key]) recordGroups[key] = [];
                    recordGroups[key].push(rec);
                  }
                }

                const missingKeys = Object.keys(recordGroups);
                if (missingKeys.length > 0) {
                  const compIds = missingKeys.map(k => parseInt(k.split(':')[0]));
                  const typeIds = missingKeys.map(k => parseInt(k.split(':')[1]));

                  // Fetch components details
                  const { data: comps } = await (supabase as any)
                    .from('structure_components')
                    .select('id, q_id, code')
                    .in('id', compIds);

                  // Fetch inspection types details
                  const { data: types } = await (supabase as any)
                    .from('inspection_type')
                    .select('id, code, name')
                    .in('id', typeIds);

                  const missingItemsToInsert: any[] = [];
                  for (const [key, group] of Object.entries(recordGroups)) {
                    const [compId, typeId] = key.split(':');
                    const comp = (comps || []).find((c: any) => String(c.id) === compId);
                    const type = (types || []).find((t: any) => String(t.id) === typeId);

                    if (comp && type) {
                      const hasIncomplete = (group || []).some((r: any) => r.status === 'INCOMPLETE');
                      const status = hasIncomplete ? 'incomplete' : 'completed';
                      const recordReportNo = group[0]?.sow_report_no || fallbackReportNo || null;

                      // Find latest inspection date in the group
                      const dates = group
                        .map((r: any) => r.inspection_date)
                        .filter(Boolean)
                        .sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime());
                      const lastInspectionDate = dates.length > 0 ? dates[0] : null;

                      missingItemsToInsert.push({
                        sow_id: sow.id,
                        component_id: parseInt(compId),
                        component_qid: comp.q_id || `COMP-${compId}`,
                        component_type: comp.code || null,
                        inspection_type_id: parseInt(typeId),
                        inspection_code: type.code,
                        inspection_name: type.name,
                        status,
                        report_number: recordReportNo,
                        inspection_count: group.length,
                        last_inspection_date: lastInspectionDate,
                        elevation_required: false,
                        created_by: 'Migration Tool',
                        updated_at: new Date().toISOString()
                      });
                    }
                  }

                  if (missingItemsToInsert.length > 0) {
                    const { error: insErr } = await (supabase as any)
                      .from('u_sow_items')
                      .insert(missingItemsToInsert);

                    if (insErr) {
                      logs.push(`WARNING: Inserting ${missingItemsToInsert.length} missing SOW items failed: ${insErr.message}`);
                    } else {
                      totalInsertedSowItems += missingItemsToInsert.length;
                      logs.push(`Inserted ${missingItemsToInsert.length} missing SOW item(s) for SOW ID ${sow.id}.`);
                    }
                  }
                }

                // 4. Recalculate totals and status for the parent u_sow record
                const { data: allSowItemsNow } = await (supabase as any)
                  .from('u_sow_items')
                  .select('status')
                  .eq('sow_id', sow.id);

                if (allSowItemsNow) {
                  const total = allSowItemsNow.length;
                  const completed = allSowItemsNow.filter((i: any) => i.status === 'completed').length;
                  const incomplete = allSowItemsNow.filter((i: any) => i.status === 'incomplete').length;
                  const pending = allSowItemsNow.filter((i: any) => i.status === 'pending').length;

                  await (supabase as any)
                    .from('u_sow')
                    .update({
                      total_items: total,
                      completed_items: completed,
                      incomplete_items: incomplete,
                      pending_items: pending,
                      status: pending === total ? 'pending' : (completed === total ? 'completed' : 'incomplete'),
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', sow.id);
                }
              }

              logs.push(`Successfully synchronized: updated ${totalUpdatedSowItems} SOW item(s), inserted ${totalInsertedSowItems} SOW item(s) in PostgreSQL!`);
            } else {
              logs.push(`No Scope of Work (u_sow) indexes found for status synchronization.`);
            }
          }
        } catch (sowSyncErr: any) {
          logs.push(`WARNING: SOW status synchronization failed: ${sowSyncErr.message}`);
          console.error("[SOW Sync post-migration Fail]:", sowSyncErr);
        }



        logs.push(`================================================================`);
        logs.push(`Relational Inspection Migration Pipeline completed successfully!`);
        logs.push(`================================================================`);

      } catch (pipelineErr: any) {
        logs.push(`CRITICAL ERROR inside Relational Migration Pipeline: ${pipelineErr.message}`);
        console.error("[Migration Relational Pipeline Fail]:", pipelineErr);
      }
    } else if (structureSuccess && componentsOnly) {
      logs.push(`================================================================`);
      logs.push(`Skipped Relational Inspection Migration Pipeline (Components Only Option Selected)`);
      logs.push(`================================================================`);
    }

      await writeStreamEvent({
        type: "complete",
        success: true,
        message: "Migration execution completed",
        logs,
        report: rawReport
      });

    } catch (error: any) {
      console.error("[Migration Execute Error]:", error);
      await writeStreamEvent({
        type: "error",
        message: "Migration failed",
        details: error.message
      });
    } finally {
      // Re-enable Row Level Security (RLS) at the very end to keep the database secure
      await setRlsStatus(false, logs);

      if (oracleConn) {
        try {
          await oracleConn.close();
        } catch (err) {
          console.error("Error closing Oracle connection:", err);
        }
      }

      // Close the stream writer
      try {
        await writer.close();
      } catch (e) {}
    }
  })();

  return new Response(transformStream.readable, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// cache-bust: trigger compilation reload
