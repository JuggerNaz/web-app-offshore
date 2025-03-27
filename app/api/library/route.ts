import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server";

export async function GET() {
    const supabase = createClient();
    const { data, error } = await supabase.from("u_lib_list").select("*");
    
    if (error) {
        console.error(error.message);
        return NextResponse.json({ error: "Failed to fetch pipeline" });
    }

    return NextResponse.json({ data })
}