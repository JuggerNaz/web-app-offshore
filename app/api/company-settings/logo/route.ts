import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { withTenant } from "@/utils/tenant-auth";

/**
 * GET /api/company-settings/logo
 * Returns the company logo image binary directly for the active tenant.
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = createClient();
        const url = new URL(request.url);
        const queryCompanyId = url.searchParams.get("company_id");
        const companyId = queryCompanyId || request.headers.get("x-company-id") || request.cookies.get("active_company_id")?.value;

        let logoPath: string | null = null;

        if (companyId) {
            const { data: settings } = await (supabase as any)
                .from("company_settings")
                .select("logo_path")
                .eq("company_id", companyId)
                .maybeSingle();

            logoPath = settings?.logo_path || null;
        }

        if (!logoPath) {
            return NextResponse.json({ error: "No logo configured for this tenant" }, { status: 404 });
        }

        // Download directly from Supabase storage using the stored path
        const { data: fileData, error: downloadError } = await supabase.storage
            .from("company-assets")
            .download(logoPath);

        if (downloadError || !fileData) {
            console.error("[Logo] Error downloading logo:", downloadError);
            return NextResponse.json({ error: "Failed to download logo" }, { status: 500 });
        }

        const buffer = await fileData.arrayBuffer();
        const ext = logoPath.split(".").pop()?.toLowerCase();
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
    } catch (error: any) {
        console.error("Error in GET /api/company-settings/logo:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * POST /api/company-settings/logo
 * Uploads a logo for the active tenant organization.
 */
export const POST = withTenant(async (request, { companyId }) => {
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

        if (!file.type.startsWith("image/")) {
            return NextResponse.json(
                { error: "File must be an image" },
                { status: 400 }
            );
        }

        if (file.size > 2 * 1024 * 1024) {
            return NextResponse.json(
                { error: "File size must be less than 2MB" },
                { status: 400 }
            );
        }

        // Store inside tenant-specific directory
        const fileExt = file.name.split(".").pop() || "png";
        const fileName = `logo-${Date.now()}.${fileExt}`;
        const filePath = `logos/${companyId}/${fileName}`;

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Delete old logo for this company if exists
        const { data: currentSettings } = await (supabase as any)
            .from("company_settings")
            .select("logo_path")
            .eq("company_id", companyId)
            .maybeSingle();

        if (currentSettings?.logo_path) {
            try {
                await supabase.storage
                    .from("company-assets")
                    .remove([currentSettings.logo_path]);
            } catch (delErr) {
                console.warn("[Logo] Old logo deletion warning:", delErr);
            }
        }

        // Upload new logo to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from("company-assets")
            .upload(filePath, buffer, {
                contentType: file.type,
                upsert: true,
            });

        if (uploadError) {
            console.error("Error uploading logo:", uploadError);
            return NextResponse.json(
                { error: "Failed to upload logo: " + uploadError.message },
                { status: 500 }
            );
        }

        // Get public URL
        const { data: publicUrlData } = supabase.storage
            .from("company-assets")
            .getPublicUrl(filePath);
        const publicUrl = publicUrlData?.publicUrl || null;

        // Update company_settings for this company
        const { data: existingSettings } = await (supabase as any)
            .from("company_settings")
            .select("id")
            .eq("company_id", companyId)
            .maybeSingle();

        if (existingSettings?.id) {
            await (supabase as any)
                .from("company_settings")
                .update({ logo_path: filePath, updated_at: new Date().toISOString() })
                .eq("id", existingSettings.id);
        } else {
            await (supabase as any)
                .from("company_settings")
                .insert({
                    company_id: companyId,
                    logo_path: filePath,
                    company_name: "Company",
                    def_unit: "METRIC",
                    storage_provider: "Supabase",
                });
        }

        // Also update public.companies.logo_url
        await (supabase as any)
            .from("companies")
            .update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
            .eq("id", companyId);

        return NextResponse.json({
            data: {
                logo_path: filePath,
                logo_url: publicUrl,
            },
        });
    } catch (error: any) {
        console.error("Error in POST /api/company-settings/logo:", error);
        return NextResponse.json(
            { error: error?.message || "Internal server error" },
            { status: 500 }
        );
    }
});

/**
 * DELETE /api/company-settings/logo
 * Removes the logo for the active tenant organization.
 */
export const DELETE = withTenant(async (request, { companyId }) => {
    try {
        const supabase = createClient();

        const { data: settings } = await (supabase as any)
            .from("company_settings")
            .select("logo_path")
            .eq("company_id", companyId)
            .maybeSingle();

        if (settings?.logo_path) {
            await supabase.storage
                .from("company-assets")
                .remove([settings.logo_path]);

            await (supabase as any)
                .from("company_settings")
                .update({ logo_path: null, updated_at: new Date().toISOString() })
                .eq("company_id", companyId);
        }

        // Also clear companies.logo_url
        await (supabase as any)
            .from("companies")
            .update({ logo_url: null, updated_at: new Date().toISOString() })
            .eq("id", companyId);

        return NextResponse.json({
            message: "Logo removed successfully",
        });
    } catch (error: any) {
        console.error("Error in DELETE /api/company-settings/logo:", error);
        return NextResponse.json(
            { error: error?.message || "Internal server error" },
            { status: 500 }
        );
    }
});
