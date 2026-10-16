import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/utils/supabase/server";
import { getStorageHandler } from "@/utils/storage-factory";

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

    // 1. Fetch attachment record if ID provided
    if (id) {
      const isMediaPrefix = id.startsWith("media-");
      const cleanId = isMediaPrefix ? id.replace("media-", "") : id;

      if (!isMediaPrefix) {
        let attQuery = (supabase as any).from("attachment").select("meta, path, company_id");
        if (!isNaN(Number(id))) {
          attQuery = attQuery.eq("id", Number(id));
        } else {
          attQuery = attQuery.eq("id", id);
        }
        const { data: attachment } = await attQuery.maybeSingle();

        if (attachment) {
          companyId = attachment.company_id || companyId;
          const meta = (attachment.meta || {}) as any;
          filePath = meta?.file_path || attachment.path || filePath;
          fileUrl = meta?.file_url || (typeof attachment.path === "string" && (attachment.path.startsWith("http://") || attachment.path.startsWith("https://")) ? attachment.path : null);
          provider = meta?.storage_provider || "Supabase";
          bucket = meta?.bucket || "attachments";
        }
      }

      // Check insp_media if not found yet
      if (!filePath) {
        let mediaQuery = (supabase as any).from("insp_media").select("file_path, file_url, meta, company_id");
        if (!isNaN(Number(cleanId))) {
          mediaQuery = mediaQuery.eq("media_id", Number(cleanId));
        } else {
          mediaQuery = mediaQuery.eq("media_id", cleanId);
        }
        const { data: media } = await mediaQuery.maybeSingle();

        if (media) {
          companyId = media.company_id || companyId;
          const meta = (media.meta || {}) as any;
          filePath = media.file_path || meta?.file_path || filePath;
          fileUrl = media.file_url || meta?.file_url || (typeof media.file_path === "string" && (media.file_path.startsWith("http://") || media.file_path.startsWith("https://")) ? media.file_path : null);
          provider = meta?.storage_provider || "Supabase";
          bucket = meta?.bucket || "inspection-media";
        }
      }
    }

    if (!filePath && !fileUrl) {
      console.warn(`[AttachmentURL] Record not found for id: ${id}, path: ${fallbackPath}`);
      return null;
    }

    const targetUrlOrPath = filePath || fileUrl || "";

    // Direct data URI
    if (targetUrlOrPath.startsWith("data:")) {
      const parts = targetUrlOrPath.split(",");
      const mime = parts[0].match(/:(.*?);/)?.[1] || "image/jpeg";
      const buffer = Buffer.from(parts[1], "base64");
      const uint8 = new Uint8Array(buffer);
      setToCache([...lookupKeys, `path:${targetUrlOrPath}`], uint8, mime);
      return { buffer: uint8, contentType: mime };
    }

    // Check all possible candidate URLs for direct HTTP(S) access (deduplicated)
    const directHttpCandidates = Array.from(
      new Set(
        [fileUrl, fallbackPath, filePath, targetUrlOrPath].filter(
          (u): u is string => typeof u === "string" && (u.startsWith("http://") || u.startsWith("https://"))
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

    // 2. Direct Supabase Storage Download (if provider is Supabase)
    if (provider === "Supabase" || !provider) {
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

      if (relativePath.startsWith(`${bucket}/`)) {
        relativePath = relativePath.slice(bucket.length + 1);
      } else if (relativePath.startsWith("attachments/")) {
        relativePath = relativePath.replace(/^attachments\//, "");
      } else if (relativePath.startsWith("inspection-media/")) {
        relativePath = relativePath.replace(/^inspection-media\//, "");
      }
      relativePath = decodeURIComponent(relativePath).replace(/^\/+/, "");

      const pathVariations = [
        relativePath,
        relativePath.startsWith("uploads/") ? relativePath.replace(/^uploads\//, "") : `uploads/${relativePath}`,
      ].filter(Boolean);

      const bucketVariations = Array.from(new Set([bucket, "attachments", "inspection-media", "company-assets", "public"]));

      let downloadedBuffer: ArrayBuffer | null = null;
      let contentType = "image/jpeg";

      for (const b of bucketVariations) {
        for (const p of pathVariations) {
          try {
            const { data, error } = await supabase.storage.from(b).download(p);
            if (!error && data) {
              downloadedBuffer = await data.arrayBuffer();
              contentType = data.type || "image/jpeg";
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

      // Try signed URL or public URL via Supabase Storage
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

    // 3. Resolve via Storage Handler for multi-cloud (Backblaze B2, S3, GDrive, Azure, Cloudinary)
    let settingsQuery = (supabase as any).from("company_settings").select("storage_provider, storage_config");
    const targetCompanyId = companyId || request.headers.get("x-company-id") || request.cookies.get("active_company_id")?.value;
    if (targetCompanyId) {
      settingsQuery = settingsQuery.eq("company_id", targetCompanyId);
    }
    let { data: settings } = await settingsQuery.limit(1).maybeSingle();

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

    try {
      let activeProvider = provider || settings?.storage_provider;
      if (targetUrlOrPath.includes("backblazeb2.com") || (fallbackPath && fallbackPath.includes("backblazeb2.com"))) {
        activeProvider = "Backblaze";
      } else if (targetUrlOrPath.includes("amazonaws.com") || (fallbackPath && fallbackPath.includes("amazonaws.com"))) {
        activeProvider = "AWS S3";
      }
      if (!activeProvider) activeProvider = "Supabase";

      const handler = await getStorageHandler(activeProvider, settings?.storage_config || {});

      // 1. Direct server-side download (Immune to CORS, zero redirects, fastest)
      if (typeof (handler as any).download === "function") {
        try {
          const dlResult = await (handler as any).download(targetUrlOrPath);
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
          }
        } catch (streamErr) {
          console.warn("[AttachmentURL] Stream fetch error on signed URL:", streamErr);
        }
      }
    } catch (storageErr: any) {
      console.warn("[AttachmentURL] Storage handler error:", storageErr?.message || storageErr);
    }

    return null;
  })();

  inFlightRequests.set(primaryDedupKey, workerPromise);
  try {
    const result = await workerPromise;
    if (result) {
      return buildCachedResponse(result.buffer, result.contentType);
    }
    return NextResponse.json({ error: "Unable to retrieve attachment file" }, { status: 404 });
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
