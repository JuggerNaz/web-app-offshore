import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// Combo configuration mapping
const COMBO_CONFIG: Record<string, { code1_lib: string; code2_lib: string }> = {
    'AMLYCODFND': { code1_lib: 'AMLY_COD', code2_lib: 'AMLY_FND' },
    'ANMLYCLR': { code1_lib: 'AMLY_TYP', code2_lib: 'COLOR' },
    'ANMTRGINSP': { code1_lib: 'AMLY_COD', code2_lib: 'INSPTYPE' },
    'ANMALTDAYS': { code1_lib: 'AMLY_TYP', code2_lib: 'ALTDAYS' },
};

// GET: Fetch combo items for a specific lib_code
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ lib_code: string }> }
) {
    try {
        const supabase = await createClient();
        const { lib_code } = await params;

        // Check if this is a combo library
        if (!COMBO_CONFIG[lib_code]) {
            return NextResponse.json(
                { error: "Not a combo library" },
                { status: 400 }
            );
        }

        console.log("Fetching combo items for:", lib_code);

        // Fetch combo items - table uses lib_com for comments
        const { data: comboItems, error } = await supabase
            .from("u_lib_combo" as any)
            .select("lib_code, code_1, code_2, lib_com, lib_delete")
            .eq("lib_code", lib_code)
            .order("code_1, code_2");

        if (error) {
            console.error("Error fetching combo items:", error);
            throw error;
        }

        console.log("Found combo items:", comboItems?.length || 0);
        return NextResponse.json({ data: comboItems || [] });
    } catch (error: any) {
        console.error("Error fetching combo items:", error);
        console.error("Error details:", {
            message: error.message,
            code: error.code,
            details: error.details
        });
        return NextResponse.json(
            { error: error.message || "Failed to fetch combo items" },
            { status: 500 }
        );
    }
}

// POST: Create new combo item
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ lib_code: string }> }
) {
    try {
        const supabase = await createClient();
        const { lib_code } = await params;
        const body = await request.json();

        // Check if this is a combo library
        if (!COMBO_CONFIG[lib_code]) {
            return NextResponse.json(
                { error: "Not a combo library" },
                { status: 400 }
            );
        }

        const { code_1, code_2, lib_com } = body;

        if (!code_1 || !code_2) {
            return NextResponse.json(
                { error: "Both code_1 and code_2 are required" },
                { status: 400 }
            );
        }

        // Check for duplicate combination
        const { data: existing } = await supabase
            .from("u_lib_combo" as any)
            .select("lib_code, code_1, code_2")
            .eq("lib_code", lib_code)
            .eq("code_1", code_1)
            .eq("code_2", code_2)
            .maybeSingle();

        if (existing) {
            return NextResponse.json(
                { error: "This combination already exists" },
                { status: 409 }
            );
        }

        // Insert new combo
        console.log("Attempting to insert combo:", { lib_code, code_1, code_2, lib_com });

        const { data, error } = await supabase
            .from("u_lib_combo" as any)
            .insert({
                lib_code,
                code_1,
                code_2,
                lib_com: lib_com || null, // Allow null for empty comments
            })
            .select()
            .single();

        if (error) {
            console.error("Supabase insert error:", error);
            throw error;
        }

        console.log("Successfully created combo:", data);
        return NextResponse.json({ data }, { status: 201 });
    } catch (error: any) {
        console.error("Error creating combo item:", error);
        console.error("Error details:", {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint
        });
        return NextResponse.json(
            { error: error.message || "Failed to create combo item" },
            { status: 500 }
        );
    }
}
