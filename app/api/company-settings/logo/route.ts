import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/company-settings/logo
 * Returns the company logo image binary directly — used as a CORS-safe proxy
 * for report generators running in the browser (jsPDF canvas operations).
 */
export async function GET() {
    try {
        const supabase = createClient();

        // Fetch the stored logo_path from the database
        const { data: settings, error } = await supabase
            .from("company_settings" as any)
            .select("logo_path")
            .eq("id", 1)
            .single() as any;

        if (error || !settings?.logo_path) {
            return NextResponse.json({ error: "No logo configured" }, { status: 404 });
        }

        // Download directly from Supabase storage using the stored path
        const { data: fileData, error: downloadError } = await supabase.storage
            .from("company-assets")
            .download(settings.logo_path);

        if (downloadError || !fileData) {
            console.error("[Logo] Error downloading logo:", downloadError);
            return NextResponse.json({ error: "Failed to download logo" }, { status: 500 });
        }

        const buffer = await fileData.arrayBuffer();
        // Determine content type from the path extension
        const ext = settings.logo_path.split(".").pop()?.toLowerCase();
        const contentTypeMap: Record<string, string> = {
            png: "image/png",
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            gif: "image/gif",
            webp: "image/webp",
            svg: "image/svg+xml",
        };
        const contentType = contentTypeMap[ext || ""] || fileData.type || "image/png";

        return new NextResponse(buffer, {
            headers: {
                "Content-Type": contentType,
                "Content-Length": buffer.byteLength.toString(),
                "Cache-Control": "public, max-age=3600",
            },
        });
    } catch (error) {
        console.error("Error in GET /api/company-settings/logo:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const supabase = createClient();
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json(
                { error: "No file provided" },
                { status: 400 }
            );
        }

        // Validate file type
        if (!file.type.startsWith("image/")) {
            return NextResponse.json(
                { error: "File must be an image" },
                { status: 400 }
            );
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            return NextResponse.json(
                { error: "File size must be less than 2MB" },
                { status: 400 }
            );
        }

        // Generate unique filename
        const fileExt = file.name.split(".").pop();
        const fileName = `company-logo-${Date.now()}.${fileExt}`;
        const filePath = `logos/${fileName}`;

        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Delete old logo if exists
        const { data: currentSettings } = await supabase
            .from("company_settings" as any)
            .select("logo_path")
            .eq("id", 1)
            .single() as any;

        if (currentSettings?.logo_path) {
            await supabase.storage
                .from("company-assets")
                .remove([currentSettings.logo_path]);
        }

        // Upload new logo to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from("company-assets")
            .upload(filePath, buffer, {
                contentType: file.type,
                upsert: true,
            });

        if (uploadError) {
            console.error("Error uploading logo:", uploadError);
            return NextResponse.json(
                { error: "Failed to upload logo" },
                { status: 500 }
            );
        }

        // Update company_settings with new logo path
        const { data: updateData, error: updateError } = await supabase
            .from("company_settings" as any)
            .update({ logo_path: filePath })
            .eq("id", 1)
            .select()
            .single();

        if (updateError) {
            console.error("Error updating logo path:", updateError);
            return NextResponse.json(
                { error: "Failed to update logo path" },
                { status: 500 }
            );
        }

        // Get public URL
        const { data: publicUrlData } = supabase.storage
            .from("company-assets")
            .getPublicUrl(filePath);

        return NextResponse.json({
            data: {
                logo_path: filePath,
                logo_url: publicUrlData.publicUrl,
            },
        });
    } catch (error) {
        console.error("Error in POST /api/company-settings/logo:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

export async function DELETE() {
    try {
        const supabase = createClient();

        // Get current logo path
        const { data: currentSettings } = await supabase
            .from("company_settings" as any)
            .select("logo_path")
            .eq("id", 1)
            .single() as any;

        if (currentSettings?.logo_path) {
            // Delete from storage
            await supabase.storage
                .from("company-assets")
                .remove([currentSettings.logo_path]);
        }

        // Update database to remove logo path
        const { error } = await supabase
            .from("company_settings" as any)
            .update({ logo_path: null })
            .eq("id", 1);

        if (error) {
            console.error("Error removing logo:", error);
            return NextResponse.json(
                { error: "Failed to remove logo" },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error in DELETE /api/company-settings/logo:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
