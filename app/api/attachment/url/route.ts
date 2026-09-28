import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/utils/supabase/server";
import { getStorageHandler } from "@/utils/storage-factory";

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
    let provider = "Supabase";
    let bucket = "attachments";

    // 1. Fetch attachment record if ID provided
    if (id) {
      const isMediaPrefix = id.startsWith("media-");
      const cleanId = isMediaPrefix ? id.replace("media-", "") : id;

      if (!isMediaPrefix && !isNaN(Number(id))) {
        const { data: attachment } = await supabase
          .from("attachment")
          .select("meta, path")
          .eq("id", Number(id))
          .maybeSingle();

        if (attachment) {
          const meta = (attachment.meta || {}) as any;
          filePath = meta?.file_path || attachment.path || filePath;
          provider = meta?.storage_provider || "Supabase";
          bucket = meta?.bucket || "attachments";
        }
      }

      // Check insp_media if not found yet
      if (!filePath && !isNaN(Number(cleanId))) {
        const { data: media } = await supabase
          .from("insp_media" as any)
          .select("file_path, meta")
          .eq("media_id", Number(cleanId))
          .maybeSingle() as any;

        if (media) {
          filePath = media.file_path;
          provider = (media.meta as any)?.storage_provider || "Supabase";
          bucket = (media.meta as any)?.bucket || "inspection-media";
        }
      }
    }

    if (!filePath) {
      console.warn(`[AttachmentURL] Record not found for id: ${id}, path: ${fallbackPath}`);
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    // Direct data URI or blob URL
    if (filePath.startsWith("data:")) {
      const parts = filePath.split(",");
      const mime = parts[0].match(/:(.*?);/)?.[1] || "image/jpeg";
      const buffer = Buffer.from(parts[1], "base64");
      return new Response(buffer, {
        status: 200,
        headers: {
          "Content-Type": mime,
          "Content-Length": buffer.length.toString(),
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // 2. Direct Supabase Storage Download (High performance & immune to CORS/domain lookup errors)
    if (provider === "Supabase" || !provider) {
      let relativePath = filePath.trim();
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
          }
        }
      }
      if (relativePath.startsWith(`${bucket}/`)) {
        relativePath = relativePath.slice(bucket.length + 1);
      } else if (relativePath.startsWith("attachments/")) {
        relativePath = relativePath.replace(/^attachments\//, "");
      }
      relativePath = decodeURIComponent(relativePath).replace(/^\/+/, "");

      let { data, error } = await supabase.storage.from(bucket).download(relativePath);

      // Fallback buckets if primary fails
      if (error || !data) {
        const altBuckets = ["attachments", "inspection-media", "company-assets", "public"].filter(b => b !== bucket);
        for (const alt of altBuckets) {
          const { data: altData, error: altErr } = await supabase.storage.from(alt).download(relativePath);
          if (!altErr && altData) {
            data = altData;
            error = null;
            break;
          }
        }
      }

      if (data && !error) {
        const buffer = await data.arrayBuffer();
        const headers = new Headers();
        headers.set("Content-Type", data.type || "image/jpeg");
        headers.set("Content-Length", data.size.toString());
        headers.set("Cache-Control", "public, max-age=86400"); // Cache for 24 hours
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        return new Response(buffer, { status: 200, headers });
      }
    }

    // 3. Resolve via Storage Handler for multi-cloud (S3, GDrive, Azure, Cloudinary)
    const { data: settings } = await supabase
      .from("company_settings" as any)
      .select("storage_provider, storage_config")
      .eq("id", 1)
      .maybeSingle() as any;

    const activeProvider = provider || settings?.storage_provider || "Supabase";
    const handler = await getStorageHandler(activeProvider, settings?.storage_config);

    const signedUrl = await handler.getSignedUrl(filePath, 3600);

    if (signedUrl.startsWith("http://") || signedUrl.startsWith("https://")) {
      const response = await fetch(signedUrl);
      if (response.ok) {
        const contentType = response.headers.get("Content-Type") || "image/jpeg";
        const contentLength = response.headers.get("Content-Length");
        const headers = new Headers();
        headers.set("Content-Type", contentType);
        if (contentLength) headers.set("Content-Length", contentLength);
        headers.set("Cache-Control", "public, max-age=3600");
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        return new Response(response.body, { status: 200, headers });
      }
    }

    // Fallback: redirect if direct fetch failed
    return NextResponse.redirect(signedUrl);
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
