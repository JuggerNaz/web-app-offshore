import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return NextResponse.json({ error: "Missing Supabase configuration" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const jobpackId = searchParams.get("jobpack_id");

    if (!jobpackId) {
        return NextResponse.json({ error: "jobpack_id is required" }, { status: 400 });
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Fetch distinct combinations of structure_id and sow_report_no from insp_records for the given jobpack
        const { data, error } = await supabase
            .from("insp_records")
            .select("structure_id, sow_report_no")
            .eq("jobpack_id", jobpackId)
            .not("structure_id", "is", null);

        if (error) throw error;

        // Deduplicate combinations
        const uniqueCombinationsMap = new Map();
        
        data?.forEach((record) => {
            const key = `${record.structure_id}-${record.sow_report_no}`;
            if (!uniqueCombinationsMap.has(key)) {
                uniqueCombinationsMap.set(key, record);
            }
        });

        const uniqueResults = Array.from(uniqueCombinationsMap.values());

        return NextResponse.json({ 
            success: true, 
            data: uniqueResults 
        });

    } catch (error: any) {
        console.error("Error fetching inspection filters:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch inspection filters" },
            { status: 500 }
        );
    }
}
