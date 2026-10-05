
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/utils/supabase/server";

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
        const parts = storagePath.split("/");
        const bucketIndex = parts.indexOf(bucket);
        if (bucketIndex !== -1 && bucketIndex < parts.length - 1) {
            storagePath = parts.slice(bucketIndex + 1).join("/");
        } else {
            const attIndex = parts.indexOf("attachments");
            if (attIndex !== -1 && attIndex < parts.length - 1) {
                storagePath = parts.slice(attIndex + 1).join("/");
                bucket = "attachments";
            }
        }
    }

    if (storagePath.startsWith(`${bucket}/`)) {
        storagePath = storagePath.slice(bucket.length + 1);
    } else if (storagePath.startsWith("attachments/")) {
        storagePath = storagePath.replace(/^attachments\//, "");
    }
    storagePath = storagePath.replace(/^\/+/, "");

    let { data, error } = await supabase.storage.from(bucket).download(storagePath);

    // If Supabase storage download fails, check if multi-cloud storage (e.g. Backblaze B2, S3) is configured
    if (error || !data) {
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
                                "Cache-Control": "public, max-age=86400",
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
    }

    if (error || !data) {
        console.error(`[Download] Error fetching ${storagePath} from bucket ${bucket}:`, error);
        return NextResponse.json({ error: error?.message || "Attachment not found" }, { status: 404 });
    }

    const buffer = await data.arrayBuffer();

    return new NextResponse(buffer, {
        headers: {
            "Content-Type": data.type || "image/jpeg",
            "Content-Length": data.size.toString(),
            "Cache-Control": "public, max-age=86400",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        },
    });
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
