import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
    try {
        const supabase = createClient();
        const { searchParams } = new URL(request.url);

        const type = searchParams.get("type");
        const field = searchParams.get("field");
        const search = searchParams.get("search");

        // Get all structures
        let structureQuery = supabase
            .from("structure")
            .select("*");

        // Apply type filter
        if (type && type !== "all") {
            structureQuery = structureQuery.eq("str_type", type.toUpperCase());
        }

        const { data: structures, error: structureError } = await structureQuery;

        if (structureError) {
            console.error("Error fetching structures:", structureError);
            return NextResponse.json(
                { error: "Failed to fetch structures", details: structureError.message },
                { status: 500 }
            );
        }

        // Get platform and pipeline details
        const platformIds = structures
            ?.filter((item) => item.str_type === "PLATFORM")
            .map((item) => item.str_id) || [];

        const pipelineIds = structures
            ?.filter((item) => item.str_type === "PIPELINE")
            .map((item) => item.str_id) || [];

        const { data: platforms } = await supabase
            .from("platform" as any)
            .select("*")
            .in("plat_id", platformIds) as any;

        const { data: pipelines } = await supabase
            .from("u_pipeline" as any)
            .select("*")
            .in("pipe_id", pipelineIds) as any;

        // Combine data
        const result = structures
            ?.map((item) => {
                if (item.str_type === "PLATFORM") {
                    const platform = platforms?.find((p: any) => p.plat_id === item.str_id);
                    return {
                        id: item.str_id,
                        str_id: item.str_id,
                        str_name: platform?.title || `Platform ${item.str_id}`,
                        str_type: item.str_type,
                        field_name: platform?.pfield || "",
                        location: platform?.location || "",
                        water_depth: platform?.water_depth || 0,
                        installation_date: platform?.installation_date || "",
                        status: platform?.status || "Active",
                        photo_url: platform?.photo_url || null,
                    };
                } else if (item.str_type === "PIPELINE") {
                    const pipeline = pipelines?.find((p: any) => p.pipe_id === item.str_id);
                    return {
                        id: item.str_id,
                        str_id: item.str_id,
                        str_name: pipeline?.title || `Pipeline ${item.str_id}`,
                        str_type: item.str_type,
                        field_name: pipeline?.pfield || "",
                        location: pipeline?.location || "",
                        water_depth: 0,
                        installation_date: pipeline?.installation_date || "",
                        status: pipeline?.status || "Active",
                        photo_url: pipeline?.photo_url || null,
                    };
                }
                return null;
            })
            .filter(Boolean);

        // Apply search filter
        let filteredResult = result;
        if (search) {
            filteredResult = result?.filter((s: any) =>
                s.str_name.toLowerCase().includes(search.toLowerCase()) ||
                s.str_id.toString().includes(search)
            );
        }

        // Apply field filter
        if (field && field !== "all") {
            filteredResult = filteredResult?.filter((s: any) => s.field_name === field);
        }

        return NextResponse.json({
            success: true,
            data: filteredResult,
            count: filteredResult?.length || 0,
        });
    } catch (error: any) {
        console.error("Error in GET /api/structures:", error);
        return NextResponse.json(
            { error: "Internal server error", details: error.message },
            { status: 500 }
        );
    }
}
