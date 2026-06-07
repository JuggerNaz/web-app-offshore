import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const sectionId = searchParams.get("section_id");
    const clientName = searchParams.get("client_name");

    const supabase = createClient() as any;
    let query = supabase.from("exec_summary_templates").select("*");

    if (sectionId) {
        query = query.eq("section_id", sectionId);
    }
    if (clientName) {
        query = query.eq("client_name", clientName);
    }

    const { data, error } = await query.order("template_name", { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
}

export async function POST(request: Request) {
    const body = await request.json();
    const { template_name, section_id, content, client_name, metadata } = body;

    if (!template_name || !section_id || !content) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createClient() as any;
    const { data, error } = await supabase.from("exec_summary_templates").insert({
        template_name,
        section_id,
        content,
        client_name,
        metadata: metadata || {}
    }).select().single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
}

export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
        return NextResponse.json({ error: "Missing ID" }, { status: 400 });
    }

    const supabase = createClient() as any;
    const { error } = await supabase.from("exec_summary_templates").delete().eq("id", id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
