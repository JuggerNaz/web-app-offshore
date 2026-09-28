
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

    // If download fails, try alternative bucket or path variations
    if (error || !data) {
        const altBuckets = ["attachments", "inspection-media", "company-assets", "public"].filter(b => b !== bucket);
        for (const altBucket of altBuckets) {
            const { data: altData, error: altErr } = await supabase.storage.from(altBucket).download(storagePath);
            if (!altErr && altData) {
                data = altData;
                error = null;
                break;
            }
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
