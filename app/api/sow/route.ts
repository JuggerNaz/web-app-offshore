import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// GET: Fetch SOW data
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);

        const jobpackId = searchParams.get("jobpack_id");
        const structureId = searchParams.get("structure_id");
        const sowId = searchParams.get("sow_id");

        // If sow_id is provided, fetch specific SOW with items
        if (sowId) {
            const { data: sow, error: sowError } = await (supabase as any)
                .from("u_sow")
                .select("*")
                .eq("id", sowId)
                .single();

            if (sowError) {
                return NextResponse.json({ error: sowError.message }, { status: 400 });
            }

            // Fetch SOW items
            const { data: items, error: itemsError } = await (supabase as any)
                .from("u_sow_items")
                .select("*")
                .eq("sow_id", sowId)
                .order("component_qid", { ascending: true });

            if (itemsError) {
                return NextResponse.json({ error: itemsError.message }, { status: 400 });
            }

            return NextResponse.json({ data: { ...sow, items } });
        }

        // If jobpack_id and structure_id are provided, fetch SOW for that structure
        if (jobpackId && structureId) {
            const { data: sow, error: sowError } = await (supabase as any)
                .from("u_sow")
                .select("*")
                .eq("jobpack_id", jobpackId)
                .eq("structure_id", structureId)
                .single();

            if (sowError) {
                if (sowError.code === "PGRST116") {
                    // No SOW found, return null
                    return NextResponse.json({ data: null });
                }
                return NextResponse.json({ error: sowError.message }, { status: 400 });
            }

            // Fetch SOW items
            const { data: items, error: itemsError } = await (supabase as any)
                .from("u_sow_items")
                .select("*")
                .eq("sow_id", sow.id)
                .order("component_qid", { ascending: true });

            if (itemsError) {
                return NextResponse.json({ error: itemsError.message }, { status: 400 });
            }

            return NextResponse.json({ data: { ...sow, items } });
        }

        // If only jobpack_id is provided, fetch all SOWs for that job pack
        if (jobpackId) {
            const { data: sows, error } = await (supabase as any)
                .from("u_sow")
                .select("*")
                .eq("jobpack_id", jobpackId)
                .order("created_at", { ascending: false });

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 400 });
            }

            return NextResponse.json({ data: sows });
        }

        return NextResponse.json(
            { error: "Missing required parameters" },
            { status: 400 }
        );
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}

// POST: Create or update SOW header
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const body = await request.json();

        const {
            id,
            jobpack_id,
            structure_id,
            structure_type,
            structure_title,
            report_numbers,
            metadata,
        } = body;

        // If ID is provided, update existing SOW
        if (id) {
            const { data, error } = await (supabase as any)
                .from("u_sow")
                .update({
                    structure_type,
                    structure_title,
                    report_numbers,
                    metadata,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", id)
                .select()
                .single();

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 400 });
            }

            return NextResponse.json({ data });
        }

        // Create new SOW
        const { data, error } = await (supabase as any)
            .from("u_sow")
            .insert({
                jobpack_id,
                structure_id,
                structure_type,
                structure_title,
                report_numbers: report_numbers || [],
                metadata: metadata || {},
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json({ data });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}

// DELETE: Delete SOW (will cascade delete all items)
export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { error: "SOW ID is required" },
                { status: 400 }
            );
        }

        const { error } = await (supabase as any)
            .from("u_sow")
            .delete()
            .eq("id", id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
