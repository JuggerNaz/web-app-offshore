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

export async function POST(request: Request) {
    // const supabase = createClient();
    // const { data, error } = await supabase.from("platform").insert([
    //     { name: "Platform 4" },
    //     { name: "Platform 5" },
    // ]);
    
    // if (error) {
    //     console.error(error.message);
    //     return { error: "Failed to insert platform" };
    // }

    // console.log(data)

    // return NextResponse.json({ platforms: data })
    const data = await request.json()
    return NextResponse.json({ data })
}