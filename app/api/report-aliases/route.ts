import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data, error } = await (supabase as any)
            .from("report_aliases")
            .select("*")
            .order("template_id");

        if (error) throw error;

        return NextResponse.json({ data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const body = await request.json();
        const { template_id, alias } = body;

        if (!template_id || !alias) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const { data, error } = await (supabase as any)
            .from("report_aliases")
            .upsert({ 
                template_id, 
                alias,
                updated_at: new Date().toISOString()
            }, { 
                onConflict: 'template_id' 
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const template_id = searchParams.get("template_id");

        if (!template_id) {
            return NextResponse.json({ error: "Missing template_id" }, { status: 400 });
        }

        const { error } = await (supabase as any)
            .from("report_aliases")
            .delete()
            .eq("template_id", template_id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
