import { NextRequest, NextResponse } from "next/server";
import { getOracleConnection, OracleConnectionConfig } from "@/utils/oracle-db";
import { createClient } from "@/utils/supabase/server";
import { getDefaultUnit } from "@/utils/unit-helpers";
import specUiConfig from "@/utils/spec-ui-config.json";

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

function combineDateTime(dateVal: any, timeVal: any): string {
  if (!dateVal) return new Date().toISOString();
  
  let dateStr = "";
  if (dateVal instanceof Date) {
    dateStr = dateVal.toISOString().split('T')[0];
  } else {
    const str = String(dateVal).trim();
    if (str.includes('T')) {
      dateStr = str.split('T')[0];
    } else {
      dateStr = str.split(' ')[0];
    }
  }
  
  let timeStr = "00:00:00";
  if (timeVal) {
    if (timeVal instanceof Date) {
      timeStr = timeVal.toISOString().split('T')[1].split('.')[0];
    } else {
      const match = String(timeVal).match(/\d{2}:\d{2}(:\d{2})?/);
      if (match) {
        timeStr = match[0];
        if (timeStr.split(':').length === 2) {
          timeStr += ":00";
        }
      }
    }
  }
  
  return `${dateStr}T${timeStr}Z`;
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
}

export async function POST(request: NextRequest) {
  let oracleConn;
  try {
    const payload: MigrationPayload = await request.json();
    const { config, structureId, mappings } = payload;
    let resolvedStructureId = Number(structureId);

    if (!config || !structureId || !mappings) {
      return NextResponse.json({ error: "Missing required payload parameters" }, { status: 400 });
    }

    // 1. Connect to both databases
    const supabase = await createClient();
    oracleConn = await getOracleConnection(config);

    const logs: string[] = [];
    const report: Record<string, { status: "success" | "failed" | "skipped"; oracleRows: number; migratedRows: number; errors: string[] }> = {};
    
    // Initialize default states for UI matching
    report["STRUCTURE"] = { status: "skipped", oracleRows: 0, migratedRows: 0, errors: [] };
    ["STR_ELV", "STR_LEVEL", "STR_FACES", "ATTACHMENT", "COMMENT", "U_ASSOC", "JOBPACK", "LOGS", "VIDEO", "INSP_ROV", "INSP_DIVING", "ANOMALY", "INSP_ATTACHMENT"].forEach(k => {
      report[k] = { status: "skipped", oracleRows: 0, migratedRows: 0, errors: [] };
    });

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

    let targetTable = "platform";
    let structureSuccess = true; // Default to true if skipped

    // --- 1. MIGRATE STRUCTURE ---
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
                  const parsedDate = new Date(val);
                  if (!isNaN(parsedDate.getTime())) {
                    val = parsedDate.toISOString();
                  }
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

            logs.push(`Migrating Structure to Postgres '${targetTable}' table...`);
            
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

    // --- 1.5 MIGRATE STRUCTURAL CHILD TABLES ---
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
                        const parsedDate = new Date(val);
                        if (!isNaN(parsedDate.getTime())) val = parsedDate.toISOString();
                      }
                      val = coerceValue(mapping.pgCol, val);
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
    const componentCodes = Object.keys(mappings).filter(k => 
      k !== "STRUCTURE" && k !== "ATTACHMENT" && k !== "COMMENT" && !childTables.includes(k)
    );

    if (structureSuccess) {
      // Clear existing components for this structure to avoid conflicts/duplicates
      await supabase.from("structure_components").delete().eq("structure_id", resolvedStructureId);

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

          let specTableName = `${code}_comp`.toUpperCase();
          if (code.toLowerCase() === 'an') {
            specTableName = (targetTable === 'u_pipeline' ? 'an_comp_pipe' : 'an_comp_plat').toUpperCase();
          }

          let query = `
            SELECT c.COMP_ID, c.STR_ID, c.ID_NO, c.Q_ID, c.CODE, s.* 
            FROM ALLCOMPID c
            LEFT JOIN ${specTableName} s ON c.COMP_ID = s.COMP_ID
            WHERE c.STR_ID = :strId AND c.CODE = :code
          `;

          try {
            let result;
            let rows: any[] = [];
            try {
              result = await oracleConn.execute(query, { strId: structureId, code: code });
              rows = result.rows as any[];
            } catch (joinErr: any) {
              logs.push(`WARNING: Left join with ${specTableName} failed (${joinErr.message}). Retrying query on ALLCOMPID only...`);
              const fallbackQuery = `SELECT ${Array.from(queryCols).join(', ')} FROM ALLCOMPID WHERE STR_ID = :strId AND CODE = :code`;
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
                const pgRecord: Record<string, any> = {
                  structure_id: resolvedStructureId,
                  code: code,
                  is_deleted: false
                };

                compMappings.forEach(mapping => {
                  if (mapping.oracleCol && mapping.pgCol && oracleData[mapping.oracleCol] !== undefined) {
                    let val = oracleData[mapping.oracleCol];
                    if (typeof val === 'string' && val.toLowerCase().includes('gmt')) {
                      const parsedDate = new Date(val);
                      if (!isNaN(parsedDate.getTime())) val = parsedDate.toISOString();
                    }
                    val = coerceValue(mapping.pgCol, val);
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
                  pgRecord.is_deleted = false;
                }

                return pgRecord;
              });

              const { data: insertedComps, error: insertErr } = await supabase
                .from("structure_components")
                .insert(pgRecords as any)
                .select("id, comp_id, q_id");

              if (insertErr) {
                logs.push(`ERROR inserting ${code} components: ${insertErr.message}`);
                report[code].errors.push(insertErr.message);
              } else {
                logs.push(`Successfully migrated ${rows.length} components for code ${code}!`);
                report[code].status = "success";
                report[code].migratedRows = rows.length;
                if (insertedComps) {
                  insertedComps.forEach(comp => {
                    const pgId = Number(comp.id);
                    if (comp.comp_id) {
                      compIdMap.set(Number(comp.comp_id), pgId);
                    }
                    if (comp.q_id) {
                      qIdMap.set(String(comp.q_id).trim(), pgId);
                    }
                  });
                }
              }
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
      if (structureSuccess && compIdMap.size > 0) {
        logs.push("Processing component associations (U_ASSOC)...");
        report["U_ASSOC"].status = "failed";

        try {
          const assocQuery = `SELECT COMP_ID, ASSOC_COMPID FROM U_ASSOC WHERE STR_ID = :strId`;
          const assocResult = await oracleConn.execute(assocQuery, { strId: structureId });
          const assocRows = assocResult.rows as any[];
          
          if (assocRows && assocRows.length > 0) {
            report["U_ASSOC"].oracleRows = assocRows.length;
            const parentToAssoc = new Map<number, number>();
            assocRows.forEach(row => {
              const oracleCompId = row.COMP_ID !== undefined ? Number(row.COMP_ID) : null;
              const oracleAssocId = row.ASSOC_COMPID !== undefined ? Number(row.ASSOC_COMPID) : null;
              
              if (oracleCompId && oracleAssocId) {
                const pgCompId = compIdMap.get(oracleCompId);
                const pgAssocCompId = compIdMap.get(oracleAssocId);
                
                if (pgCompId && pgAssocCompId) {
                  parentToAssoc.set(pgCompId, pgAssocCompId);
                }
              }
            });
            
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
    } else {
      logs.push("Skipped components migration because structure migration failed.");
    }

    // --- 3. MIGRATE ATTACHMENTS & COMMENTS ---
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
                        const parsedDate = new Date(val);
                        if (!isNaN(parsedDate.getTime())) val = parsedDate.toISOString();
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
    if (structureSuccess) {
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
          await supabase.from("attachment").delete().eq("source_type", "inspection").in("source_id", inspIds);
          // Delete anomalies
          await supabase.from("insp_anomalies").delete().in("inspection_id", inspIds);
          // Delete inspection records
          await supabase.from("insp_records").delete().eq("structure_id", resolvedStructureId);
        }

        const { data: rovJobs } = await (supabase.from as any)("insp_rov_jobs").select("rov_job_id").eq("structure_id", resolvedStructureId);
        const rovJobIds = rovJobs?.map((j: any) => j.rov_job_id) || [];

        const { data: diveJobs } = await (supabase.from as any)("insp_dive_jobs").select("dive_job_id").eq("structure_id", resolvedStructureId);
        const diveJobIds = diveJobs?.map((j: any) => j.dive_job_id) || [];

        if (rovJobIds.length > 0 || diveJobIds.length > 0) {
          const tapeSelect = (supabase.from as any)("insp_video_tapes").select("tape_id");
          if (rovJobIds.length > 0) tapeSelect.in("rov_job_id", rovJobIds);
          if (diveJobIds.length > 0) tapeSelect.in("dive_job_id", diveJobIds);
          const { data: tapes } = await tapeSelect;
          const tapeIds = tapes?.map((t: any) => t.tape_id) || [];
          
          if (tapeIds.length > 0) {
            await (supabase.from as any)("insp_video_logs").delete().in("tape_id", tapeIds);
            await (supabase.from as any)("insp_video_tapes").delete().in("tape_id", tapeIds);
          }
        }

        if (rovJobIds.length > 0) {
          await (supabase.from as any)("insp_rov_movements").delete().in("rov_job_id", rovJobIds);
          await (supabase.from as any)("insp_rov_jobs").delete().in("rov_job_id", rovJobIds);
        }

        if (diveJobIds.length > 0) {
          await (supabase.from as any)("insp_dive_movements").delete().in("dive_job_id", diveJobIds);
          await (supabase.from as any)("insp_dive_jobs").delete().in("dive_job_id", diveJobIds);
        }
        
        logs.push(`Successfully purged existing relational data for a clean migration run.`);

        // ---------------------------------------------------------------------
        // Phase 1: Fetch & Create Jobpack (jobpack) and SOW (u_sow)
        // ---------------------------------------------------------------------
        report["JOBPACK"].status = "failed";
        if (!report["U_SOW"]) report["U_SOW"] = { status: "failed", oracleRows: 0, migratedRows: 0, errors: [] };
        
        logs.push(`Phase 1: Fetching combined Jobpack and SOW details from Oracle (workpl, taskstr, u_sow, job_vessel)...`);
        
        const jpIdMap = new Map<string, number>(); // oracleInspNo -> postgresJobpackId
        const jobpackDefaultPrefixMap = new Map<string, string>(); // oracleInspNo -> default REP_PREFIX
        
        const jpsowMappings = mappings["JOBPACK_SOW"] || [];
        
        let workplResult;
        try {
          const joinedQuery = `
            SELECT 
              w.INSPNO, 
              w.JOBNAME, 
              w.VESSEL as WORKPL_VESSEL, 
              w.CONTRAC,
              w.ISTART,
              t.JOB_TYPE as TASK_JOB_TYPE, 
              s.JOB_TYPE as SOW_JOB_TYPE, 
              s.REP_PREFIX,
              jv.VESSEL_NAME,
              jv.DATE_OF_START
            FROM workpl w
            LEFT JOIN taskstr t ON w.INSPNO = t.INSPNO AND w.STR_ID = t.STR_ID
            LEFT JOIN u_sow s ON w.INSPNO = s.INSPNO AND w.STR_ID = s.STR_ID
            LEFT JOIN job_vessel jv ON w.INSPNO = jv.INSPNO
            WHERE w.STR_ID = :strId AND w.INSPNO IS NOT NULL
          `;
          workplResult = await oracleConn.execute(joinedQuery, { strId: structureId });
        } catch (workplErr: any) {
          logs.push(`ERROR: Failed to fetch combined Jobpack/SOW data: ${workplErr.message}`);
          report["JOBPACK"].errors.push(workplErr.message);
        }

        if (workplResult && workplResult.rows && workplResult.rows.length > 0) {
          report["JOBPACK"].oracleRows = workplResult.rows.length;
          report["U_SOW"].oracleRows = workplResult.rows.length;
          
          for (const row of workplResult.rows as any[]) {
            const rowObj = Array.isArray(row) ? {
              INSPNO: row[0],
              JOBNAME: row[1],
              WORKPL_VESSEL: row[2],
              CONTRAC: row[3],
              ISTART: row[4],
              TASK_JOB_TYPE: row[5],
              SOW_JOB_TYPE: row[6],
              REP_PREFIX: row[7],
              VESSEL_NAME: row[8],
              DATE_OF_START: row[9]
            } : row;
            
            const getMappedVal = (targetPgCol: string) => {
              const rule = jpsowMappings.find((m: any) => m.pgCol === targetPgCol);
              if (rule && rule.oracleCol) {
                return rowObj[rule.oracleCol];
              }
              return null;
            };
            
            const oracleInspNo = String(getMappedVal("jobpack_id") || rowObj.INSPNO || "").trim();
            if (!oracleInspNo) continue;
            
            const jobpackName = String(getMappedVal("title") || rowObj.JOBNAME || "").trim() || `Job Pack ${oracleInspNo}`;
            const vessel = String(getMappedVal("vessel_name") || rowObj.VESSEL_NAME || rowObj.WORKPL_VESSEL || "").trim();
            const dateStart = getMappedVal("start_date") || getMappedVal("vessel_date_of_start") || rowObj.DATE_OF_START || rowObj.ISTART || null;
            const contrac = String(getMappedVal("contractor") || rowObj.CONTRAC || "").trim();
            
            const jobType = String(getMappedVal("job_type") || rowObj.TASK_JOB_TYPE || rowObj.SOW_JOB_TYPE || "").trim();
            const repPrefix = String(getMappedVal("sow_report_no") || rowObj.REP_PREFIX || "").trim();
            
            if (repPrefix) {
              jobpackDefaultPrefixMap.set(oracleInspNo, repPrefix);
            }
            
            // 1. Check & upsert Postgres jobpack
            const { data: existingJp } = await (supabase.from as any)("jobpack")
              .select("id")
              .eq("metadata->>oracleInspNo", oracleInspNo)
              .maybeSingle();
            
            let pgJpId: number;
            const jpPayload = {
              name: jobpackName,
              metadata: {
                oracleInspNo,
                vessel,
                contrac,
                date_start: dateStart,
                rep_prefix: repPrefix,
                job_type: jobType
              }
            };
            
            if (existingJp) {
              pgJpId = Number(existingJp.id);
              await (supabase.from as any)("jobpack")
                .update(jpPayload)
                .eq("id", pgJpId);
            } else {
              const { data: newJp, error: insertJpErr } = await (supabase.from as any)("jobpack")
                .insert(jpPayload)
                .select("id")
                .single();
              
              if (insertJpErr) {
                logs.push(`ERROR creating Jobpack: ${insertJpErr.message}`);
                report["JOBPACK"].errors.push(insertJpErr.message);
                continue;
              }
              pgJpId = Number(newJp.id);
            }
            
            report["JOBPACK"].migratedRows++;
            jpIdMap.set(oracleInspNo, pgJpId);
            
            // 2. Check & upsert Postgres u_sow
            // Determine structureType (Platform or Pipeline) using structureId
            const { data: existingStr } = await (supabase.from as any)("platform")
              .select("id")
              .eq("id", resolvedStructureId)
              .maybeSingle();
            const structureType = existingStr ? "PLATFORM" : "PIPELINE";
            
            const { data: existingSow } = await (supabase.from as any)("u_sow")
              .select("sow_id")
              .eq("jobpack_id", pgJpId)
              .eq("structure_id", resolvedStructureId)
              .maybeSingle();
            
            const reportNumbers = repPrefix || jobType ? [{
              number: repPrefix || "UNKNOWN",
              job_type: jobType || "UNKNOWN"
            }] : [];
            
            const sowPayload = {
              jobpack_id: pgJpId,
              structure_id: resolvedStructureId,
              structure_type: structureType,
              report_numbers: reportNumbers,
              metadata: { migrated_from_oracle: true }
            };
            
            if (existingSow) {
              await (supabase.from as any)("u_sow")
                .update(sowPayload)
                .eq("sow_id", existingSow.sow_id);
            } else {
              const { error: insertSowErr } = await (supabase.from as any)("u_sow")
                .insert(sowPayload);
              if (insertSowErr) {
                logs.push(`ERROR creating u_sow for Jobpack ${pgJpId}: ${insertSowErr.message}`);
                report["U_SOW"].errors.push(insertSowErr.message);
              }
            }
            report["U_SOW"].migratedRows++;
          }
          
          report["JOBPACK"].status = "success";
          report["U_SOW"].status = report["U_SOW"].errors.length > 0 ? "failed" : "success";
          report["JOBPACK"].migratedRows = jpIdMap.size;
        } else {
          logs.push(`No Jobpacks found in Oracle 'workpl' table for this structure.`);
          report["JOBPACK"].status = "success";
        }

        // Cache SOW report number scope from Oracle sow_insp table
        // Keys cached: exactKey (inspNo_compId_code), compKey (inspNo_compId), codeKey (inspNo__code)
        const sowInspCache = new Map<string, string>();
        try {
          const sowCols = await getOracleTableColumns(oracleConn, 'sow_insp');
          if (sowCols.size > 0) {
            const queryCols = ['INSPNO', 'COMP_ID', 'REP_PREFIX'];
            // Prefer REP_NO / REPORT_NO (actual report number) over REP_PREFIX if available
            if (sowCols.has('REP_NO')) queryCols.push('REP_NO');
            else if (sowCols.has('REPORT_NO')) queryCols.push('REPORT_NO as REP_NO');
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
                const hasRepNo = sowCols.has('REP_NO') || sowCols.has('REPORT_NO');
                const rowObj = Array.isArray(row) ? {
                  INSPNO: row[0],
                  COMP_ID: row[1],
                  REP_PREFIX: row[2],
                  REP_NO: hasRepNo ? row[3] : null,
                  CODE: hasRepNo ? row[4] : row[3]
                } : row;
                
                const inspNo = String(rowObj.INSPNO || "").trim();
                const compId = Number(rowObj.COMP_ID);
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

        // ---------------------------------------------------------------------
        // Phase 2: Migrate Jobs & Movements from Oracle LOGS
        // ---------------------------------------------------------------------
        report["LOGS"].status = "failed";
        logs.push(`Phase 2: Migrating Jobs & Movements from Oracle LOGS...`);
        
        const rovJobsCache = new Map<string, number>();
        const diveJobsCache = new Map<string, number>();
        
        const logsCols = await getOracleTableColumns(oracleConn, 'LOGS');
        if (logsCols.size > 0 && logsCols.has('STR_ID')) {
          const queryCols = ['STR_ID', 'INSPNO', 'LOG_TYPE', 'LOG_DATE', 'LOG_TIME', 'LOG_DETAIL', 'DIVE_NO'];
          const selectCols = queryCols.filter(c => logsCols.has(c));
          
          ['DIVER', 'OPERATOR', 'SUPERVISOR', 'REP_CO', 'WATER_DEPTH', 'DEPTH'].forEach(c => {
            if (logsCols.has(c)) selectCols.push(c);
          });
          
          const logsQuery = `
            SELECT ${selectCols.join(', ')} 
            FROM LOGS 
            WHERE STR_ID = :strId 
            ORDER BY LOG_DATE ASC, LOG_TIME ASC
          `;
          
          const logsResult = await oracleConn.execute(logsQuery, { strId: structureId });
          const rows = logsResult.rows as any[];
          
          if (rows && rows.length > 0) {
            report["LOGS"].oracleRows = rows.length;
            
            const rovGroups = new Map<string, any[]>();
            const diveGroups = new Map<string, any[]>();
            
            rows.forEach(row => {
              const rowObj = Array.isArray(row) ? {
                STR_ID: row[0],
                INSPNO: row[1],
                LOG_TYPE: row[2],
                LOG_DATE: row[3],
                LOG_TIME: row[4],
                LOG_DETAIL: row[5],
                DIVE_NO: row[6]
              } : row;
              
              const inspNo = String(rowObj.INSPNO || "").trim();
              const diveNo = String(rowObj.DIVE_NO || "").trim();
              const logType = String(rowObj.LOG_TYPE || "").trim().toUpperCase();
              
              if (!inspNo || !diveNo) return;
              
              const key = `${inspNo}_${diveNo}`;
              
              if (logType === 'ROV LOG') {
                if (!rovGroups.has(key)) rovGroups.set(key, []);
                rovGroups.get(key)!.push(rowObj);
              } else if (logType === 'DIVER LOG' || logType === 'BELL LOG') {
                if (!diveGroups.has(key)) diveGroups.set(key, []);
                diveGroups.get(key)!.push(rowObj);
              }
            });
            
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
              const op = firstItem.OPERATOR ? String(firstItem.OPERATOR).trim() : 'MIGRATION';
              const sv = firstItem.SUPERVISOR ? String(firstItem.SUPERVISOR).trim() : 'MIGRATION';
              const co = firstItem.REP_CO ? String(firstItem.REP_CO).trim() : 'MIGRATION';
              
              const { data: newJob, error: jobErr } = await (supabase.from as any)("insp_rov_jobs")
                .insert({
                  deployment_no: diveNo,
                  structure_id: resolvedStructureId,
                  jobpack_id: pgJpId || null,
                  rov_serial_no: 'ROV-01',
                  rov_operator: op,
                  rov_supervisor: sv,
                  report_coordinator: co,
                  deployment_date: combineDateTime(firstItem.LOG_DATE, firstItem.LOG_TIME),
                  start_time: combineDateTime(firstItem.LOG_DATE, firstItem.LOG_TIME),
                  end_time: combineDateTime(lastItem.LOG_DATE, lastItem.LOG_TIME),
                  status: 'COMPLETED',
                  cr_user: 'migration',
                  workunit: 'OFFSHORE'
                })
                .select("rov_job_id")
                .single();
              
              if (jobErr) {
                logs.push(`ERROR creating ROV Job: ${jobErr.message}`);
                report["LOGS"].errors.push(jobErr.message);
                continue;
              }
              
              const rovJobId = Number(newJob.rov_job_id);
              rovJobsCache.set(key, rovJobId);
              rovJobsCount++;
              
              // Insert Movements
              const movements = items.map(item => {
                const detail = String(item.LOG_DETAIL || "").trim();
                let mType = 'AT_WORKSITE';
                if (detail.toLowerCase().includes('deploy') || detail.toLowerCase().includes('launch')) {
                  mType = 'ROV_DEPLOYED';
                } else if (detail.toLowerCase().includes('recover') || detail.toLowerCase().includes('deck')) {
                  mType = 'ROV_RECOVERED';
                } else if (detail.toLowerCase().includes('leave') || detail.toLowerCase().includes('transit')) {
                  mType = 'LEAVING_WORKSITE';
                }
                
                const depth = item.WATER_DEPTH ? Number(item.WATER_DEPTH) : (item.DEPTH ? Number(item.DEPTH) : null);
                
                return {
                  rov_job_id: rovJobId,
                  movement_type: mType,
                  movement_time: combineDateTime(item.LOG_DATE, item.LOG_TIME),
                  depth_meters: depth,
                  remarks: detail,
                  cr_user: 'migration',
                  workunit: 'OFFSHORE'
                };
              });
              
              const { error: mvErr } = await (supabase.from as any)("insp_rov_movements").insert(movements);
              if (mvErr) {
                logs.push(`WARNING: inserting ROV Movements failed: ${mvErr.message}`);
              } else {
                rovMovementsCount += movements.length;
              }
            }
            
            // Create Dive Jobs
            for (const [key, items] of Array.from(diveGroups.entries())) {
              const firstItem = items[0];
              const lastItem = items[items.length - 1];
              const [inspNo, diveNo] = key.split('_');
              
              const pgJpId = jpIdMap.get(inspNo);
              const diver = firstItem.DIVER ? String(firstItem.DIVER).trim() : 'MIGRATION';
              const sv = firstItem.SUPERVISOR ? String(firstItem.SUPERVISOR).trim() : 'MIGRATION';
              const co = firstItem.REP_CO ? String(firstItem.REP_CO).trim() : 'MIGRATION';
              
              const hasBell = items.some(item => String(item.LOG_TYPE).toUpperCase() === 'BELL LOG');
              
              const { data: newJob, error: jobErr } = await (supabase.from as any)("insp_dive_jobs")
                .insert({
                  dive_no: diveNo,
                  structure_id: resolvedStructureId,
                  jobpack_id: pgJpId || null,
                  diver_name: diver,
                  dive_supervisor: sv,
                  report_coordinator: co,
                  dive_date: combineDateTime(firstItem.LOG_DATE, firstItem.LOG_TIME),
                  start_time: combineDateTime(firstItem.LOG_DATE, firstItem.LOG_TIME),
                  end_time: combineDateTime(lastItem.LOG_DATE, lastItem.LOG_TIME),
                  status: 'COMPLETED',
                  additional_info: { dive_type: hasBell ? 'BELL' : 'DIVER' },
                  cr_user: 'migration',
                  workunit: 'OFFSHORE'
                })
                .select("dive_job_id")
                .single();
              
              if (jobErr) {
                logs.push(`ERROR creating Dive Job: ${jobErr.message}`);
                report["LOGS"].errors.push(jobErr.message);
                continue;
              }
              
              const diveJobId = Number(newJob.dive_job_id);
              diveJobsCache.set(key, diveJobId);
              diveJobsCount++;
              
              // Insert Movements
              const movements = items.map(item => {
                const detail = String(item.LOG_DETAIL || "").trim();
                let mType = 'AT_WORKSITE';
                if (detail.toLowerCase().includes('leave surface') || detail.toLowerCase().includes('descend')) {
                  mType = 'LEAVING_SURFACE';
                } else if (detail.toLowerCase().includes('recover') || detail.toLowerCase().includes('ascend') || detail.toLowerCase().includes('ascent')) {
                  mType = 'BACK_TO_SURFACE';
                } else if (detail.toLowerCase().includes('leave worksite') || detail.toLowerCase().includes('transit')) {
                  mType = 'LEAVING_WORKSITE';
                }
                
                const depth = item.WATER_DEPTH ? Number(item.WATER_DEPTH) : (item.DEPTH ? Number(item.DEPTH) : null);
                
                return {
                  dive_job_id: diveJobId,
                  movement_type: mType,
                  movement_time: combineDateTime(item.LOG_DATE, item.LOG_TIME),
                  depth_meters: depth,
                  remarks: detail,
                  cr_user: 'migration',
                  workunit: 'OFFSHORE'
                };
              });
              
              const { error: mvErr } = await (supabase.from as any)("insp_dive_movements").insert(movements);
              if (mvErr) {
                logs.push(`WARNING: inserting Dive Movements failed: ${mvErr.message}`);
              } else {
                diveMovementsCount += movements.length;
              }
            }
            
            logs.push(`Successfully migrated ${rovJobsCount} ROV Jobs & ${diveJobsCount} Diving Jobs.`);
            report["LOGS"].status = "success";
            report["LOGS"].migratedRows = rovJobsCount + diveJobsCount;
          } else {
            logs.push(`No logs found in Oracle 'LOGS' table for Structure ID ${structureId}.`);
            report["LOGS"].status = "success";
          }
        } else {
          logs.push(`Oracle 'LOGS' table not present. Skipped LOGS migration.`);
          report["LOGS"].status = "skipped";
        }

        // ---------------------------------------------------------------------
        // Phase 3: Migrate Video Tapes & Video Logs
        // ---------------------------------------------------------------------
        report["VIDEO"].status = "failed";
        logs.push(`Phase 3: Migrating Video Tapes & Video Logs...`);
        
        const tapesCache = new Map<string, number>();
        
        let videoTapesCount = 0;
        let videoLogsCount = 0;
        
        // 3a. Migrate ROV Tapes and Logs (from PLATGI)
        const platgiCols = await getOracleTableColumns(oracleConn, 'PLATGI');
        if (platgiCols.size > 0 && platgiCols.has('TAPE_NO')) {
          logs.push(`Fetching unique ROV tapes from 'PLATGI'...`);
          const rovTapeResult = await oracleConn.execute(`
            SELECT DISTINCT TAPE_NO, DIVE_NO, INSPNO 
            FROM PLATGI 
            WHERE TAPE_NO IS NOT NULL AND STR_ID = :strId
          `, { strId: structureId });
          
          if (rovTapeResult.rows && rovTapeResult.rows.length > 0) {
            for (const row of rovTapeResult.rows as any[]) {
              const rowObj = Array.isArray(row) ? { TAPE_NO: row[0], DIVE_NO: row[1], INSPNO: row[2] } : row;
              const tapeNo = String(rowObj.TAPE_NO || "").trim();
              const diveNo = String(rowObj.DIVE_NO || "").trim();
              const inspNo = String(rowObj.INSPNO || "").trim();
              
              if (!tapeNo) continue;
              
              const jobKey = `${inspNo}_${diveNo}`;
              const resolvedJobId = rovJobsCache.get(jobKey) || null;
              
              const { data: newTape, error: tapeErr } = await (supabase.from as any)("insp_video_tapes")
                .insert({
                  tape_no: tapeNo,
                  rov_job_id: resolvedJobId,
                  tape_type: 'ROV',
                  status: 'COMPLETED',
                  cr_user: 'migration',
                  workunit: 'OFFSHORE'
                })
                .select("tape_id")
                .single();
              
              if (tapeErr) {
                logs.push(`WARNING: Could not insert ROV tape ${tapeNo}: ${tapeErr.message}`);
                continue;
              }
              
              const tapeId = Number(newTape.tape_id);
              tapesCache.set(`ROV_${tapeNo}_${diveNo}`, tapeId);
              videoTapesCount++;
            }
          }
          
          // Migrate ROV Video Logs (where DESCRIPTION = 'TAPE LOG')
          if (platgiCols.has('DESCRIPTION') || platgiCols.has('DESCR')) {
            const descCol = platgiCols.has('DESCRIPTION') ? 'DESCRIPTION' : 'DESCR';
            const logQCols = ['TAPE_NO', 'DIVE_NO', 'INSPNO', descCol];
            if (platgiCols.has('TAPE_TIME')) logQCols.push('TAPE_TIME');
            if (platgiCols.has('TAPE_TIME_END')) logQCols.push('TAPE_TIME_END');
            if (platgiCols.has('REMARKS')) logQCols.push('REMARKS');
            
            const logResult = await oracleConn.execute(`
              SELECT ${logQCols.join(', ')} 
              FROM PLATGI 
              WHERE STR_ID = :strId AND ${descCol} = 'TAPE LOG'
            `, { strId: structureId });
            
            const logRows = logResult.rows as any[];
            if (logRows && logRows.length > 0) {
              const vLogs = logRows.map(row => {
                const rObj = Array.isArray(row) ? {
                  TAPE_NO: row[0],
                  DIVE_NO: row[1],
                  INSPNO: row[2],
                  DESCR: row[3],
                  TAPE_TIME: platgiCols.has('TAPE_TIME') ? row[4] : null,
                  TAPE_TIME_END: platgiCols.has('TAPE_TIME_END') ? row[5] : null,
                  REMARKS: platgiCols.has('REMARKS') ? row[6] : null
                } : row;
                
                const tapeNo = String(rObj.TAPE_NO || "").trim();
                const diveNo = String(rObj.DIVE_NO || "").trim();
                const cachedTapeId = tapesCache.get(`ROV_${tapeNo}_${diveNo}`);
                
                if (!cachedTapeId) return null;
                
                return {
                  tape_id: cachedTapeId,
                  event_type: 'PRE_INSPECTION',
                  event_time: new Date().toISOString(),
                  timecode_start: rObj.TAPE_TIME ? String(rObj.TAPE_TIME).trim() : '00:00:00',
                  timecode_end: rObj.TAPE_TIME_END ? String(rObj.TAPE_TIME_END).trim() : null,
                  remarks: rObj.REMARKS ? String(rObj.REMARKS).trim() : 'TAPE LOG',
                  cr_user: 'migration',
                  workunit: 'OFFSHORE'
                };
              }).filter(Boolean);
              
              if (vLogs.length > 0) {
                const { error: insertVLogErr } = await (supabase.from as any)("insp_video_logs").insert(vLogs);
                if (insertVLogErr) {
                  logs.push(`WARNING: Inserting ROV Video Logs failed: ${insertVLogErr.message}`);
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
          logs.push(`Fetching unique Diving tapes from 'VIDEO'...`);
          const divTapeResult = await oracleConn.execute(`
            SELECT DISTINCT TAPE_NO, DIVE_NO, INSPNO 
            FROM VIDEO 
            WHERE TAPE_NO IS NOT NULL AND STR_ID = :strId
          `, { strId: structureId });
          
          if (divTapeResult.rows && divTapeResult.rows.length > 0) {
            for (const row of divTapeResult.rows as any[]) {
              const rowObj = Array.isArray(row) ? { TAPE_NO: row[0], DIVE_NO: row[1], INSPNO: row[2] } : row;
              const tapeNo = String(rowObj.TAPE_NO || "").trim();
              const diveNo = String(rowObj.DIVE_NO || "").trim();
              const inspNo = String(rowObj.INSPNO || "").trim();
              
              if (!tapeNo) continue;
              
              const jobKey = `${inspNo}_${diveNo}`;
              const resolvedJobId = diveJobsCache.get(jobKey) || null;
              
              const { data: newTape, error: tapeErr } = await (supabase.from as any)("insp_video_tapes")
                .insert({
                  tape_no: tapeNo,
                  dive_job_id: resolvedJobId,
                  tape_type: 'DIVER',
                  status: 'COMPLETED',
                  cr_user: 'migration',
                  workunit: 'OFFSHORE'
                })
                .select("tape_id")
                .single();
              
              if (tapeErr) {
                logs.push(`WARNING: Could not insert Diving tape ${tapeNo}: ${tapeErr.message}`);
                continue;
              }
              
              const tapeId = Number(newTape.tape_id);
              tapesCache.set(`DIV_${tapeNo}_${diveNo}`, tapeId);
              videoTapesCount++;
            }
          }
          
          // Migrate Diving Video Logs
          const logQCols = ['TAPE_NO', 'DIVE_NO', 'INSPNO'];
          if (videoCols.has('TAPE_TIME')) logQCols.push('TAPE_TIME');
          if (videoCols.has('TAPE_TIME_END')) logQCols.push('TAPE_TIME_END');
          if (videoCols.has('REMARKS')) logQCols.push('REMARKS');
          
          const logResult = await oracleConn.execute(`
            SELECT ${logQCols.join(', ')} 
            FROM VIDEO 
            WHERE STR_ID = :strId
          `, { strId: structureId });
          
          const logRows = logResult.rows as any[];
          if (logRows && logRows.length > 0) {
            const vLogs = logRows.map(row => {
              const rObj = Array.isArray(row) ? {
                TAPE_NO: row[0],
                DIVE_NO: row[1],
                INSPNO: row[2],
                TAPE_TIME: videoCols.has('TAPE_TIME') ? row[3] : null,
                TAPE_TIME_END: videoCols.has('TAPE_TIME_END') ? row[4] : null,
                REMARKS: videoCols.has('REMARKS') ? row[5] : null
              } : row;
              
              const tapeNo = String(rObj.TAPE_NO || "").trim();
              const diveNo = String(rObj.DIVE_NO || "").trim();
              const cachedTapeId = tapesCache.get(`DIV_${tapeNo}_${diveNo}`);
              
              if (!cachedTapeId) return null;
              
              return {
                tape_id: cachedTapeId,
                event_type: 'PRE_INSPECTION',
                event_time: new Date().toISOString(),
                timecode_start: rObj.TAPE_TIME ? String(rObj.TAPE_TIME).trim() : '00:00:00',
                timecode_end: rObj.TAPE_TIME_END ? String(rObj.TAPE_TIME_END).trim() : null,
                remarks: rObj.REMARKS ? String(rObj.REMARKS).trim() : 'VIDEO LOG',
                cr_user: 'migration',
                workunit: 'OFFSHORE'
              };
            }).filter(Boolean);
            
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
        report["VIDEO"].migratedRows = videoTapesCount;

        // ---------------------------------------------------------------------
        // Phase 4: Migrate Inspection Records (insp_records)
        // ---------------------------------------------------------------------
        logs.push(`Phase 4: Migrating Inspection Records...`);
        const inspIdCache = new Map<number, number>();
        
        let primaryInspections: any[] = [];
        let isRovInsps = false;
        
        const allinspidCols = await getOracleTableColumns(oracleConn, 'ALLINSPID');
        
        if (targetTable === 'platform' && platgiCols.size > 0 && platgiCols.has('INSP_ID')) {
          isRovInsps = true;
          logs.push(`Fetching primary inspections from Oracle 'PLATGI' (ROV Platform)...`);
          
          const qCols = ['INSP_ID', 'INSPNO', 'COMP_ID', 'INSP_DATE', 'INSP_TIME', 'TAPE_NO', 'DIVE_NO'];
          if (platgiCols.has('INSP_TYPE')) qCols.push('INSP_TYPE');
          else if (platgiCols.has('CODE')) qCols.push('CODE as INSP_TYPE');
          if (platgiCols.has('ELEVATION')) qCols.push('ELEVATION');
          if (platgiCols.has('KP')) qCols.push('KP');
          
          const whereCond = platgiCols.has('DESCRIPTION') ? "DESCRIPTION != 'TAPE LOG'" : (platgiCols.has('DESCR') ? "DESCR != 'TAPE LOG'" : "1=1");
          
          const result = await oracleConn.execute(`
            SELECT ${qCols.join(', ')} 
            FROM PLATGI 
            WHERE STR_ID = :strId AND ${whereCond} AND INSP_ID IS NOT NULL AND INSP_ID > 0
          `, { strId: structureId });
          
          primaryInspections = result.rows || [];
        } else if (allinspidCols.size > 0 && allinspidCols.has('INSP_ID')) {
          isRovInsps = false;
          logs.push(`Fetching primary inspections from Oracle 'ALLINSPID' (Diving / Pipeline)...`);
          
          const qCols = ['INSP_ID', 'INSPNO', 'COMP_ID', 'INSP_DATE', 'INSP_TIME', 'TAPE_NO', 'DIVE_NO'];
          if (allinspidCols.has('INSP_TYPE')) qCols.push('INSP_TYPE');
          else if (allinspidCols.has('CODE')) qCols.push('CODE as INSP_TYPE');
          if (allinspidCols.has('ELEVATION')) qCols.push('ELEVATION');
          if (allinspidCols.has('KP')) qCols.push('KP');
          
          const result = await oracleConn.execute(`
            SELECT ${qCols.join(', ')} 
            FROM ALLINSPID 
            WHERE STR_ID = :strId AND INSP_ID IS NOT NULL AND INSP_ID > 0
          `, { strId: structureId });
          
          primaryInspections = result.rows || [];
        }
        
        // ---------------------------------------------------------------------
        // Phase 4b: Merge Type-Specific Inspection Data (In-Memory Fetch)
        // ---------------------------------------------------------------------
        const typeMappingKeys = Object.keys(mappings).filter(k => k.startsWith('INSP_DIV_') || k.startsWith('INSP_ROV_'));
        const typeDataByInspId: Record<number, any> = {};

        if (typeMappingKeys.length > 0) {
          logs.push(`Phase 4b: Extracting type-specific fields for inspection records...`);
          for (const mapKey of typeMappingKeys) {
            const typeCode = mapKey.replace('INSP_DIV_', '').replace('INSP_ROV_', '');
            const isRov = mapKey.startsWith('INSP_ROV_');
            const fieldMappings = mappings[mapKey];
            
            if (!fieldMappings || fieldMappings.length === 0) continue;
            
            const oracleColsToFetch = Array.from(new Set(fieldMappings.map((m: any) => String(m.oracleCol).toUpperCase())));
            if (!oracleColsToFetch.includes('INSP_ID')) {
              oracleColsToFetch.push('INSP_ID');
            }
            
            try {
              let query = "";
              const binds: any = { strId: structureId };
              
              if (isRov) {
                const scodeCol = platgiCols.has('INSP_SCODE') ? 'INSP_SCODE' : 'SCODE';
                query = `SELECT ${oracleColsToFetch.join(', ')} FROM PLATGI WHERE STR_ID = :strId AND ${scodeCol} = :typeCode AND INSP_ID IS NOT NULL`;
                binds.typeCode = typeCode;
              } else {
                const typeCols = await getOracleTableColumns(oracleConn, typeCode);
                if (typeCols.size === 0) continue;
                
                if (typeCols.has('STR_ID')) {
                  query = `SELECT ${oracleColsToFetch.join(', ')} FROM ${typeCode} WHERE STR_ID = :strId AND INSP_ID IS NOT NULL`;
                } else {
                  const selectCols = oracleColsToFetch.map(c => `t.${c}`).join(', ');
                  query = `
                    SELECT ${selectCols}
                    FROM ${typeCode} t
                    JOIN ALLINSPID a ON a.INSP_ID = t.INSP_ID
                    WHERE a.STR_ID = :strId AND t.INSP_ID IS NOT NULL
                  `;
                }
              }
              
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
              console.warn(`Failed to fetch type data for ${mapKey}`, err);
              logs.push(`Warning: Failed to fetch type-specific data for ${typeCode} (${err.message})`);
            }
          }
        }
        
        const reportKey = isRovInsps ? "INSP_ROV" : "INSP_DIVING";
        report[reportKey].status = "failed";
        
        if (primaryInspections.length > 0) {
          report[reportKey].oracleRows = primaryInspections.length;
          
          const recordsToInsert = [];
          
          for (const row of primaryInspections) {
            const rowObj = Array.isArray(row) ? {
              INSP_ID: row[0],
              INSPNO: row[1],
              COMP_ID: row[2],
              INSP_DATE: row[3],
              INSP_TIME: row[4],
              TAPE_NO: row[5],
              DIVE_NO: row[6],
              INSP_TYPE: row[7],
              ELEVATION: row[8],
              KP: row[9]
            } : row;
            
            const legacyInspId = Number(rowObj.INSP_ID);
            const legacyInspNo = String(rowObj.INSPNO || "").trim();
            const legacyCompId = Number(rowObj.COMP_ID);
            const legacyTapeNo = String(rowObj.TAPE_NO || "").trim();
            const legacyDiveNo = String(rowObj.DIVE_NO || "").trim();
            const legacyInspType = String(rowObj.INSP_TYPE || "").trim();
            
            const pgCompId = compIdMap.get(legacyCompId);
            if (!pgCompId) continue;
            
            const pgJpId = jpIdMap.get(legacyInspNo) || null;
            
            const jobKey = `${legacyInspNo}_${legacyDiveNo}`;
            const rovJobId = isRovInsps ? (rovJobsCache.get(jobKey) || null) : null;
            const diveJobId = !isRovInsps ? (diveJobsCache.get(jobKey) || null) : null;
            
            const tapeKey = `${isRovInsps ? 'ROV' : 'DIV'}_${legacyTapeNo}_${legacyDiveNo}`;
            const pgTapeId = tapesCache.get(tapeKey) || null;
            
            let typCode = legacyInspType.toUpperCase();
            if (typCode === 'GVINS' || typCode === 'RGVI') typCode = 'GVI';
            else if (typCode === 'CVINS') typCode = 'CVI';
            else if (typCode === 'UTWT' || typCode === 'UT') typCode = 'UTM';
            else if (typCode === 'RMGI') typCode = 'MGT';
            else if (typCode === 'ANODE') typCode = 'ADA';
            
            const sowReportNo = getSowReportNo(legacyInspNo, legacyCompId, typCode);
            
            const dateStr = combineDateTime(rowObj.INSP_DATE, rowObj.INSP_TIME);
            const timeStr = rowObj.INSP_TIME ? String(rowObj.INSP_TIME).trim() : '00:00:00';
              const mappedTypeData = typeDataByInspId[legacyInspId] || {};
              
              recordsToInsert.push({
                oracle_insp_id: legacyInspId,
                dive_job_id: diveJobId,
                rov_job_id: rovJobId,
                structure_id: resolvedStructureId,
                component_id: pgCompId,
                jobpack_id: pgJpId,
                sow_report_no: sowReportNo || null,
                inspection_type_code: typCode,
                inspection_date: dateStr,
                inspection_time: timeStr,
                tape_id: pgTapeId,
                elevation: rowObj.ELEVATION ? Number(rowObj.ELEVATION) : null,
                fp_kp: rowObj.KP ? String(rowObj.KP).trim() : null,
                inspection_data: {
                  ...rowObj,
                  ...mappedTypeData,
                  inspno: legacyInspNo,
                  str_id: String(structureId),
                  comp_id: String(legacyCompId),
                  insp_id: String(legacyInspId)
                },
                has_anomaly: false,
              status: 'COMPLETED',
              cr_user: 'migration',
              workunit: 'OFFSHORE'
            });
          }
          
          if (recordsToInsert.length > 0) {
            const { data: insertedRecords, error: bulkErr } = await supabase
              .from("insp_records")
              .insert(recordsToInsert as any)
              .select("insp_id, oracle_insp_id");
            
            if (bulkErr) {
              logs.push(`ERROR bulk-inserting inspection records: ${bulkErr.message}`);
              report[reportKey].errors.push(bulkErr.message);
            } else if (insertedRecords) {
              insertedRecords.forEach(r => {
                const pgId = Number(r.insp_id);
                const oId = Number(r.oracle_insp_id);
                if (oId) {
                  inspIdCache.set(oId, pgId);
                }
              });
              logs.push(`Successfully migrated ${insertedRecords.length} primary inspection records into PostgreSQL!`);
              report[reportKey].status = "success";
              report[reportKey].migratedRows = insertedRecords.length;
            }
          } else {
            logs.push(`No valid inspection records could be mapped.`);
            report[reportKey].status = "success";
          }
        } else {
          logs.push(`No primary inspection records found in Oracle.`);
          report[reportKey].status = "success";
        }

        // ---------------------------------------------------------------------
        // Phase 5: Migrate Anomalies (insp_anomalies)
        // ---------------------------------------------------------------------
        report["ANOMALY"].status = "failed";
        logs.push(`Phase 5: Migrating Anomalies from Oracle 'u_defect' table...`);
        
        const defectCols = await getOracleTableColumns(oracleConn, 'u_defect');
        if (defectCols.size > 0 && defectCols.has('STR_ID') && inspIdCache.size > 0) {
          const qCols = ['STR_ID', 'INSPNO', 'COMP_ID', 'INSP_ID'];
          if (defectCols.has('DEFECT_TYPE')) qCols.push('DEFECT_TYPE');
          else if (defectCols.has('CODE')) qCols.push('CODE as DEFECT_TYPE');
          if (defectCols.has('PRIORITY')) qCols.push('PRIORITY');
          if (defectCols.has('CATEGORY')) qCols.push('CATEGORY');
          if (defectCols.has('DESCR')) qCols.push('DESCR');
          else if (defectCols.has('DESCRIPTION')) qCols.push('DESCRIPTION as DESCR');
          if (defectCols.has('SEVERITY')) qCols.push('SEVERITY');
          if (defectCols.has('RECOMMENDED_ACTION')) qCols.push('RECOMMENDED_ACTION');
          else if (defectCols.has('REMEDIAL')) qCols.push('REMEDIAL as RECOMMENDED_ACTION');
          if (defectCols.has('STATUS')) qCols.push('STATUS');
          
          const defectResult = await oracleConn.execute(`
            SELECT ${qCols.join(', ')} 
            FROM u_defect 
            WHERE STR_ID = :strId AND INSP_ID IS NOT NULL AND INSP_ID > 0
          `, { strId: structureId });
          
          const defectRows = defectResult.rows as any[];
          if (defectRows && defectRows.length > 0) {
            report["ANOMALY"].oracleRows = defectRows.length;
            
            const anomaliesToInsert = [];
            
            for (const row of defectRows) {
              const rObj = Array.isArray(row) ? {
                STR_ID: row[0],
                INSPNO: row[1],
                COMP_ID: row[2],
                INSP_ID: row[3],
                DEFECT_TYPE: row[4],
                PRIORITY: row[5],
                CATEGORY: row[6],
                DESCR: row[7],
                SEVERITY: row[8],
                RECOMMENDED_ACTION: row[9],
                STATUS: row[10]
              } : row;
              
              const oInspId = Number(rObj.INSP_ID);
              const pgInspId = inspIdCache.get(oInspId);
              
              if (!pgInspId) continue;
              
              const sevStr = String(rObj.SEVERITY || "").toLowerCase();
              let severity = 'MINOR';
              if (sevStr.includes('crit')) severity = 'CRITICAL';
              else if (sevStr.includes('maj')) severity = 'MAJOR';
              else if (sevStr.includes('mod')) severity = 'MODERATE';
              
              const statStr = String(rObj.STATUS || "").toLowerCase();
              let status = 'OPEN';
              if (statStr.includes('close')) status = 'CLOSED';
              
              anomaliesToInsert.push({
                inspection_id: pgInspId,
                defect_type_code: rObj.DEFECT_TYPE ? String(rObj.DEFECT_TYPE).trim() : 'GEN',
                priority_code: rObj.PRIORITY ? String(rObj.PRIORITY).trim() : 'C',
                defect_category_code: rObj.CATEGORY ? String(rObj.CATEGORY).trim() : 'STRUCTURAL',
                defect_description: rObj.DESCR ? String(rObj.DESCR).trim() : 'Legacy defect details missing',
                severity,
                recommended_action: rObj.RECOMMENDED_ACTION ? String(rObj.RECOMMENDED_ACTION).trim() : null,
                status,
                follow_up_required: status === 'OPEN',
                cr_user: 'migration',
                workunit: 'OFFSHORE'
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
          if (attachCols.has('A_FILETYPE')) qCols.push('A_FILETYPE');
          if (attachCols.has('DESCR')) qCols.push('DESCR');
          else if (attachCols.has('DESCRIPTION')) qCols.push('DESCRIPTION as DESCR');
          
          const attachResult = await oracleConn.execute(`
            SELECT ${qCols.join(', ')} 
            FROM U_ATTACH_1 
            WHERE STR_ID = :strId AND INSP_ID IS NOT NULL AND INSP_ID > 0
          `, { strId: structureId });
          
          const attachRows = attachResult.rows as any[];
          if (attachRows && attachRows.length > 0) {
            report["INSP_ATTACHMENT"].oracleRows = attachRows.length;
            
            const attachmentsToInsert = [];
            
            for (const row of attachRows) {
              const rObj = Array.isArray(row) ? {
                ATTACH_ID: row[0],
                STR_ID: row[1],
                INSPNO: row[2],
                COMP_ID: row[3],
                INSP_ID: row[4],
                A_FILENAME: row[5],
                A_FILETYPE: row[6],
                DESCR: row[7]
              } : row;
              
              const oInspId = Number(rObj.INSP_ID);
              const pgInspId = inspIdCache.get(oInspId);
              
              if (!pgInspId) continue;
              
              attachmentsToInsert.push({
                source_id: pgInspId,
                source_type: 'inspection',
                file_name: rObj.A_FILENAME ? String(rObj.A_FILENAME).trim() : `Legacy_File_${rObj.ATTACH_ID}`,
                mime_type: getMimeType(String(rObj.A_FILETYPE || "")),
                description: rObj.DESCR ? String(rObj.DESCR).trim() : 'Inspection specific media attachment',
                cr_user: 'migration',
                workunit: 'OFFSHORE'
              });
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
        
        logs.push(`================================================================`);
        logs.push(`Relational Inspection Migration Pipeline completed successfully!`);
        logs.push(`================================================================`);
        
      } catch (pipelineErr: any) {
        logs.push(`CRITICAL ERROR inside Relational Migration Pipeline: ${pipelineErr.message}`);
        console.error("[Migration Relational Pipeline Fail]:", pipelineErr);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: "Migration execution completed",
      logs,
      report
    });

  } catch (error: any) {
    console.error("[Migration Execute Error]:", error);
    return NextResponse.json({ 
      error: "Migration failed", 
      details: error.message 
    }, { status: 500 });
  } finally {
    if (oracleConn) {
      try {
        await oracleConn.close();
      } catch (err) {
        console.error("Error closing Oracle connection:", err);
      }
    }
  }
}

// cache-bust: trigger compilation reload
