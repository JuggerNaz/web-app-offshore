import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/utils/supabase/server";
import { getStorageHandler } from "@/utils/storage-factory";
import { getCurrentUser } from "@/utils/with-auth";
import fs from "fs";
import path from "path";
import os from "os";

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

function isSafeLocalPath(candidatePath: string): boolean {
  if (!candidatePath) return false;
  const normalized = path.resolve(candidatePath);

  // Path traversal check
  if (candidatePath.includes("..")) return false;

  // Never allow reading files inside the web application codebase/working dir itself
  const cwd = path.resolve(process.cwd());
  if (normalized.toLowerCase().startsWith(cwd.toLowerCase())) {
    const safeUploads = path.resolve(cwd, "public", "uploads").toLowerCase();
    if (!normalized.toLowerCase().startsWith(safeUploads)) {
      return false;
    }
  }

  // Never allow reading system root directories
  const forbiddenDirs = [
    "c:\\windows",
    "c:\\program files",
    "c:\\program files (x86)",
    "/etc",
    "/proc",
    "/sys",
    "/var",
    "/root",
  ];
  const lowerNorm = normalized.toLowerCase();
  for (const f of forbiddenDirs) {
    if (lowerNorm.startsWith(f)) return false;
  }

  // Allowed storage roots
  const allowedRoots = [
    "y:\\", "w:\\", "z:\\", "d:\\", "e:\\", "x:\\", "v:\\",
    "c:\\offshore", "c:\\offshore10", "c:\\offshore12",
    path.join(os.homedir(), "offshoreattachments").toLowerCase()
  ];

  const hasAllowedRoot = allowedRoots.some(r => lowerNorm.startsWith(r));
  const hasAllowedFolderKeyword =
    lowerNorm.includes("\\attach") ||
    lowerNorm.includes("/attach") ||
    lowerNorm.includes("\\profile") ||
    lowerNorm.includes("/profile") ||
    lowerNorm.includes("\\drawing") ||
    lowerNorm.includes("/drawing") ||
    lowerNorm.includes("\\uploads") ||
    lowerNorm.includes("/uploads");

  return hasAllowedRoot || hasAllowedFolderKeyword;
}

function resolveLocalPath(dirOrPath: string): string | null {
  if (!dirOrPath) return null;
  const clean = dirOrPath.trim();
  if (clean.includes("..")) return null;

  const rawFName = path.extname(clean) ? path.basename(clean) : "";
  const fName = rawFName ? path.basename(rawFName) : "";
  if (fName.includes("..")) return null;

  const checkCandidate = (cand: string): string | null => {
    try {
      if (!isSafeLocalPath(cand)) return null;
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
        return cand;
      }
    } catch {}
    return null;
  };

  const direct = checkCandidate(clean);
  if (direct) return direct;

  if (!fName) return null;

  // Alternative drive letters
  const driveLetters = ["Y:", "W:", "Z:", "D:", "E:", "X:", "V:"];
  const strippedDrive = clean.replace(/^[A-Za-z]:[\\\/]/, "");
  for (const drive of driveLetters) {
    const altFile = checkCandidate(path.join(drive, strippedDrive));
    if (altFile) return altFile;
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
      const cFile = checkCandidate(path.join(cDir, fName));
      if (cFile) return cFile;
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  const authUser = await getCurrentUser();
  if (!authUser) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

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

      // Verify tenant authorization: prevent cross-tenant IDOR download
      const { data: membership } = await (supabase as any)
        .from("company_memberships")
        .select("id")
        .eq("user_id", authUser.id)
        .eq("company_id", att.company_id)
        .eq("is_active", true)
        .maybeSingle();

      if (!membership) {
        const { data: userRole } = await (supabase as any)
          .from("user_roles")
          .select("role")
          .eq("user_id", authUser.id)
          .maybeSingle();
        const role = (userRole?.role || "").toLowerCase().trim();
        const isSuperAdmin = role === "super_admin" || role === "super admin" || role === "superadmin";

        if (!isSuperAdmin) {
          return NextResponse.json(
            { error: "Access denied to attachment outside your organization", code: "FORBIDDEN" },
            { status: 403 }
          );
        }
      }
    }
  } catch (err: any) {
    if (err?.status === 403) throw err;
  }

  let settings: any = null;
  if (targetCompanyId) {
    // Verify caller has membership in targetCompanyId (or is super admin)
    const { data: targetMembership } = await (supabase as any)
      .from("company_memberships")
      .select("id")
      .eq("user_id", authUser.id)
      .eq("company_id", targetCompanyId)
      .eq("is_active", true)
      .maybeSingle();

    if (!targetMembership) {
      const { data: userRole } = await (supabase as any)
        .from("user_roles")
        .select("role")
        .eq("user_id", authUser.id)
        .maybeSingle();
      const role = (userRole?.role || "").toLowerCase().trim();
      const isSuperAdmin = role === "super_admin" || role === "super admin" || role === "superadmin";

      if (!isSuperAdmin) {
        return NextResponse.json(
          { error: "Access denied to target organization storage", code: "FORBIDDEN" },
          { status: 403 }
        );
      }
    }

    const { data: s } = await (supabase as any)
      .from("company_settings")
      .select("storage_provider, storage_config")
      .eq("company_id", targetCompanyId)
      .maybeSingle();
    if (s) settings = s;
  }

  // Never borrow storage credentials from another organization (strict tenant isolation)
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

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = new Headers({
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-company-id",
    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  });
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  return new NextResponse(null, {
    status: 204,
    headers,
  });
}
