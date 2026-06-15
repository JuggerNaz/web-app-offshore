import { NextRequest, NextResponse } from "next/server";
import { runDatabaseRestore } from "@/utils/backup-helper";
import { createClient } from "@/utils/supabase/server";
import fs from "fs";
import path from "path";

export const maxDuration = 300; // Allow 5 minutes

const backupsDir = path.join(process.cwd(), "backups");

// GET: List all local backup files
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  if (!fs.existsSync(backupsDir)) {
    return NextResponse.json({ data: [] });
  }

  try {
    const files = fs.readdirSync(backupsDir);
    const backupFiles = files
      .filter((file) => file.startsWith("backup_"))
      .map((file) => {
        const filePath = path.join(backupsDir, file);
        const stats = fs.statSync(filePath);
        return {
          fileName: file,
          sizeBytes: stats.size,
          createdAt: stats.birthtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ data: backupFiles });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Execute restore from selected file
export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = await request.json();
  } catch (err) {
    return NextResponse.json({ error: "Invalid JSON body payload" }, { status: 400 });
  }

  const { fileName } = payload;
  if (!fileName) {
    return NextResponse.json({ error: "Missing backup fileName to restore" }, { status: 400 });
  }

  const filePath = path.join(backupsDir, fileName);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Selected backup file does not exist locally" }, { status: 404 });
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return NextResponse.json({ error: "DATABASE_URL environment variable is missing on server" }, { status: 500 });
  }

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

  // Run restore pipeline asynchronously
  (async () => {
    try {
      const result = await runDatabaseRestore(connectionString, filePath, {
        log: (msg) => {
          sendEvent("log", msg);
        },
        progress: (percent, label) => {
          sendEvent("progress", { percent, label });
        },
      });

      await sendEvent("complete", {
        success: result.success,
        rowsRestored: result.rowsRestored,
        message: "Database restore completed successfully!",
      });
    } catch (err: any) {
      console.error("Restore pipeline failed:", err);
      await sendEvent("error", err.message || "An unexpected error occurred during database restore.");
    } finally {
      await writer.close();
    }
  })();

  return new NextResponse(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

// DELETE: Delete a backup file
export async function DELETE(request: NextRequest) {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const fileName = searchParams.get("fileName");

  if (!fileName) {
    return NextResponse.json({ error: "Missing fileName parameter" }, { status: 400 });
  }

  const filePath = path.join(backupsDir, fileName);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Backup file does not exist" }, { status: 404 });
  }

  try {
    fs.unlinkSync(filePath);
    return NextResponse.json({ success: true, message: "Backup file deleted" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
