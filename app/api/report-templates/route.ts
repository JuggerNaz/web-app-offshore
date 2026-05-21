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

        const { error: uploadError } = await supabase.storage
            .from("report-templates")
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        // 2. Get Public URL
        const { data: { publicUrl } } = supabase.storage
            .from("report-templates")
            .getPublicUrl(filePath);

        // 3. If setting as default, unset others of same type
        if (isDefault) {
            await (supabase as any)
                .from("report_templates")
                .update({ is_default: false })
                .eq("type", type);
        }

        // 4. Save to DB
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

        if (dbError) throw dbError;

        return NextResponse.json({ data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
