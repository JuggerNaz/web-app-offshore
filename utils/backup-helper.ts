import pg from "pg";
const { Client } = pg;
import fs from "fs";
import path from "path";
import zlib from "zlib";

export interface BackupOptions {
  format: "sql" | "binary";
  includeSchema: boolean;
  includeData: boolean;
  includeViews: boolean;
  includeFunctions: boolean;
  includeAuth: boolean;
  includeRoles: boolean;
}

export interface BackupProgress {
  log: (msg: string) => void;
  progress: (percent: number, label: string) => void;
}

export async function runDatabaseBackup(
  connectionString: string,
  options: BackupOptions,
  tracker: BackupProgress
): Promise<{ filePath: string; fileName: string; sizeBytes: number }> {
  const client = new Client({ connectionString });
  await client.connect();

  const tempBackupDir = path.join(process.cwd(), "backups");
  if (!fs.existsSync(tempBackupDir)) {
    fs.mkdirSync(tempBackupDir, { recursive: true });
  }

  const timestamp = Date.now();
  const fileExt = options.format === "sql" ? "sql" : "dump.gz";
  const fileName = `backup_${timestamp}.${fileExt}`;
  const filePath = path.join(tempBackupDir, fileName);

  tracker.log("Starting backup database extraction...");
  tracker.progress(10, "Extracting table schemas");

  try {
    // 1. Gather Tables
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    const tables = tablesRes.rows.map((r: any) => r.table_name);
    tracker.log(`Found ${tables.length} tables in public schema.`);

    // 2. Gather Views
    let views: { name: string; definition: string }[] = [];
    if (options.includeViews) {
      tracker.progress(20, "Extracting database views");
      const viewsRes = await client.query(`
        SELECT table_name, view_definition 
        FROM information_schema.views 
        WHERE table_schema = 'public';
      `);
      views = viewsRes.rows.map((r: any) => ({
        name: r.table_name,
        definition: r.view_definition,
      }));
      tracker.log(`Found ${views.length} views in public schema.`);
    }

    // 3. Gather Custom Functions / Procedures
    let functions: { name: string; definition: string }[] = [];
    if (options.includeFunctions) {
      tracker.progress(30, "Extracting functions and routines");
      const funcsRes = await client.query(`
        SELECT routine_name, routine_definition, routine_type
        FROM information_schema.routines
        WHERE routine_schema = 'public';
      `);
      functions = funcsRes.rows.map((r: any) => ({
        name: r.routine_name,
        definition: r.routine_definition,
      }));
      tracker.log(`Found ${functions.length} custom routines/functions.`);
    }

    // 4. Gather Custom Roles
    let roles: string[] = [];
    if (options.includeRoles) {
      tracker.progress(40, "Extracting database roles");
      try {
        const rolesRes = await client.query(`
          SELECT rolname FROM pg_roles 
          WHERE rolsuper = false AND rolcanlogin = true;
        `);
        roles = rolesRes.rows.map((r: any) => r.rolname);
      } catch (err) {
        tracker.log("Unable to extract pg_roles (insufficient permission to read pg_roles Catalog)");
      }
    }

    // 5. Gather Auth Schema (Users / Identities)
    let authUsers: any[] = [];
    let authIdentities: any[] = [];
    if (options.includeAuth) {
      tracker.progress(50, "Extracting Supabase Auth records");
      try {
        const usersRes = await client.query("SELECT * FROM auth.users;");
        authUsers = usersRes.rows;
        tracker.log(`Extracted ${authUsers.length} authentication users.`);

        const identRes = await client.query("SELECT * FROM auth.identities;");
        authIdentities = identRes.rows;
        tracker.log(`Extracted ${authIdentities.length} auth identity linkages.`);
      } catch (err) {
        tracker.log("Failed to backup auth schema (requires superuser or bypass admin permission).");
      }
    }

    // 6. Gather Table Schemas & Data
    const tableData: Record<string, { schema: string; rows: any[] }> = {};
    let currentItem = 0;

    for (const table of tables) {
      currentItem++;
      const pct = 50 + Math.round((currentItem / tables.length) * 40);
      tracker.progress(pct, `Dumping table: ${table}`);

      // Schema definition for table
      let tableSchemaSql = "";
      if (options.includeSchema) {
        // Simple schema DDL generator fallback
        const colsRes = await client.query(`
          SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position;
        `, [table]);

        const colDefs = colsRes.rows.map((c: any) => {
          let def = `  "${c.column_name}" ${c.data_type}`;
          if (c.character_maximum_length) {
            def += `(${c.character_maximum_length})`;
          }
          if (c.is_nullable === "NO") {
            def += " NOT NULL";
          }
          if (c.column_default) {
            def += ` DEFAULT ${c.column_default}`;
          }
          return def;
        });

        tableSchemaSql = `CREATE TABLE IF NOT EXISTS public."${table}" (\n${colDefs.join(",\n")}\n);`;
      }

      // Fetch row data
      let rows: any[] = [];
      if (options.includeData) {
        const dataRes = await client.query(`SELECT * FROM public."${table}";`);
        rows = dataRes.rows;
      }

      tableData[table] = {
        schema: tableSchemaSql,
        rows,
      };
    }

    // 7. Write Output Format
    tracker.progress(95, "Serializing backup content");
    if (options.format === "sql") {
      let sqlContent = `-- Database Backup File\n-- Created: ${new Date().toISOString()}\n\n`;

      // Structure definitions
      if (options.includeSchema) {
        sqlContent += "-- ==========================================\n";
        sqlContent += "-- SCHEMAS & TABLES STRUCTURE\n";
        sqlContent += "-- ==========================================\n\n";
        for (const table of tables) {
          sqlContent += `${tableData[table].schema}\n\n`;
        }
      }

      // Views
      if (options.includeViews && views.length > 0) {
        sqlContent += "-- ==========================================\n";
        sqlContent += "-- VIEWS\n";
        sqlContent += "-- ==========================================\n\n";
        for (const view of views) {
          sqlContent += `CREATE OR REPLACE VIEW public."${view.name}" AS\n${view.definition};\n\n`;
        }
      }

      // Functions
      if (options.includeFunctions && functions.length > 0) {
        sqlContent += "-- ==========================================\n";
        sqlContent += "-- PROCEDURES & FUNCTIONS\n";
        sqlContent += "-- ==========================================\n\n";
        for (const func of functions) {
          sqlContent += `${func.definition}\n\n`;
        }
      }

      // Data insert statements
      if (options.includeData) {
        sqlContent += "-- ==========================================\n";
        sqlContent += "-- TABLE DATA INSERTS\n";
        sqlContent += "-- ==========================================\n\n";
        for (const table of tables) {
          const { rows } = tableData[table];
          if (rows.length === 0) continue;

          sqlContent += `-- Data for public."${table}"\n`;
          for (const row of rows) {
            const cols = Object.keys(row).map(c => `"${c}"`).join(", ");
            const vals = Object.values(row).map((v) => {
              if (v === null || v === undefined) return "NULL";
              if (typeof v === "string") return `'${v.replace(/'/g, "''")}'`;
              if (v instanceof Date) return `'${v.toISOString()}'`;
              if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
              return v;
            }).join(", ");

            sqlContent += `INSERT INTO public."${table}" (${cols}) VALUES (${vals}) ON CONFLICT DO NOTHING;\n`;
          }
          sqlContent += "\n";
        }
      }

      // Auth Data (if requested)
      if (options.includeAuth && authUsers.length > 0) {
        sqlContent += "-- ==========================================\n";
        sqlContent += "-- AUTHENTICATION USER METADATA\n";
        sqlContent += "-- ==========================================\n\n";
        sqlContent += `/* auth.users exported: ${authUsers.length} records */\n`;
      }

      fs.writeFileSync(filePath, sqlContent, "utf-8");
    } else {
      // Binary package layout
      const payload = {
        metadata: {
          timestamp,
          version: "1.0",
          options,
        },
        roles,
        views,
        functions,
        auth: {
          users: authUsers,
          identities: authIdentities,
        },
        tables: tableData,
      };

      const rawString = JSON.stringify(payload);
      const compressed = zlib.gzipSync(rawString);
      fs.writeFileSync(filePath, compressed);
    }

    const stats = fs.statSync(filePath);
    tracker.progress(100, "Backup completed successfully");
    tracker.log(`Backup completed. File size: ${(stats.size / 1024).toFixed(2)} KB.`);

    return {
      filePath,
      fileName,
      sizeBytes: stats.size,
    };
  } finally {
    await client.end();
  }
}

export async function runDatabaseRestore(
  connectionString: string,
  backupFilePath: string,
  tracker: BackupProgress
): Promise<{ success: boolean; rowsRestored: number }> {
  const client = new Client({ connectionString });
  await client.connect();

  tracker.log(`Accessing backup file at: ${path.basename(backupFilePath)}`);
  tracker.progress(10, "Reading backup file contents");

  let rowsRestored = 0;

  try {
    const fileExt = backupFilePath.split(".").pop();
    const isCompressed = fileExt === "gz";

    // Disable row-level security & triggers temporarily to perform raw restore
    tracker.log("Bypassing integrity constraints & Row-Level Security temporarily...");
    await client.query("SET session_replication_role = 'replica';");

    if (!isCompressed) {
      // Direct SQL Execution
      const sql = fs.readFileSync(backupFilePath, "utf-8");
      tracker.progress(40, "Executing SQL statements");
      
      // Split script into statement blocks
      const statements = sql
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith("--"));

      let done = 0;
      for (const statement of statements) {
        done++;
        if (done % 50 === 0) {
          tracker.progress(
            40 + Math.round((done / statements.length) * 50),
            `Executing statements: ${done}/${statements.length}`
          );
        }
        await client.query(statement);
        if (statement.toLowerCase().startsWith("insert")) {
          rowsRestored++;
        }
      }
    } else {
      // Binary serialization deserializer
      const compressedData = fs.readFileSync(backupFilePath);
      const decompressed = zlib.gunzipSync(compressedData).toString("utf-8");
      const payload = JSON.parse(decompressed);

      tracker.log("Parsing serialized binary layout metadata...");

      // 1. Restore Custom Functions
      if (payload.functions && payload.functions.length > 0) {
        tracker.log(`Restoring ${payload.functions.length} functions...`);
        for (const func of payload.functions) {
          await client.query(func.definition);
        }
      }

      // 2. Restore Tables (Schema & Rows)
      const tables = Object.keys(payload.tables || {});
      let count = 0;
      for (const table of tables) {
        count++;
        tracker.progress(
          40 + Math.round((count / tables.length) * 50),
          `Importing data into: ${table}`
        );

        const tableDetails = payload.tables[table];
        if (tableDetails.schema) {
          await client.query(tableDetails.schema);
        }

        if (tableDetails.rows && tableDetails.rows.length > 0) {
          for (const row of tableDetails.rows) {
            const cols = Object.keys(row).map(c => `"${c}"`).join(", ");
            const vals = Object.values(row);
            const placeholders = vals.map((_, i) => `$${i + 1}`).join(", ");
            
            await client.query(
              `INSERT INTO public."${table}" (${cols}) VALUES (${placeholders}) ON CONFLICT DO NOTHING;`,
              vals
            );
            rowsRestored++;
          }
        }
      }

      // 3. Restore Custom Views
      if (payload.views && payload.views.length > 0) {
        tracker.log(`Restoring ${payload.views.length} database views...`);
        for (const view of payload.views) {
          await client.query(`CREATE OR REPLACE VIEW public."${view.name}" AS ${view.definition};`);
        }
      }
    }

    // Re-enable row-level security & triggers
    tracker.log("Restoring system replication controls...");
    await client.query("SET session_replication_role = 'origin';");
    
    tracker.progress(100, "Database restore finished successfully");
    tracker.log(`Import completed. Total rows imported: ${rowsRestored}`);

    return {
      success: true,
      rowsRestored,
    };
  } catch (err: any) {
    tracker.log(`RESTORE ERROR: ${err.message}`);
    // Clean replica lock even on failure
    try {
      await client.query("SET session_replication_role = 'origin';");
    } catch {}
    throw err;
  } finally {
    await client.end();
  }
}
