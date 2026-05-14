import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const type = searchParams.get("type");

        let query = (supabase as any).from("report_templates").select("*");
        if (type) query = query.eq("type", type);
        
        const { data, error } = await query.order("created_at", { ascending: false });

        if (error) throw error;

        return NextResponse.json({ data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const formData = await request.formData();
        
        const file = formData.get("file") as File;
        const name = formData.get("name") as string;
        const type = formData.get("type") as string;
        const isDefault = formData.get("is_default") === "true";

        if (!file || !name || !type) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // 1. Upload to Storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${type}/${fileName}`;

        console.log(`[ReportTemplates] Uploading template to storage: bucket=report-templates, path=${filePath}`);
        const { error: uploadError } = await supabase.storage
            .from("report-templates")
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) {
            console.error("[ReportTemplates] Storage upload error:", uploadError);
            throw new Error(`Storage error: ${uploadError.message}`);
        }

        // 2. Get Public URL
        const { data: { publicUrl } } = supabase.storage
            .from("report-templates")
            .getPublicUrl(filePath);

        console.log(`[ReportTemplates] Template uploaded to: ${publicUrl}`);

        // 3. If setting as default, unset others of same type
        if (isDefault) {
            await (supabase as any)
                .from("report_templates")
                .update({ is_default: false })
                .eq("type", type);
        }

        // 4. Save to DB
        console.log(`[ReportTemplates] Saving template metadata to DB: ${name}`);
        const { data, error: dbError } = await (supabase as any)
            .from("report_templates")
            .insert({
                name,
                type,
                storage_path: publicUrl,
                is_default: isDefault,
            })
            .select()
            .single();

        if (dbError) {
            console.error("[ReportTemplates] DB insertion error:", dbError);
            throw new Error(`Database error: ${dbError.message}`);
        }

        return NextResponse.json({ data });
    } catch (error: any) {
        console.error("[ReportTemplates] Global error:", error);
        return NextResponse.json({ error: error.message || "Unknown error" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "Missing template ID" }, { status: 400 });
        }

        // 1. Get the template to find the storage path
        const { data: template, error: fetchError } = await (supabase as any)
            .from("report_templates")
            .select("*")
            .eq("id", Number(id))
            .single();

        if (fetchError || !template) {
            console.error("[ReportTemplates] Fetch error:", fetchError);
            return NextResponse.json({ error: "Template not found" }, { status: 404 });
        }

        // 2. Delete from storage
        // Extract the path from storage_path URL
        const storagePath = template.storage_path;
        const bucketName = "report-templates";
        
        // Supabase public URL structure: .../bucketName/filePath
        const pathParts = storagePath.split(`${bucketName}/`);
        if (pathParts.length > 1) {
            const filePath = pathParts[1];
            console.log(`[ReportTemplates] Deleting file from storage: ${filePath}`);
            const { error: storageError } = await supabase.storage
                .from(bucketName)
                .remove([filePath]);
            
            if (storageError) {
                console.warn("[ReportTemplates] Storage deletion warning:", storageError);
                // We continue even if storage delete fails, to ensure DB record can be cleaned up
            }
        }

        // 3. Delete from DB
        const { error: dbError } = await (supabase as any)
            .from("report_templates")
            .delete()
            .eq("id", Number(id));

        if (dbError) throw dbError;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("[ReportTemplates] DELETE error:", error);
        return NextResponse.json({ error: error.message || "Unknown error" }, { status: 500 });
    }
}
