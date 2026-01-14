import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// Combo configuration mapping
const COMBO_CONFIG: Record<string, { code1_lib: string; code2_lib: string }> = {
    'AMLYCODFND': { code1_lib: 'AMLY_COD', code2_lib: 'AMLY_FND' },
    'ANMLYCLR': { code1_lib: 'AMLY_TYP', code2_lib: 'COLOR' },
    'ANMTRGINSP': { code1_lib: 'AMLY_COD', code2_lib: 'INSPTYPE' },
    'ANMALTDAYS': { code1_lib: 'AMLY_TYP', code2_lib: 'ALTDAYS' },
};

// GET: Fetch options for code_1 and code_2 dropdowns
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ lib_code: string }> }
) {
    try {
        const supabase = await createClient();
        const { lib_code } = await params;

        console.log("Received lib_code:", lib_code);

        // Check if this is a combo library
        const config = COMBO_CONFIG[lib_code];
        if (!config) {
            console.log("Config not found for:", lib_code);
            return NextResponse.json(
                { error: "Not a combo library" },
                { status: 400 }
            );
        }

        // Fetch code_1 options (exclude soft-deleted items)
        const code1Query = await supabase
            .from("u_lib_list" as any)
            .select("lib_id, lib_desc")
            .eq("lib_code", config.code1_lib)
            .or("lib_delete.is.null,lib_delete.eq.0")
            .order("lib_id");

        if (code1Query.error) throw code1Query.error;

        // Fetch code_2 options (exclude soft-deleted items)
        const code2Query = await supabase
            .from("u_lib_list" as any)
            .select("lib_id, lib_desc")
            .eq("lib_code", config.code2_lib)
            .or("lib_delete.is.null,lib_delete.eq.0")
            .order("lib_id");

        if (code2Query.error) throw code2Query.error;

        // Fetch master names for labels from u_lib_mast table
        const mastersQuery = await supabase
            .from("u_lib_mast" as any)
            .select("lib_code, lib_name")
            .in("lib_code", [config.code1_lib, config.code2_lib]);

        if (mastersQuery.error) {
            console.error("Error fetching masters:", mastersQuery.error);
        }

        console.log("Masters query result:", mastersQuery.data);
        console.log("Looking for codes:", config.code1_lib, config.code2_lib);

        const masterMap = new Map(
            mastersQuery.data?.map((m: any) => [m.lib_code, m.lib_name]) || []
        );

        console.log("Master map:", Object.fromEntries(masterMap));
        console.log("Code 1 label:", masterMap.get(config.code1_lib));
        console.log("Code 2 label:", masterMap.get(config.code2_lib));

        return NextResponse.json({
            data: {
                code1_options: code1Query.data || [],
                code2_options: code2Query.data || [],
                code1_label: masterMap.get(config.code1_lib) || config.code1_lib,
                code2_label: masterMap.get(config.code2_lib) || config.code2_lib,
                code1_lib: config.code1_lib,
                code2_lib: config.code2_lib,
            }
        });
    } catch (error: any) {
        console.error("Error fetching combo options:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch combo options" },
            { status: 500 }
        );
    }
}
