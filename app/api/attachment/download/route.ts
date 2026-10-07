import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const useAdmin = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = useAdmin ? createAdminClient() : createClient();
    const { searchParams } = new URL(request.url);
    const path = searchParams.get("path");
    let bucket = searchParams.get("bucket") || "attachments";

    if (!path) {
        return NextResponse.json({ error: "Path is required" }, { status: 400 });
    }

    // Extract relative storage path if 'path' is a full URL
    let storagePath = decodeURIComponent(path.trim());

    if (storagePath.startsWith("http://") || storagePath.startsWith("https://")) {
        // Direct remote or public Supabase URL: attempt direct fetch
        try {
            const directResp = await fetch(storagePath);
            if (directResp.ok) {
                const buffer = await directResp.arrayBuffer();
                return new NextResponse(buffer, {
                    headers: {
                        "Content-Type": directResp.headers.get("Content-Type") || "image/jpeg",
                        "Content-Length": buffer.byteLength.toString(),
                        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
                    },
                });
            }
        } catch {}

        const parts = storagePath.split("/");
        const bucketIndex = parts.indexOf(bucket);
        if (bucketIndex !== -1 && bucketIndex < parts.length - 1) {
            storagePath = parts.slice(bucketIndex + 1).join("/");
        } else {
            const attIndex = parts.indexOf("attachments");
            if (attIndex !== -1 && attIndex < parts.length - 1) {
                storagePath = parts.slice(attIndex + 1).join("/");
                bucket = "attachments";
            } else {
                const inspIndex = parts.indexOf("inspection-media");
                if (inspIndex !== -1 && inspIndex < parts.length - 1) {
                    storagePath = parts.slice(inspIndex + 1).join("/");
                    bucket = "inspection-media";
                }
            }
        }
    }

    if (storagePath.startsWith(`${bucket}/`)) {
        storagePath = storagePath.slice(bucket.length + 1);
    } else if (storagePath.startsWith("attachments/")) {
        storagePath = storagePath.replace(/^attachments\//, "");
    } else if (storagePath.startsWith("inspection-media/")) {
        storagePath = storagePath.replace(/^inspection-media\//, "");
    }
    storagePath = storagePath.replace(/^\/+/, "");

    const pathVariations = [
        storagePath,
        storagePath.startsWith("uploads/") ? storagePath.replace(/^uploads\//, "") : `uploads/${storagePath}`,
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
        return new NextResponse(downloadedBuffer, {
            headers: {
                "Content-Type": contentType,
                "Content-Length": downloadedBuffer.byteLength.toString(),
                "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            },
        });
    }

    // Try signed URL or public URL via Supabase Storage
    try {
        const { data: signedData } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 3600);
        const urlToFetch = signedData?.signedUrl || supabase.storage.from(bucket).getPublicUrl(storagePath)?.data?.publicUrl;
        if (urlToFetch) {
            const fetchResp = await fetch(urlToFetch);
            if (fetchResp.ok) {
                const buffer = await fetchResp.arrayBuffer();
                return new NextResponse(buffer, {
                    headers: {
                        "Content-Type": fetchResp.headers.get("Content-Type") || "image/jpeg",
                        "Content-Length": buffer.byteLength.toString(),
                        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
                    },
                });
            }
        }
    } catch {}

    // Multi-cloud fallback (e.g. Backblaze B2, S3)
    try {
        const { getStorageHandler } = await import("@/utils/storage-factory");
        const { data: settings } = await (supabase as any)
            .from("company_settings")
            .select("storage_provider, storage_config")
            .limit(1)
            .maybeSingle();

        const provider = settings?.storage_provider || (path.includes("backblazeb2.com") ? "Backblaze" : null);
        if (provider && provider !== "Supabase") {
            const handler = await getStorageHandler(provider, settings?.storage_config);
            const signedUrl = await handler.getSignedUrl(path, 3600);
            if (signedUrl && (signedUrl.startsWith("http://") || signedUrl.startsWith("https://"))) {
                const resp = await fetch(signedUrl);
                if (resp.ok) {
                    const buffer = await resp.arrayBuffer();
                    return new NextResponse(buffer, {
                        headers: {
                            "Content-Type": resp.headers.get("Content-Type") || "image/jpeg",
                            "Content-Length": buffer.byteLength.toString(),
                            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
                            "Access-Control-Allow-Origin": "*",
                            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
                        },
                    });
                }
            }
        }
    } catch (multiCloudErr) {
        console.warn("[Download] Multi-cloud fallback error:", multiCloudErr);
    }

    console.error(`[Download] Error fetching ${storagePath} from buckets`);
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
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
