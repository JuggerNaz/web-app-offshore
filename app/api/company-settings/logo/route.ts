import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

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
