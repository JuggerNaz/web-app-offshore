import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server";

export async function GET() {
    const supabase = createClient();
    const { data, error } = await supabase.from("workpl").select("*");
    
    if (error) {
        console.error(error.message);
        return NextResponse.json({ error: "Failed to fetch workpl (jobpack)" });
    }

    return NextResponse.json({ data })
}