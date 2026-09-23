import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return NextResponse.json({ error: "Missing Supabase configuration" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const rawStructureId = searchParams.get("structure_id");
    const rawJobpackId = searchParams.get("jobpack_id");

    let numStructureId: number | null = null;
    if (rawStructureId && rawStructureId !== "all" && rawStructureId !== "null" && rawStructureId !== "undefined") {
        const clean = rawStructureId.replace(/^(platform|pipeline)-/, "");
        const parsed = parseInt(clean, 10);
        if (!isNaN(parsed)) {
            numStructureId = parsed;
        }
    }

    let numJobpackId: number | null = null;
    if (rawJobpackId && rawJobpackId !== "all" && rawJobpackId !== "null" && rawJobpackId !== "undefined") {
        const parsed = parseInt(rawJobpackId, 10);
        if (!isNaN(parsed)) {
            numJobpackId = parsed;
        }
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Fetch distinct combinations of jobpack_id, structure_id, and sow_report_no from insp_records
        // Paginate in batches to ensure no 1000-record truncation limit
        const uniqueCombinationsMap = new Map<string, { jobpack_id: number; structure_id: number; sow_report_no: string }>();
        const pageSize = 1000;
        let page = 0;
        let hasMore = true;

        while (hasMore) {
            let query = supabase
                .from("insp_records")
                .select("jobpack_id, structure_id, sow_report_no")
                .not("structure_id", "is", null)
                .not("jobpack_id", "is", null)
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (numJobpackId !== null) {
                query = query.eq("jobpack_id", numJobpackId);
            }
            if (numStructureId !== null) {
                query = query.eq("structure_id", numStructureId);
            }

            const { data, error } = await query;
            if (error) throw error;

            if (!data || data.length === 0) {
                hasMore = false;
            } else {
                data.forEach((record: any) => {
                    const jpId = Number(record.jobpack_id);
                    const sId = Number(record.structure_id);
                    const sow = (record.sow_report_no || "").trim();
                    if (!isNaN(jpId) && !isNaN(sId)) {
                        const key = `${jpId}_${sId}_${sow}`;
                        if (!uniqueCombinationsMap.has(key)) {
                            uniqueCombinationsMap.set(key, {
                                jobpack_id: jpId,
                                structure_id: sId,
                                sow_report_no: sow
                            });
                        }
                    }
                });

                if (data.length < pageSize) {
                    hasMore = false;
                } else {
                    page++;
                }
            }
        }

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
