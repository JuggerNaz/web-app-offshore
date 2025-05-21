import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server";

export async function POST(request: Request, context: any) {
    const body = await request.json();
    const supabase = createClient();

    console.log("body", body)

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
