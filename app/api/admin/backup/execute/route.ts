import { NextRequest, NextResponse } from "next/server";
import { runDatabaseBackup, BackupOptions } from "@/utils/backup-helper";
import { createClient } from "@/utils/supabase/server";

export const maxDuration = 300; // Allow 5 minutes on Vercel/Next.js

export async function POST(request: NextRequest) {
  // 1. Authenticate user request
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  // 2. Validate parameters
  let payload: any;
  try {
    payload = await request.json();
  } catch (err) {
    return NextResponse.json({ error: "Invalid JSON body payload" }, { status: 400 });
  }

  const { format, includeSchema, includeData, includeViews, includeFunctions, includeAuth, includeRoles } = payload;
  
  if (!format || !["sql", "binary"].includes(format)) {
    return NextResponse.json({ error: "Missing or invalid backup format selection" }, { status: 400 });
  }

  const options: BackupOptions = {
    format,
    includeSchema: !!includeSchema,
    includeData: !!includeData,
    includeViews: !!includeViews,
    includeFunctions: !!includeFunctions,
    includeAuth: !!includeAuth,
    includeRoles: !!includeRoles,
  };

  // 3. Resolve target database connection URL string
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return NextResponse.json({ error: "DATABASE_URL environment variable is missing on server" }, { status: 500 });
  }

  // 4. Setup Server Sent Events SSE Stream
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const sendEvent = async (type: "log" | "progress" | "complete" | "error", data: any) => {
    try {
      const payloadString = JSON.stringify({ type, data });
      await writer.write(encoder.encode(`${payloadString}\n`));
    } catch (err) {
      console.error("Stream write error:", err);
    }
  };

  // Run async backup pipeline
  (async () => {
    try {
      const stats = await runDatabaseBackup(connectionString, options, {
        log: (msg) => {
          sendEvent("log", msg);
        },
        progress: (percent, label) => {
          sendEvent("progress", { percent, label });
        },
      });

      await sendEvent("complete", {
        fileName: stats.fileName,
        sizeBytes: stats.sizeBytes,
        message: "Database backup file created successfully!",
      });
    } catch (err: any) {
      console.error("Backup execution failed:", err);
      await sendEvent("error", err.message || "An unexpected error occurred during backup extraction.");
    } finally {
      try {
        await writer.close();
      } catch (_) {}
    }
  })().catch(err => {
    console.error("[Backup Execute Process Guard]:", err);
  });

  return new NextResponse(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
