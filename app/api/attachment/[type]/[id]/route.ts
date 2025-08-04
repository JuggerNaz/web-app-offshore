import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request, context: any) {
    const { id, type } = await context.params;

    const supabase = createClient();
    const { data, error } = await supabase.from("attachment").select("*").eq("source_id", id)
    .eq("source_type", type);

    if (error) {
        if (error.code === 'PGRST116') {
            return NextResponse.json({ error: error.message }, { status: 404 });
        }
        else if (error.code === '22P02') {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        else
            return NextResponse.json({ error: `Failed to fetch attachment for source id ${id} and source type ${type}` }, { status: 500 });
    }

    return NextResponse.json({ data })
}

export async function POST(request: Request, context: any) {
    const { id } = await context.params;
    const body = await request.json();
    const supabase = createClient();

    const { data, error } = await supabase.from("attachment").insert(body).single();

    console.log(body.file)

    const { error: uploadError } = await supabase.storage.from('attachments').upload('uploads/test.jpg', body.file)

    if (error) {
        if (error.code === 'PGRST116') {
            return NextResponse.json({ error: error.message }, { status: 404 });
        }
        else if (error.code === '22P02') {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        else
            return NextResponse.json({ error: `Failed to post attachment for structure id ${id}`}, { status: 500 });
    }

    if (uploadError) throw uploadError
    
    return NextResponse.json({ data })
}

export async function PUT(request: Request, context: any) {
    const { id } = await context.params;
    const body = await request.json();
    const supabase = createClient();

    const { data, error } = await supabase.from("attachment").update(body).eq("source_id", id).single();

    if (error) {
        if (error.code === 'PGRST116') {
            return NextResponse.json({ error: error.message }, { status: 404 });
        }
        else if (error.code === '22P02') {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        else
            return NextResponse.json({ error: `Failed to update attachment for structure id ${id}` }, { status: 500 });
    }

    return NextResponse.json({ data })
}