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

    // 1. Direct fetch if already a public or accessible remote URL
    if (storagePath.startsWith("http://") || storagePath.startsWith("https://")) {
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
    }

    // 2. Multi-cloud check: If path points to Backblaze B2, S3, or external storage, use StorageHandler directly
    const isBackblaze = storagePath.includes("backblazeb2.com");
    const isS3 = storagePath.includes("amazonaws.com");

    if (isBackblaze || isS3) {
        try {
            const { getStorageHandler } = await import("@/utils/storage-factory");
            let targetCompanyId = request.headers.get("x-company-id") || request.cookies.get("active_company_id")?.value;

            // Check attachment record for tenant company_id and metadata
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

            let settingsQuery = (supabase as any).from("company_settings").select("storage_provider, storage_config");
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

            const cloudProvider = isBackblaze ? "Backblaze" : "AWS S3";
            const handler = await getStorageHandler(cloudProvider, settings?.storage_config || {});

            // Direct buffer download
            if (typeof (handler as any).download === "function") {
                const dlResult = await (handler as any).download(storagePath);
                if (dlResult && dlResult.buffer) {
                    return new NextResponse(dlResult.buffer, {
                        headers: {
                            "Content-Type": dlResult.contentType || "image/jpeg",
                            "Content-Length": dlResult.buffer.length.toString(),
                            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
                            "Access-Control-Allow-Origin": "*",
                            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
                        },
                    });
                }
            }

            // Presigned URL fallback
            const signedUrl = await handler.getSignedUrl(storagePath, 3600);
            if (signedUrl && (signedUrl.startsWith("http://") || signedUrl.startsWith("https://")) && signedUrl !== storagePath) {
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
        } catch (cloudErr) {
            console.warn("[Download] Cloud handler fetch error:", cloudErr);
        }
    }

    // 3. Extract relative storage path for Supabase Storage
    if (storagePath.startsWith("http://") || storagePath.startsWith("https://")) {
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

    // 4. Multi-cloud fallback (e.g. Backblaze B2, S3, Local)
    try {
        const { getStorageHandler } = await import("@/utils/storage-factory");
        let { data: settings } = await (supabase as any)
            .from("company_settings")
            .select("storage_provider, storage_config")
            .not("storage_config", "is", null)
            .filter("storage_config", "neq", "{}")
            .limit(1)
            .maybeSingle();

        const provider = settings?.storage_provider || (path.includes("backblazeb2.com") ? "Backblaze" : null);
        if (provider && provider !== "Supabase") {
            const handler = await getStorageHandler(provider, settings?.storage_config);
            if (typeof (handler as any).download === "function") {
                const dlResult = await (handler as any).download(path);
                if (dlResult && dlResult.buffer) {
                    return new NextResponse(dlResult.buffer, {
                        headers: {
                            "Content-Type": dlResult.contentType || "image/jpeg",
                            "Content-Length": dlResult.buffer.length.toString(),
                            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
                            "Access-Control-Allow-Origin": "*",
                            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
                        },
                    });
                }
            }
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
