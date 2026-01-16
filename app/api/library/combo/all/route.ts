import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
    const supabase = await createClient();

    try {
        // Fetch all combination data from u_lib_combo
        const { data, error } = await supabase
            .from("u_lib_combo")
            .select("lib_code, lib_val, code")
            .order("lib_code");

        if (error) {
            console.error("Error fetching all combo data:", error);
            return NextResponse.json(
                { error: "Failed to fetch combination data", details: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({ data: data || [] });
    } catch (err: any) {
        console.error("Unexpected error:", err);
        return NextResponse.json(
            { error: "Internal server error", details: err.message },
            { status: 500 }
        );
    }
}
