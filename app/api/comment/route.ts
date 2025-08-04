import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server";

export async function GET() {
    const supabase = createClient();
    const { data, error } = await supabase.from("comment").select("*");
    
    if (error) {
        console.error(error.message);
        return NextResponse.json({ error: "Failed to fetch comment" });
    }

    return NextResponse.json({ data })
}

export async function POST(request: Request, context: any) {
    const supabase = createClient();
    const body = await request.json();
    console.log(body)
    const { data, error } = await supabase.from("comment").insert(body);

    if (error) {
        console.error(error.message);
        return NextResponse.json({ error: "Failed to insert comment" });
    }

    return NextResponse.json({ comment: data })
}