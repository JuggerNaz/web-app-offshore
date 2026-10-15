import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const cache = new Map<string, { timestamp: number; data: any[] }>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

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

    const cacheKey = `${numStructureId ?? "all"}_${numJobpackId ?? "all"}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return NextResponse.json(
            { success: true, data: cached.data },
            {
                headers: {
                    "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120"
                }
            }
        );
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const uniqueCombinationsMap = new Map<string, { jobpack_id: number; structure_id: number; sow_report_no: string }>();

        // 1. Fetch from u_sow (fast and contains authoritative report numbers)
        let sowQuery = supabase
            .from("u_sow")
            .select("jobpack_id, structure_id, report_numbers");

        if (numJobpackId !== null) {
            sowQuery = sowQuery.eq("jobpack_id", numJobpackId);
        }
        if (numStructureId !== null) {
            sowQuery = sowQuery.eq("structure_id", numStructureId);
        }

        // 2. Fetch distinct combinations from insp_records (first batch)
        const pageSize = 1000;
        let inspQuery = supabase
            .from("insp_records")
            .select("jobpack_id, structure_id, sow_report_no")
            .not("structure_id", "is", null)
            .not("jobpack_id", "is", null)
            .range(0, pageSize - 1);

        if (numJobpackId !== null) {
            inspQuery = inspQuery.eq("jobpack_id", numJobpackId);
        }
        if (numStructureId !== null) {
            inspQuery = inspQuery.eq("structure_id", numStructureId);
        }

        const [sowRes, inspRes] = await Promise.all([sowQuery, inspQuery]);

        if (sowRes.data && Array.isArray(sowRes.data)) {
            sowRes.data.forEach((row: any) => {
                const jpId = Number(row.jobpack_id);
                const sId = Number(row.structure_id);
                if (!isNaN(jpId) && !isNaN(sId) && Array.isArray(row.report_numbers)) {
                    row.report_numbers.forEach((r: any) => {
                        const sow = (r?.number || r || "").trim();
                        if (sow) {
                            const key = `${jpId}_${sId}_${sow}`;
                            uniqueCombinationsMap.set(key, {
                                jobpack_id: jpId,
                                structure_id: sId,
                                sow_report_no: sow
                            });
                        }
                    });
                }
            });
        }

        if (inspRes.data && Array.isArray(inspRes.data)) {
            inspRes.data.forEach((record: any) => {
                const jpId = Number(record.jobpack_id);
                const sId = Number(record.structure_id);
                const sow = (record.sow_report_no || "").trim();
                if (!isNaN(jpId) && !isNaN(sId) && sow) {
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

            // If more inspection records exist, fetch up to 2 additional pages (max 3000 total)
            let page = 1;
            const maxPages = 3;
            let hasMore = inspRes.data.length >= pageSize && page < maxPages;

            while (hasMore) {
                let nextQuery = supabase
                    .from("insp_records")
                    .select("jobpack_id, structure_id, sow_report_no")
                    .not("structure_id", "is", null)
                    .not("jobpack_id", "is", null)
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (numJobpackId !== null) nextQuery = nextQuery.eq("jobpack_id", numJobpackId);
                if (numStructureId !== null) nextQuery = nextQuery.eq("structure_id", numStructureId);

                const { data: moreData, error: moreError } = await nextQuery;
                if (moreError || !moreData || moreData.length === 0) {
                    hasMore = false;
                } else {
                    moreData.forEach((record: any) => {
                        const jpId = Number(record.jobpack_id);
                        const sId = Number(record.structure_id);
                        const sow = (record.sow_report_no || "").trim();
                        if (!isNaN(jpId) && !isNaN(sId) && sow) {
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

                    if (moreData.length < pageSize || ++page >= maxPages) {
                        hasMore = false;
                    }
                }
            }
        }

        const uniqueResults = Array.from(uniqueCombinationsMap.values());

        // Cache the result for subsequent requests
        cache.set(cacheKey, { timestamp: Date.now(), data: uniqueResults });

        return NextResponse.json(
            { success: true, data: uniqueResults },
            {
                headers: {
                    "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120"
                }
            }
        );

    } catch (error: any) {
        console.error("Error fetching inspection filters:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch inspection filters" },
            { status: 500 }
        );
    }
}
