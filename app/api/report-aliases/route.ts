import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { withCacheHeaders } from "@/utils/api-cache";

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data, error } = await (supabase as any)
            .from("report_aliases")
            .select("*")
            .order("template_id");

        if (error) throw error;

        // Reference data — safe to cache briefly per browser.
        return withCacheHeaders(NextResponse.json({ data }), 300);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const body = await request.json();
        const { template_id, alias } = body;
        const trimmedAlias = String(alias || "").trim();

        if (!template_id || !trimmedAlias) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const { data, error } = await (supabase as any)
            .from("report_aliases")
            .upsert({ 
                template_id, 
                alias: trimmedAlias,
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
