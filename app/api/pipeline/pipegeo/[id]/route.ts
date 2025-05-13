import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request, context: any) {
    const { id } = await context.params;

    const supabase = createClient();
    const { data, error } = await supabase.from("pipe_geo").select("*").eq("str_id", id).single();

    if (error) {
        if (error.code === 'PGRST116') {
            return NextResponse.json({ error: error.message }, { status: 404 });
        }
        else if (error.code === '22P02') {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        else
            return NextResponse.json({ error: "Failed to fetch pipeline pipegeo" }, { status: 500 });
    }

    return NextResponse.json({ data })
}

export async function PUT(request: Request, context: any) {
    const { id } = await context.params;
    const body = await request.json();
    const supabase = createClient();

    const { data, error } = await supabase.from("pipe_geo").update(body).eq("str_id", id).single();

    if (error) {
        if (error.code === 'PGRST116') {
            return NextResponse.json({ error: error.message }, { status: 404 });
        }
        else if (error.code === '22P02') {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        else
            return NextResponse.json({ error: "Failed to update pipeline geodetic parameters" }, { status: 500 });
    }

    return NextResponse.json({ data })
}

export async function POST(request: Request, context: any) {
    const { id } = await context.params;
    const body = await request.json();
    const supabase = createClient();

    const { data, error } = await supabase.from("pipe_geo").insert(body).single();

    if (error) {
        if (error.code === 'PGRST116') {
            return NextResponse.json({ error: error.message }, { status: 404 });
        }
        else if (error.code === '22P02') {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        else
            return NextResponse.json({ error: "Failed to insert pipeline geodetic parameters" }, { status: 500 });
    }

    return NextResponse.json({ data })
}
