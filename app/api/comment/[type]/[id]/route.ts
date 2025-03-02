import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request, context: any) {
    const { id, type } = context.params;

    const supabase = createClient();
    const { data, error } = await supabase.from("comment").select("*").eq("structure_id", id)
    .eq("structure_type", type);

    if (error) {
        if (error.code === 'PGRST116') {
            return NextResponse.json({ error: error.message }, { status: 404 });
        }
        else if (error.code === '22P02') {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        else
            return NextResponse.json({ error: `Failed to fetch comment for structure id ${id}` }, { status: 500 });
    }

    return NextResponse.json({ data })
}

export async function POST(request: Request, context: any) {
    const { id } = context.params;
    const body = await request.json();
    const supabase = createClient();

    const { data, error } = await supabase.from("comment").insert(body).single();

    if (error) {
        if (error.code === 'PGRST116') {
            return NextResponse.json({ error: error.message }, { status: 404 });
        }
        else if (error.code === '22P02') {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        else
            return NextResponse.json({ error: `Failed to post comment for structure id ${id}` }, { status: 500 });
    }
    
    return NextResponse.json({ data })
}

export async function PUT(request: Request, context: any) {
    const { id } = context.params;
    const body = await request.json();
    const supabase = createClient();

    const { data, error } = await supabase.from("comment").update(body).eq("structure_id", id).single();

    if (error) {
        if (error.code === 'PGRST116') {
            return NextResponse.json({ error: error.message }, { status: 404 });
        }
        else if (error.code === '22P02') {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        else
            return NextResponse.json({ error: `Failed to update comment for structure id ${id}` }, { status: 500 });
    }

    return NextResponse.json({ data })
}