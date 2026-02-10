import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// GET: Fetch components for a structure
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);

        const structureId = searchParams.get("structure_id");
        const structureType = searchParams.get("structure_type");

        if (!structureId) {
            return NextResponse.json(
                { error: "structure_id is required" },
                { status: 400 }
            );
        }

        console.log("Fetching components for structure_id:", structureId);

        // Fetch components from structure_components table
        // q_id and code are direct columns, rest are in metadata JSONB column
        const { data, error } = await supabase
            .from("structure_components")
            .select("*")
            .eq("structure_id", parseInt(structureId))
            .eq("is_deleted", false)
            .order("q_id", { ascending: true });

        if (error) {
            console.error("Error fetching components from structure_components:", error);
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        // Map data: q_id and code are direct columns, rest from metadata or columns
        const mappedData = (data || []).map((item: any) => {
            const metadata = item.metadata || {};
            // Prioritize DB columns over metadata, but ensure qid/type are mapped
            return {
                ...metadata,
                ...item,
                qid: item.q_id,
                type: item.code,
            };
        });

        console.log(`Fetched ${mappedData.length} components from structure_components for structure ${structureId}`);
        return NextResponse.json({ data: mappedData });
    } catch (error: any) {
        console.error("Exception in structure-components API:", error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
