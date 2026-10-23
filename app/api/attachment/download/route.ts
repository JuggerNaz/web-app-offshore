import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/utils/supabase/server";
import { getStorageHandler } from "@/utils/storage-factory";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function buildFreshResponse(buffer: ArrayBuffer | Uint8Array, contentType: string, extraHeaders: Record<string, string> = {}) {
  const headers = new Headers();
  headers.set("Content-Type", contentType || "image/jpeg");
  headers.set("Content-Length", buffer.byteLength.toString());
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
  headers.set("Surrogate-Control", "no-store");
  headers.set("CDN-Cache-Control", "no-store");
  headers.set("Netlify-CDN-Cache-Control", "no-store");
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  for (const [k, v] of Object.entries(extraHeaders)) {
    headers.set(k, v);
  }
  return new Response(buffer, { status: 200, headers });
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".bmp": "image/bmp",
    ".wmv": "video/x-ms-wmv",
    ".mp4": "video/mp4",
    ".avi": "video/x-msvideo",
    ".mov": "video/quicktime",
    ".txt": "text/plain",
    ".csv": "text/csv",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  return map[ext] || "application/octet-stream";
}

function resolveLocalPath(dirOrPath: string): string | null {
  if (!dirOrPath) return null;
  const clean = dirOrPath.trim();

  try {
    if (fs.existsSync(clean) && fs.statSync(clean).isFile()) {
      return clean;
    }
  } catch {}

  const fName = path.extname(clean) ? path.basename(clean) : "";
  if (!fName) return null;

  // Alternative drive letters
  const driveLetters = ["Y:", "W:", "C:", "Z:", "D:", "E:", "X:", "V:"];
  const strippedDrive = clean.replace(/^[A-Za-z]:[\\\/]/, "");
  for (const drive of driveLetters) {
    try {
      const altFile = path.join(drive, strippedDrive);
      if (fs.existsSync(altFile) && fs.statSync(altFile).isFile()) {
        return altFile;
      }
    } catch {}
  }

  // Project code matching
  const projMatch = clean.match(/(SKO\d+[A-Z]?|PMO\d+[A-Z]?|SBA\d+[A-Z]?|SBO\d+[A-Z]?|SKATSI\d+|SKG\d+)/i);
  if (projMatch) {
    const proj = projMatch[1].toUpperCase();
    const candidateDirs = [
      path.join("Y:\\", proj, "Attach"),
      path.join("Y:\\", proj, "attach"),
      path.join("Y:\\", proj, "ATTACH"),
      path.join("Y:\\", proj, "Profile"),
      path.join("Y:\\", proj),
      path.join("W:\\", proj, "Attach"),
    ];
    for (const cDir of candidateDirs) {
      try {
        const cFile = path.join(cDir, fName);
        if (fs.existsSync(cFile) && fs.statSync(cFile).isFile()) {
          return cFile;
        }
      } catch {}
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  const useAdmin = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = useAdmin ? createAdminClient() : createClient();
  const { searchParams } = new URL(request.url);
  const pathParam = searchParams.get("path");
  let bucket = searchParams.get("bucket") || "attachments";

  if (!pathParam) {
    return NextResponse.json({ error: "Path is required" }, { status: 400 });
  }

  const storagePath = decodeURIComponent(pathParam.trim());
  const fileName = path.basename(storagePath);

  // -----------------------------------------------------------------------------------------
  // STEP 1: FIRST CHOICE - Use default Credentials configured at company_settings
  // -----------------------------------------------------------------------------------------
  let targetCompanyId = request.headers.get("x-company-id") || request.cookies.get("active_company_id")?.value;

  // Try to find tenant company_id from attachment table if present
  try {
    const { data: att } = await (supabase as any)
      .from("attachment")
      .select("id, meta, company_id")
      .eq("path", storagePath)
      .limit(1)
      .maybeSingle();
    if (att?.company_id) {
      targetCompanyId = att.company_id;
    }
  } catch (_) {}

  let settings: any = null;
  if (targetCompanyId) {
    const { data: s } = await (supabase as any)
      .from("company_settings")
      .select("storage_provider, storage_config")
      .eq("company_id", targetCompanyId)
      .maybeSingle();
    if (s) settings = s;
  }

  if (!settings?.storage_provider) {
    const { data: fallbackSettings } = await (supabase as any)
      .from("company_settings")
      .select("storage_provider, storage_config")
      .not("storage_config", "is", null)
      .filter("storage_config", "neq", "{}")
      .limit(1)
      .maybeSingle();
    if (fallbackSettings) settings = fallbackSettings;
  }

  const defaultProvider = settings?.storage_provider || "Supabase";
  const defaultStorageConfig = settings?.storage_config || {};

  try {
    if (defaultProvider.toLowerCase() === "supabase") {
      // Supabase download
      let cleanRel = storagePath
        .replace(/^[A-Za-z]:[\\\/]/, "")
        .replace(/\\/g, "/")
        .replace(/^\/+/, "")
        .replace(/\/+$/, "")
        .trim();

      if (cleanRel.startsWith(`${bucket}/`)) {
        cleanRel = cleanRel.slice(bucket.length + 1);
      } else if (cleanRel.startsWith("attachments/")) {
        cleanRel = cleanRel.replace(/^attachments\//, "");
      } else if (cleanRel.startsWith("inspection-media/")) {
        cleanRel = cleanRel.replace(/^inspection-media\//, "");
      }

      const pCandidates = [
        cleanRel,
        cleanRel.startsWith("uploads/") ? cleanRel.replace(/^uploads\//, "") : `uploads/${cleanRel}`,
        fileName,
      ].filter(p => Boolean(p) && !p.includes("\\") && !p.includes(":"));

      const bCandidates = Array.from(new Set([bucket, "attachments", "inspection-media", "company-assets", "public"]));

      for (const b of bCandidates) {
        for (const p of pCandidates) {
          try {
            const { data, error } = await supabase.storage.from(b).download(p);
            if (!error && data) {
              const arrayBuffer = await data.arrayBuffer();
              return buildFreshResponse(arrayBuffer, data.type || getMimeType(p) || "image/jpeg");
            }
          } catch {}
        }
      }
    } else {
      // Multi-cloud provider from company_settings (S3, Backblaze B2, Google Drive, OneDrive, Local, Cloudinary)
      const handler = await getStorageHandler(defaultProvider, defaultStorageConfig);
      if (typeof (handler as any).download === "function") {
        const dlResult = await (handler as any).download(storagePath);
        if (dlResult && dlResult.buffer) {
          return buildFreshResponse(dlResult.buffer, dlResult.contentType || getMimeType(storagePath) || "image/jpeg");
        }
      }

      const signedUrl = await handler.getSignedUrl(storagePath, 3600);
      if (signedUrl && (signedUrl.startsWith("http://") || signedUrl.startsWith("https://"))) {
        const resp = await fetch(signedUrl);
        if (resp.ok) {
          const buffer = await resp.arrayBuffer();
          return buildFreshResponse(buffer, resp.headers.get("Content-Type") || getMimeType(storagePath) || "image/jpeg");
        }
      }
    }
  } catch (primaryErr) {
    console.warn("[Download] Priority 1 (company_settings) retrieval failed:", primaryErr);
  }

  // -----------------------------------------------------------------------------------------
  // STEP 2: SECOND CHOICE (FALLBACK) - Fetch the file specified in the path of the attachment
  // -----------------------------------------------------------------------------------------

  // 2a. Direct fetch if already a public or accessible remote URL
  if (storagePath.startsWith("http://") || storagePath.startsWith("https://")) {
    try {
      const directResp = await fetch(storagePath);
      if (directResp.ok) {
        const buffer = await directResp.arrayBuffer();
        return buildFreshResponse(buffer, directResp.headers.get("Content-Type") || "image/jpeg");
      }
    } catch {}
  }

  // 2b. Multi-cloud URL check (e.g. backblazeb2.com or amazonaws.com in path)
  const isBackblaze = storagePath.includes("backblazeb2.com");
  const isS3 = storagePath.includes("amazonaws.com");

  if (isBackblaze || isS3) {
    try {
      const cloudProvider = isBackblaze ? "Backblaze" : "AWS S3";
      const handler = await getStorageHandler(cloudProvider, defaultStorageConfig);

      if (typeof (handler as any).download === "function") {
        const dlResult = await (handler as any).download(storagePath);
        if (dlResult && dlResult.buffer) {
          return buildFreshResponse(dlResult.buffer, dlResult.contentType || "image/jpeg");
        }
      }

      const signedUrl = await handler.getSignedUrl(storagePath, 3600);
      if (signedUrl && (signedUrl.startsWith("http://") || signedUrl.startsWith("https://")) && signedUrl !== storagePath) {
        const resp = await fetch(signedUrl);
        if (resp.ok) {
          const buffer = await resp.arrayBuffer();
          return buildFreshResponse(buffer, resp.headers.get("Content-Type") || "image/jpeg");
        }
      }
    } catch (cloudErr) {
      console.warn("[Download] Cloud handler fetch error:", cloudErr);
    }
  }

  // 2c. Local or network filesystem check (e.g. Windows Y:\, C:\, \\...)
  const isWindowsOrLocalPath =
    /^[A-Za-z]:[\\\/]/.test(storagePath) ||
    storagePath.startsWith("\\\\") ||
    storagePath.includes("\\");

  if (isWindowsOrLocalPath) {
    const localFound = resolveLocalPath(storagePath);
    if (localFound) {
      try {
        const buffer = await fs.promises.readFile(localFound);
        const mime = getMimeType(localFound);
        return buildFreshResponse(buffer, mime, {
          "Content-Disposition": `inline; filename="${encodeURIComponent(path.basename(localFound))}"`,
        });
      } catch (err) {
        console.warn("[Download] Local file read error:", err);
      }
    }
  }

  // 2d. Supabase Storage fallback across buckets
  let cleanRelPath = storagePath
    .replace(/^[A-Za-z]:[\\\/]/, "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .trim();

  if (cleanRelPath.startsWith(`${bucket}/`)) {
    cleanRelPath = cleanRelPath.slice(bucket.length + 1);
  } else if (cleanRelPath.startsWith("attachments/")) {
    cleanRelPath = cleanRelPath.replace(/^attachments\//, "");
  } else if (cleanRelPath.startsWith("inspection-media/")) {
    cleanRelPath = cleanRelPath.replace(/^inspection-media\//, "");
  }

  const pFallbacks = [
    cleanRelPath,
    cleanRelPath.startsWith("uploads/") ? cleanRelPath.replace(/^uploads\//, "") : `uploads/${cleanRelPath}`,
    fileName,
  ].filter(p => Boolean(p) && !p.includes("\\") && !p.includes(":"));

  const bFallbacks = Array.from(new Set([bucket, "attachments", "inspection-media", "company-assets", "public"]));

  for (const b of bFallbacks) {
    for (const p of pFallbacks) {
      try {
        const { data, error } = await supabase.storage.from(b).download(p);
        if (!error && data) {
          const arrayBuffer = await data.arrayBuffer();
          return buildFreshResponse(arrayBuffer, data.type || getMimeType(p) || "image/jpeg");
        }
      } catch {}
    }
  }

  // Try signed URL or public URL via Supabase Storage
  if (cleanRelPath && path.extname(cleanRelPath) && !cleanRelPath.includes("\\") && !cleanRelPath.includes(":")) {
    try {
      const { data: signedData } = await supabase.storage.from(bucket).createSignedUrl(cleanRelPath, 3600);
      const urlToFetch = signedData?.signedUrl || supabase.storage.from(bucket).getPublicUrl(cleanRelPath)?.data?.publicUrl;
      if (urlToFetch) {
        const fetchResp = await fetch(urlToFetch);
        if (fetchResp.ok) {
          const buffer = await fetchResp.arrayBuffer();
          return buildFreshResponse(buffer, fetchResp.headers.get("Content-Type") || "image/jpeg");
        }
      }
    } catch {}
  }

  return NextResponse.json(
    { error: "Attachment file not accessible", code: "NOT_FOUND" },
    {
      status: 404,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}
