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
    ["STR_ELV", "STR_LEVEL", "STR_FACES", "ATTACHMENT", "COMMENT", "U_ASSOC"].forEach(k => {
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
