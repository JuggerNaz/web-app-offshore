
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const path = searchParams.get("path");
    const bucket = searchParams.get("bucket") || "attachments";

    if (!path) {
        return NextResponse.json({ error: "Path is required" }, { status: 400 });
    }

    // Extract relative storage path if 'path' is a full URL
    let storagePath = path;
    // Common Supabase URL pattern: .../storage/v1/object/public/{bucket}/{path}
    // OR .../storage/v1/object/sign/{bucket}/{path}

    // Simple heuristic: split by bucket name
    if (path.includes(bucket + "/")) {
        const parts = path.split(bucket + "/");
        // Take the last part as the path (handling potential multiple occurrences of bucket name in URL unlikely but safer to take suffix)
        // Actually, standard URL .../bucket/folder/file.jpg. 
        // Split results in [prefix, folder/file.jpg].
        if (parts.length > 1) {
            storagePath = parts.slice(1).join(bucket + "/");
        }
    }

    // Decode URI component just in case
    storagePath = decodeURIComponent(storagePath);

    console.log(`[Download] Fetching ${storagePath} from bucket ${bucket}`);

    const { data, error } = await supabase.storage.from(bucket).download(storagePath);

    if (error) {
        console.error(`[Download] Error fetching ${storagePath}:`, error);
        return NextResponse.json({ error: error.message }, { status: 404 });
    }

    const buffer = await data.arrayBuffer();

    return new NextResponse(buffer, {
        headers: {
            "Content-Type": data.type,
            "Content-Length": data.size.toString(),
            // Optional: Content-Disposition for download filename
        },
    });
}
