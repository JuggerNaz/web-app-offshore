import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server";

export async function GET() {
    const supabase = createClient();
    const { data, error } = await supabase.from("platform").select("*");
    
    if (error) {
        console.error(error.message);
        return NextResponse.json({ error: "Failed to fetch platform" });
    }

    return NextResponse.json({ data })
}

export async function POST(request: Request, context: any) {
    const body = await request.json();
    const supabase = createClient();

    delete body.plat_id

    const { data, error } = await supabase.from("platform").insert(body).select().single();

    const { data: structureData, error: structureError } = await supabase.from("structure").insert({ str_id: data?.plat_id!, str_type: "PLATFORM" });
    
    if (error) {
        if (error.code === 'PGRST116') {
            return NextResponse.json({ error: error.message }, { status: 404 });
        }
        else if (error.code === '22P02') {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        else
            return NextResponse.json({ error: "Failed to insert platform" }, { status: 500 });
    }

    if (structureError) {
        if (structureError.code === 'PGRST116') {
            return NextResponse.json({ error: structureError.message }, { status: 404 });
        }
        else if (structureError.code === '22P02') {
            return NextResponse.json({ error: structureError.message }, { status: 400 });
        }
        else
            return NextResponse.json({ error: "Failed to insert structure" }, { status: 500 });
    }
   
    return NextResponse.json({ data })
}