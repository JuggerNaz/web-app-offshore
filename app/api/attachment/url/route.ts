import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/utils/supabase/server";
import { getStorageHandler } from "@/utils/storage-factory";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

interface CachedAttachment {
  buffer: Uint8Array;
  contentType: string;
  timestamp: number;
}

const attachmentMemoryCache = new Map<string, CachedAttachment>();
const inFlightRequests = new Map<string, Promise<{ buffer: Uint8Array; contentType: string } | null>>();
const MAX_CACHE_ENTRIES = 200;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function cleanKey(val: string): string {
  return val.replace(/([?&])_t=\d+/g, "").replace(/[?&]$/, "").trim();
}

function getFromCache(key: string): CachedAttachment | null {
  const item = attachmentMemoryCache.get(key);
  if (!item) return null;
  if (Date.now() - item.timestamp > CACHE_TTL_MS) {
    attachmentMemoryCache.delete(key);
    return null;
  }
  return item;
}

function setToCache(keys: (string | null | undefined)[], buffer: Uint8Array | ArrayBuffer | Buffer, contentType: string) {
  if (attachmentMemoryCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = attachmentMemoryCache.keys().next().value;
    if (firstKey) attachmentMemoryCache.delete(firstKey);
  }
  const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const entry: CachedAttachment = { buffer: uint8, contentType, timestamp: Date.now() };
  for (const k of keys) {
    if (k) {
      const cleaned = cleanKey(k);
      if (cleaned) attachmentMemoryCache.set(cleaned, entry);
    }
  }
}

function buildCachedResponse(buffer: Uint8Array, contentType: string) {
  const headers = new Headers();
  headers.set("Content-Type", contentType || "image/jpeg");
  headers.set("Content-Length", buffer.byteLength.toString());
  headers.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
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

function resolveLocalPath(dirOrPath: string, preferredFileName: string): string | null {
  if (!dirOrPath) return null;
  const clean = dirOrPath.trim();

  // 1. Direct file check
  try {
    if (fs.existsSync(clean) && fs.statSync(clean).isFile()) {
      return clean;
    }
  } catch {}

  const fName = preferredFileName || (path.extname(clean) ? path.basename(clean) : "");
  if (!fName) return null;

  // 2. Direct join
  try {
    const joined = path.join(clean, fName);
    if (fs.existsSync(joined) && fs.statSync(joined).isFile()) {
      return joined;
    }
  } catch {}

  // 3. Alternative drive letters on host (Y:, W:, C:, Z:, D:, E:, X:, V:)
  const driveLetters = ["Y:", "W:", "C:", "Z:", "D:", "E:", "X:", "V:"];
  const strippedDrive = clean.replace(/^[A-Za-z]:[\\\/]/, "");
  for (const drive of driveLetters) {
    try {
      const altFile = path.join(drive, strippedDrive, fName);
      if (fs.existsSync(altFile) && fs.statSync(altFile).isFile()) {
        return altFile;
      }
    } catch {}
  }

  // 4. Project code matching on common network/local shares (e.g. Y:\SKO252\Attach)
  const projMatch = clean.match(/(SKO\d+[A-Z]?|PMO\d+[A-Z]?|SBA\d+[A-Z]?|SBO\d+[A-Z]?|SKATSI\d+|SKG\d+)/i);
  if (projMatch) {
    const proj = projMatch[1].toUpperCase();
    const candidateDirs = [
      path.join("Y:\\", proj, "Attach"),
      path.join("Y:\\", proj, "attach"),
      path.join("Y:\\", proj, "ATTACH"),
      path.join("Y:\\", proj, "Profile"),
      path.join("Y:\\", proj, "Drawing"),
      path.join("Y:\\", proj),
      path.join("W:\\", proj, "Attach"),
      path.join("W:\\", proj),
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

  // 5. Legacy software installation folders on C:
  const legacyAppDirs = [
    "C:\\Offshore12\\Attach",
    "C:\\Offshore10\\Attach",
    "C:\\Offshore\\Attach",
    "C:\\Offshore12\\Profile",
    "C:\\Offshore10\\Profile",
  ];
  for (const appDir of legacyAppDirs) {
    try {
      const appFile = path.join(appDir, fName);
      if (fs.existsSync(appFile) && fs.statSync(appFile).isFile()) {
        return appFile;
      }
    } catch {}
  }

  return null;
}

function renderLegacyFileNotFoundHtml({
  attachmentName,
  originalFileName,
  legacyPath,
  sourceType,
  sourceId,
}: {
  attachmentName: string;
  originalFileName: string;
  legacyPath: string;
  sourceType?: string;
  sourceId?: string | number;
}) {
  const fullPathDisplay = originalFileName && legacyPath && (legacyPath.endsWith("\\") || legacyPath.endsWith("/"))
    ? `${legacyPath}${originalFileName}`
    : legacyPath || originalFileName;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Attachment Not Accessible - Offshore System</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 16px;
      max-width: 640px;
      width: 100%;
      padding: 32px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.3);
      margin-bottom: 16px;
    }
    h1 {
      font-size: 20px;
      font-weight: 700;
      color: #f1f5f9;
      margin-bottom: 8px;
    }
    p.lead {
      font-size: 14px;
      color: #94a3b8;
      line-height: 1.5;
      margin-bottom: 24px;
    }
    .details {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 24px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .detail-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .detail-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
    }
    .detail-val {
      font-size: 13px;
      color: #e2e8f0;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      word-break: break-all;
    }
    .steps {
      background: rgba(59, 130, 246, 0.08);
      border: 1px solid rgba(59, 130, 246, 0.2);
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 24px;
    }
    .steps h2 {
      font-size: 13px;
      font-weight: 700;
      color: #93c5fd;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .steps ul {
      margin-left: 18px;
      font-size: 13px;
      color: #cbd5e1;
      line-height: 1.6;
    }
    .steps li { margin-bottom: 6px; }
    .actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }
    .btn {
      padding: 10px 18px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: none;
    }
    .btn-secondary {
      background: #334155;
      color: #f1f5f9;
    }
    .btn-secondary:hover {
      background: #475569;
    }
    .btn-primary {
      background: #2563eb;
      color: #ffffff;
    }
    .btn-primary:hover {
      background: #1d4ed8;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">
      <span>⚠️</span> Legacy Attachment
    </div>
    <h1>Attachment File Not Accessible</h1>
    <p class="lead">
      This attachment was migrated from a legacy desktop system and points to a local or network file path that is not currently mounted or accessible on the server.
    </p>

    <div class="details">
      <div class="detail-row">
        <span class="detail-label">Attachment Title</span>
        <span class="detail-val">${attachmentName || "Unknown Attachment"}</span>
      </div>
      ${originalFileName ? `
      <div class="detail-row">
        <span class="detail-label">File Name</span>
        <span class="detail-val">${originalFileName}</span>
      </div>
      ` : ""}
      <div class="detail-row">
        <span class="detail-label">Referenced Legacy Path</span>
        <span class="detail-val">${fullPathDisplay || "N/A"}</span>
      </div>
      ${sourceType ? `
      <div class="detail-row">
        <span class="detail-label">Linked Source</span>
        <span class="detail-val">${sourceType.toUpperCase()} #${sourceId || ""}</span>
      </div>
      ` : ""}
    </div>

    <div class="steps">
      <h2>How to make this file accessible:</h2>
      <ul>
        <li><strong>Option 1 (Upload File):</strong> In the Attachment Module, find this item, click <strong>Actions → Edit</strong>, and use <strong>Replace File</strong> to upload the document.</li>
        <li><strong>Option 2 (Network Mount):</strong> Ensure the referenced network drive (e.g. <code>${(legacyPath.match(/^[A-Za-z]:/)?.[0] || "V:")}</code>) is mounted and accessible on the server host.</li>
      </ul>
    </div>

    <div class="actions">
      <button class="btn btn-secondary" onclick="window.close()">Close Window</button>
      <a class="btn btn-primary" href="/dashboard/utilities/attachments">Open Attachment Module</a>
    </div>
  </div>
</body>
</html>`;
}

/**
 * GET /api/attachment/url?id=[id]&path=[path]
 * Generates/streams attachment binary or redirects to a temporary signed URL.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawId = searchParams.get("id");
  const rawPath = searchParams.get("path");
  const id = rawId ? cleanKey(rawId) : null;
  const fallbackPath = rawPath ? cleanKey(rawPath) : null;

  if (!id && !fallbackPath) {
    return NextResponse.json({ error: "Missing attachment ID or path" }, { status: 400 });
  }

  // 1. Fast-path in-memory cache check
  const lookupKeys: string[] = [];
  if (id) lookupKeys.push(`id:${id}`);
  if (fallbackPath) lookupKeys.push(`path:${fallbackPath}`);

  for (const k of lookupKeys) {
    const cached = getFromCache(k);
    if (cached) {
      return buildCachedResponse(cached.buffer, cached.contentType);
    }
  }

  // 2. In-flight request deduplication
  const primaryDedupKey = lookupKeys.join("|");
  if (inFlightRequests.has(primaryDedupKey)) {
    try {
      const inFlightResult = await inFlightRequests.get(primaryDedupKey);
      if (inFlightResult) {
        return buildCachedResponse(inFlightResult.buffer, inFlightResult.contentType);
      }
    } catch (_) {}
  }

  // Worker-owned context captured so the outer handler can build a rich 404
  // (friendly HTML page for browser navigations, structured JSON otherwise).
  type NotFoundInfo = {
    originalTitle: string;
    fileName: string;
    legacyPath: string;
    isLegacyPath: boolean;
    sourceType?: string;
    sourceId?: string | number;
  };
  // Read through explicit casts below: TypeScript's control-flow analysis cannot
  // see the assignments made inside the worker IIFE, which would otherwise narrow
  // these variables to `null` at the read sites.
  let lastNotFoundInfo: NotFoundInfo | null = null;
  let lastSignedUrlFallback: string | null = null;

  const workerPromise = (async (): Promise<{ buffer: Uint8Array; contentType: string } | null> => {
    let supabase: any;
    try {
      supabase = await createClient();
    } catch {
      supabase = createAdminClient();
    }
    
    let filePath = fallbackPath || "";
    let fileUrl: string | null = null;
    let provider = "Supabase";
    let bucket = "attachments";
    let companyId: string | null = null;
    let attachmentRecord: any = null;
    let fileName = "";
    let fileType = "";
    let originalTitle = "";
    let altPaths: string[] = [];

    // 1. Fetch attachment record if ID provided
    if (id) {
      const isMediaPrefix = id.startsWith("media-");
      const cleanId = isMediaPrefix ? id.replace("media-", "") : id;

      if (!isMediaPrefix) {
        let attQuery = (supabase as any).from("attachment").select("id, name, meta, path, company_id, source_id, source_type");
        if (!isNaN(Number(id))) {
          attQuery = attQuery.eq("id", Number(id));
        } else {
          attQuery = attQuery.eq("id", id);
        }
        const { data: attachment } = await attQuery.maybeSingle();

        if (attachment) {
          attachmentRecord = attachment;
          companyId = attachment.company_id || companyId;
          const meta = (attachment.meta || {}) as any;
          originalTitle = attachment.name || meta?.title || "";
          fileName = meta?.original_file_name || (attachment.name && attachment.name.includes(".") ? attachment.name : "");
          fileType = meta?.file_type || "";
          filePath = attachment.path || fallbackPath || meta?.file_path || filePath;
          fileUrl = (typeof attachment.path === "string" && (attachment.path.startsWith("http://") || attachment.path.startsWith("https://")) ? attachment.path : null) || (typeof fallbackPath === "string" && (fallbackPath.startsWith("http://") || fallbackPath.startsWith("https://")) ? fallbackPath : null) || meta?.file_url;
          provider = meta?.storage_provider || "Supabase";
          bucket = meta?.bucket || "attachments";
          altPaths = [attachment.path, meta?.file_url, meta?.file_path].filter((p: any) => typeof p === "string" && p.trim());
        }
      }

      // Check insp_media if not found yet
      if (!filePath && !fileUrl) {
        let mediaQuery = (supabase as any).from("insp_media").select("media_id, name, file_name, file_path, file_url, meta, company_id, inspection_id");
        if (!isNaN(Number(cleanId))) {
          mediaQuery = mediaQuery.eq("media_id", Number(cleanId));
        } else {
          mediaQuery = mediaQuery.eq("media_id", cleanId);
        }
        const { data: media } = await mediaQuery.maybeSingle();

        if (media) {
          attachmentRecord = media;
          companyId = media.company_id || companyId;
          const meta = (media.meta || {}) as any;
          originalTitle = media.name || media.file_name || "";
          fileName = media.file_name || meta?.original_file_name || "";
          fileType = meta?.file_type || "";
          filePath = media.file_path || meta?.file_path || filePath;
          fileUrl = media.file_url || meta?.file_url || (typeof media.file_path === "string" && (media.file_path.startsWith("http://") || media.file_path.startsWith("https://")) ? media.file_path : null);
          provider = meta?.storage_provider || "Supabase";
          bucket = meta?.bucket || "inspection-media";
        }
      }
    }

    if (!filePath && !fileUrl) {
      console.warn(`[AttachmentURL] Record not found for id: ${id}, path: ${fallbackPath}`);
      lastNotFoundInfo = {
        originalTitle,
        fileName,
        legacyPath: fallbackPath || id || "",
        isLegacyPath: Boolean(fallbackPath && /^[A-Za-z]:[\\/]/.test(fallbackPath)),
      };
      return null;
    }

    const targetUrlOrPath = filePath || fileUrl || "";

    // 2. Direct data URI
    if (targetUrlOrPath.startsWith("data:")) {
      const parts = targetUrlOrPath.split(",");
      const mime = parts[0].match(/:(.*?);/)?.[1] || "image/jpeg";
      const buffer = Buffer.from(parts[1], "base64");
      const uint8 = new Uint8Array(buffer);
      setToCache([...lookupKeys, `path:${targetUrlOrPath}`], uint8, mime);
      return { buffer: uint8, contentType: mime };
    }

    const isBackblaze = provider?.toLowerCase() === "backblaze" || targetUrlOrPath.includes("backblazeb2.com") || Boolean(fallbackPath && fallbackPath.includes("backblazeb2.com"));

    // Check all possible candidate URLs for direct HTTP(S) access (deduplicated)
    // Note: Skip private cloud endpoints like backblazeb2.com that require signed auth headers and will 401
    const directHttpCandidates = Array.from(
      new Set(
        [fileUrl, fallbackPath, filePath, targetUrlOrPath].filter(
          (u): u is string => typeof u === "string" && (u.startsWith("http://") || u.startsWith("https://")) && !u.includes("backblazeb2.com")
        )
      )
    );

    for (const remoteHttpUrl of directHttpCandidates) {
      try {
        const directResp = await fetch(remoteHttpUrl);
        if (directResp.ok) {
          const buffer = await directResp.arrayBuffer();
          const contentType = directResp.headers.get("Content-Type") || "image/jpeg";
          const uint8 = new Uint8Array(buffer);
          setToCache([...lookupKeys, `path:${targetUrlOrPath}`, `path:${remoteHttpUrl}`], uint8, contentType);
          return { buffer: uint8, contentType };
        }
      } catch (httpErr) {
        console.warn(`[AttachmentURL] Direct HTTP fetch failed for ${remoteHttpUrl}:`, httpErr);
      }
    }

    const isWindowsOrLocalPath =
      /^[A-Za-z]:[\\\/]/.test(targetUrlOrPath) ||
      targetUrlOrPath.startsWith("\\\\") ||
      targetUrlOrPath.includes("\\") ||
      provider?.toLowerCase() === "legacy";

    // 4. Resolve via Local Server & Mapped Network Filesystem (e.g. Y:\, C:\, W:\)
    if (isWindowsOrLocalPath) {
      const resolvedLocal = resolveLocalPath(targetUrlOrPath, fileName);
      if (resolvedLocal) {
        try {
          const buffer = await fs.promises.readFile(resolvedLocal);
          const mime = getMimeType(resolvedLocal) || fileType || "application/octet-stream";
          const uint8 = new Uint8Array(buffer);
          setToCache([...lookupKeys, `path:${targetUrlOrPath}`], uint8, mime);
          return { buffer: uint8, contentType: mime };
        } catch (readErr) {
          console.warn("[AttachmentURL] Local file read error:", readErr);
        }
      }
    }

    // 5. Direct Supabase Storage Download (with sanitized key) - only if NOT Backblaze
    if (!isBackblaze && (provider === "Supabase" || !provider || isWindowsOrLocalPath)) {
      let relativePath = targetUrlOrPath.trim();
      if (relativePath.startsWith("http://") || relativePath.startsWith("https://")) {
        const parts = relativePath.split("/");
        const bucketIndex = parts.indexOf(bucket);
        if (bucketIndex !== -1 && bucketIndex < parts.length - 1) {
          relativePath = parts.slice(bucketIndex + 1).join("/");
        } else {
          const attIndex = parts.indexOf("attachments");
          if (attIndex !== -1 && attIndex < parts.length - 1) {
            relativePath = parts.slice(attIndex + 1).join("/");
            bucket = "attachments";
          } else {
            const inspIndex = parts.indexOf("inspection-media");
            if (inspIndex !== -1 && inspIndex < parts.length - 1) {
              relativePath = parts.slice(inspIndex + 1).join("/");
              bucket = "inspection-media";
            }
          }
        }
      }

      // Sanitize Windows drive letters & backslashes for Supabase S3 storage keys
      relativePath = relativePath
        .replace(/^[A-Za-z]:[\\\/]/, "")
        .replace(/\\/g, "/")
        .replace(/^\/+/, "")
        .replace(/\/+$/, "")
        .trim();

      if (relativePath.startsWith(`${bucket}/`)) {
        relativePath = relativePath.slice(bucket.length + 1);
      } else if (relativePath.startsWith("attachments/")) {
        relativePath = relativePath.replace(/^attachments\//, "");
      } else if (relativePath.startsWith("inspection-media/")) {
        relativePath = relativePath.replace(/^inspection-media\//, "");
      }
      relativePath = decodeURIComponent(relativePath).replace(/^\/+/, "");

      const pathVariations: string[] = [];
      if (fileName) {
        if (relativePath && !relativePath.endsWith(fileName)) {
          pathVariations.push(`${relativePath}/${fileName}`);
        }
        pathVariations.push(fileName);
        pathVariations.push(`uploads/${fileName}`);
        if (attachmentRecord?.source_id) {
          pathVariations.push(`${attachmentRecord.source_id}/${fileName}`);
        }
        if (id) {
          pathVariations.push(`${id}/${fileName}`);
        }
      }
      if (relativePath) {
        pathVariations.push(relativePath);
        pathVariations.push(relativePath.startsWith("uploads/") ? relativePath.replace(/^uploads\//, "") : `uploads/${relativePath}`);
      }

      const cleanPathVariations = Array.from(new Set(pathVariations.filter(Boolean)));
      const bucketVariations = Array.from(new Set([bucket, "attachments", "inspection-media", "company-assets", "public"]));

      let downloadedBuffer: ArrayBuffer | null = null;
      let contentType = fileType || "image/jpeg";

      for (const b of bucketVariations) {
        for (const p of cleanPathVariations) {
          // Skip keys that still contain Windows backslashes or colons
          if (p.includes("\\") || p.includes(":")) continue;
          try {
            const { data, error } = await supabase.storage.from(b).download(p);
            if (!error && data) {
              downloadedBuffer = await data.arrayBuffer();
              contentType = data.type || getMimeType(p) || "image/jpeg";
              break;
            }
          } catch {}
        }
        if (downloadedBuffer) break;
      }

      if (downloadedBuffer) {
        const uint8 = new Uint8Array(downloadedBuffer);
        setToCache([...lookupKeys, `path:${targetUrlOrPath}`], uint8, contentType);
        return { buffer: uint8, contentType };
      }

      // Try signed URL or public URL via Supabase Storage ONLY if key has an extension and no Windows separators
      if (relativePath && path.extname(relativePath) && !relativePath.includes("\\") && !relativePath.includes(":")) {
        try {
          const { data: signedData } = await supabase.storage.from(bucket).createSignedUrl(relativePath, 3600);
          const urlToFetch = signedData?.signedUrl || supabase.storage.from(bucket).getPublicUrl(relativePath)?.data?.publicUrl;
          if (urlToFetch) {
            const fetchResp = await fetch(urlToFetch);
            if (fetchResp.ok) {
              const buffer = await fetchResp.arrayBuffer();
              const ct = fetchResp.headers.get("Content-Type") || "image/jpeg";
              const uint8 = new Uint8Array(buffer);
              setToCache([...lookupKeys, `path:${targetUrlOrPath}`], uint8, ct);
              return { buffer: uint8, contentType: ct };
            }
          }
        } catch {}
      }
    }

    // 6. Resolve via Storage Handler for multi-cloud (Backblaze B2, S3, GDrive, Azure, Cloudinary)
    let settings: any = null;
    if (!isBackblaze) {
      let settingsQuery = (supabase as any).from("company_settings").select("storage_provider, storage_config");
      const targetCompanyId = companyId || request.headers.get("x-company-id") || request.cookies.get("active_company_id")?.value;
      if (targetCompanyId) {
        settingsQuery = settingsQuery.eq("company_id", targetCompanyId);
      }
      const { data: sData } = await settingsQuery.limit(1).maybeSingle();
      settings = sData;

      if (!settings?.storage_config || Object.keys(settings.storage_config).length === 0) {
        try {
          const { data: fallbackSettings } = await (supabase as any)
            .from("company_settings")
            .select("storage_provider, storage_config")
            .not("storage_config", "is", null)
            .filter("storage_config", "neq", "{}")
            .limit(1)
            .maybeSingle();
          if (fallbackSettings?.storage_config && Object.keys(fallbackSettings.storage_config).length > 0) {
            settings = fallbackSettings;
          }
        } catch (_) {}
      }
    }

    try {
      let activeProvider = provider || settings?.storage_provider;
      if (isBackblaze) {
        activeProvider = "Backblaze";
      } else if (targetUrlOrPath.includes("amazonaws.com") || (fallbackPath && fallbackPath.includes("amazonaws.com"))) {
        activeProvider = "AWS S3";
      }
      if (!activeProvider) activeProvider = "Supabase";

      const handler = await getStorageHandler(activeProvider, settings?.storage_config || {});

      // 1. Direct server-side download (Immune to CORS, zero redirects, fastest)
      if (typeof (handler as any).download === "function") {
        const dlCandidates = Array.from(new Set([targetUrlOrPath, ...altPaths].filter(Boolean)));
        for (const candidate of dlCandidates) {
          try {
            const dlResult = await (handler as any).download(candidate);
            if (dlResult && dlResult.buffer) {
              const ct = dlResult.contentType || "image/jpeg";
              const uint8 = dlResult.buffer instanceof Uint8Array ? dlResult.buffer : new Uint8Array(dlResult.buffer);
              setToCache([...lookupKeys, `path:${targetUrlOrPath}`], uint8, ct);
              return { buffer: uint8, contentType: ct };
            }
          } catch (dlErr) {
            console.warn("[AttachmentURL] Handler direct download error:", dlErr);
          }
        }
      }

      // 2. Presigned URL + server proxy
      const signedUrl = await handler.getSignedUrl(targetUrlOrPath, 3600);

      if (signedUrl && (signedUrl.startsWith("http://") || signedUrl.startsWith("https://"))) {
        try {
          const response = await fetch(signedUrl);
          if (response.ok) {
            const buffer = await response.arrayBuffer();
            const ct = response.headers.get("Content-Type") || "image/jpeg";
            const uint8 = new Uint8Array(buffer);
            setToCache([...lookupKeys, `path:${targetUrlOrPath}`], uint8, ct);
            return { buffer: uint8, contentType: ct };
          } else {
            console.warn(`[AttachmentURL] Signed URL fetch returned status ${response.status}`);
            lastSignedUrlFallback = signedUrl;
          }
        } catch (streamErr) {
          console.warn("[AttachmentURL] Stream fetch error on signed URL:", streamErr);
          lastSignedUrlFallback = signedUrl;
        }
      }
    } catch (storageErr: any) {
      console.warn("[AttachmentURL] Storage handler error:", storageErr?.message || storageErr);
    }

    lastNotFoundInfo = {
      originalTitle,
      fileName,
      legacyPath: targetUrlOrPath,
      isLegacyPath: isWindowsOrLocalPath,
      sourceType: attachmentRecord?.source_type,
      sourceId: attachmentRecord?.source_id,
    };
    return null;
  })();

  inFlightRequests.set(primaryDedupKey, workerPromise);
  try {
    const result = await workerPromise;
    if (result) {
      return buildCachedResponse(result.buffer, result.contentType);
    }
    // 7. If file cannot be found/accessed: Return friendly HTML page for browser tabs, or clean JSON 404
    const acceptHeader = request.headers.get("accept") || "";
    const isHtmlRequest = acceptHeader.includes("text/html");

    // Fallback (from dev_adrian): if the server-side proxy could not fetch the presigned
    // URL, let the client try the signed URL directly.
    if (lastSignedUrlFallback && !isHtmlRequest) {
      return NextResponse.redirect(lastSignedUrlFallback);
    }

    if (isHtmlRequest) {
      const info = lastNotFoundInfo as NotFoundInfo | null;
      const html = renderLegacyFileNotFoundHtml({
        attachmentName: info?.originalTitle || "Attachment",
        originalFileName: info?.fileName || "",
        legacyPath: info?.legacyPath || fallbackPath || id || "",
        sourceType: info?.sourceType,
        sourceId: info?.sourceId,
      });

      return new Response(html, {
        status: 404,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store, max-age=0",
        },
      });
    }

    const notFound = lastNotFoundInfo as NotFoundInfo | null;
    return NextResponse.json({
      error: "Attachment file not accessible",
      code: "FILE_NOT_FOUND",
      name: notFound?.originalTitle || "",
      fileName: notFound?.fileName || "",
      path: notFound?.legacyPath || fallbackPath || "",
      isLegacyPath: notFound?.isLegacyPath ?? false,
      message: "The physical file is not accessible on the server or cloud storage bucket.",
    }, { status: 404 });
  } catch (err: any) {
    console.error(`[AttachmentURL] Exception:`, err);
    return NextResponse.json({ error: `Failed to resolve attachment URL: ${err.message}` }, { status: 500 });
  } finally {
    inFlightRequests.delete(primaryDedupKey);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
