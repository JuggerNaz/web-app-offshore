import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import fs from "fs";
import path from "path";

const BACKUP_FILE_PATH = path.join(process.cwd(), "utils", "conversion", "migration-mappings.json");

// Helper to read backup file
function readBackupFile() {
  try {
    if (fs.existsSync(BACKUP_FILE_PATH)) {
      const data = fs.readFileSync(BACKUP_FILE_PATH, "utf8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("[Mappings API] Failed to read local backup file:", e);
  }
  return null;
}

// Helper to write backup file
function writeBackupFile(data: any) {
  try {
    // Ensure parent directories exist
    const dir = path.dirname(BACKUP_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(BACKUP_FILE_PATH, JSON.stringify(data, null, 2), "utf8");
    console.log("[Mappings API] Wrote backup to:", BACKUP_FILE_PATH);
    return true;
  } catch (e) {
    console.error("[Mappings API] Failed to write local backup file:", e);
    return false;
  }
}

/**
 * GET /api/migration/mappings
 * Loads mapping configuration.
 * Checks database table 'migration_mappings' first, falls back to the file backup.
 */
export async function GET() {
  let mappings: Record<string, any> = {};
  let source = "backup_file";
  let hasDbData = false;

  try {
    const supabase = createClient();
    const { data, error } = await (supabase.from as any)("migration_mappings")
      .select("key, mappings");

    if (error) {
      console.warn("[Mappings API] Database query failed or table 'migration_mappings' does not exist yet. Falling back to local file backup. Error:", error.message);
    } else if (data && data.length > 0) {
      data.forEach((row: any) => {
        if (row.key && row.mappings) {
          // If database still contains legacy 'default' key that stores everything:
          if (row.key === "default" && typeof row.mappings === "object" && !Array.isArray(row.mappings)) {
            mappings = { ...mappings, ...row.mappings };
          } else {
            mappings[row.key] = row.mappings;
          }
        }
      });
      hasDbData = Object.keys(mappings).length > 0;
      source = "database";
    }
  } catch (dbErr: any) {
    console.warn("[Mappings API] Database exception. Falling back to file. Error:", dbErr.message);
  }

  // Fallback to local file backup if database has no records or failed
  if (!hasDbData) {
    mappings = readBackupFile();
  }

  return NextResponse.json({
    success: true,
    source,
    data: mappings
  });
}

/**
 * POST /api/migration/mappings
 * Saves mapping configuration.
 * Saves to local file backup AND database table 'migration_mappings'.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const mappingsData = body.mappings;

    if (!mappingsData || typeof mappingsData !== "object") {
      return NextResponse.json({ error: "Invalid mappings data" }, { status: 400 });
    }

    // 1. Save to local codebase file backup
    const fileSaved = writeBackupFile(mappingsData);

    // 2. Attempt to save to database - storing each table key in a different row
    let dbSaved = false;
    let dbErrorMsg = "";

    try {
      const supabase = createClient();
      
      // Prepare records for upsert
      const rows = Object.keys(mappingsData).map(key => ({
        key,
        mappings: mappingsData[key],
        updated_at: new Date().toISOString()
      }));

      if (rows.length > 0) {
        const { error } = await (supabase.from as any)("migration_mappings")
          .upsert(rows, { onConflict: "key" });

        if (error) {
          dbErrorMsg = error.message;
          console.warn("[Mappings API] Database save failed (Table might not exist yet):", dbErrorMsg);
        } else {
          dbSaved = true;
          // Clean up the legacy 'default' row if it exists
          await (supabase.from as any)("migration_mappings").delete().eq("key", "default");
        }
      }
    } catch (dbErr: any) {
      dbErrorMsg = dbErr.message;
      console.warn("[Mappings API] Database exception during save:", dbErrorMsg);
    }

    return NextResponse.json({
      success: true,
      fileSaved,
      dbSaved,
      message: dbSaved 
        ? "Successfully saved to Database (stored as separate table rows) and local backup file!" 
        : `Saved to local file backup. Note: Database save was skipped because table 'migration_mappings' is not created in Supabase yet. Error details: ${dbErrorMsg}`
    });

  } catch (err: any) {
    console.error("[Mappings API] Save Error:", err);
    return NextResponse.json({ error: "Failed to save mappings", details: err.message }, { status: 500 });
  }
}
