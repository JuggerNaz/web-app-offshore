import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request, context: any) {
    const { id } = await context.params;

    const supabase = createClient();
    const { data, error } = await supabase.from("platform").select("*").eq("plat_id", id).single();

    if (error) {
        if (error.code === 'PGRST116') {
            return NextResponse.json({ error: error.message }, { status: 404 });
        }
        else if (error.code === '22P02') {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        else
            return NextResponse.json({ error: "Failed to fetch platform" }, { status: 500 });
    }

    return NextResponse.json({ data })
}

export async function PUT(request: Request, context: any) {
    const { id } = await context.params;
    const body = await request.json();
    const supabase = createClient();

    console.log(id, body)

    const { data, error } = await supabase.from("platform").update(body).eq("plat_id", id).single();

    if (error) {
        if (error.code === 'PGRST116') {
            return NextResponse.json({ error: error.message }, { status: 404 });
        }
        else if (error.code === '22P02') {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        else
            return NextResponse.json({ error: "Failed to update platform" }, { status: 500 });
    }

    return NextResponse.json({ data })
}