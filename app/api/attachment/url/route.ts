import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/utils/supabase/server";
import { getStorageHandler } from "@/utils/storage-factory";

export const dynamic = "force-dynamic";

/**
 * GET /api/attachment/url?id=[id]&path=[path]
 * Generates/streams attachment binary or redirects to a temporary signed URL.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const fallbackPath = searchParams.get("path");

  if (!id && !fallbackPath) {
    return NextResponse.json({ error: "Missing attachment ID or path" }, { status: 400 });
  }

  try {
    const useAdmin = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = useAdmin ? createAdminClient() : createClient();
    
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
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    const targetUrlOrPath = filePath || fileUrl || "";

    // Direct data URI
    if (targetUrlOrPath.startsWith("data:")) {
      const parts = targetUrlOrPath.split(",");
      const mime = parts[0].match(/:(.*?);/)?.[1] || "image/jpeg";
      const buffer = Buffer.from(parts[1], "base64");
      return new Response(buffer, {
        status: 200,
        headers: {
          "Content-Type": mime,
          "Content-Length": buffer.length.toString(),
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Direct HTTP(S) stream attempt
    if (targetUrlOrPath.startsWith("http://") || targetUrlOrPath.startsWith("https://")) {
      try {
        const directResp = await fetch(targetUrlOrPath);
        if (directResp.ok) {
          const buffer = await directResp.arrayBuffer();
          const headers = new Headers();
          headers.set("Content-Type", directResp.headers.get("Content-Type") || "image/jpeg");
          headers.set("Content-Length", buffer.byteLength.toString());
          headers.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
          headers.set("Access-Control-Allow-Origin", "*");
          headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
          return new Response(buffer, { status: 200, headers });
        }
      } catch {}
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
        const headers = new Headers();
        headers.set("Content-Type", contentType);
        headers.set("Content-Length", downloadedBuffer.byteLength.toString());
        headers.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        return new Response(downloadedBuffer, { status: 200, headers });
      }

      // Try signed URL or public URL via Supabase Storage
      try {
        const { data: signedData } = await supabase.storage.from(bucket).createSignedUrl(relativePath, 3600);
        const urlToFetch = signedData?.signedUrl || supabase.storage.from(bucket).getPublicUrl(relativePath)?.data?.publicUrl;
        if (urlToFetch) {
          const fetchResp = await fetch(urlToFetch);
          if (fetchResp.ok) {
            const buffer = await fetchResp.arrayBuffer();
            const headers = new Headers();
            headers.set("Content-Type", fetchResp.headers.get("Content-Type") || "image/jpeg");
            headers.set("Content-Length", buffer.byteLength.toString());
            headers.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
            headers.set("Access-Control-Allow-Origin", "*");
            return new Response(buffer, { status: 200, headers });
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
    const { data: settings } = await settingsQuery.limit(1).maybeSingle();

    const activeProvider = provider || settings?.storage_provider || "Supabase";
    const handler = await getStorageHandler(activeProvider, settings?.storage_config);

    const signedUrl = await handler.getSignedUrl(targetUrlOrPath, 3600);

    if (signedUrl && (signedUrl.startsWith("http://") || signedUrl.startsWith("https://"))) {
      try {
        const response = await fetch(signedUrl);
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          const contentType = response.headers.get("Content-Type") || "image/jpeg";
          const headers = new Headers();
          headers.set("Content-Type", contentType);
          headers.set("Content-Length", buffer.byteLength.toString());
          headers.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
          headers.set("Access-Control-Allow-Origin", "*");
          headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
          return new Response(buffer, { status: 200, headers });
        }
      } catch (streamErr) {
        console.warn("[AttachmentURL] Stream fetch error on signed URL:", streamErr);
      }

      // Fallback: redirect if direct fetch failed
      return NextResponse.redirect(signedUrl);
    }

    return NextResponse.json({ error: "Unable to retrieve attachment file" }, { status: 404 });
  } catch (err: any) {
    console.error(`[AttachmentURL] Exception:`, err);
    return NextResponse.json({ error: `Failed to resolve attachment URL: ${err.message}` }, { status: 500 });
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
