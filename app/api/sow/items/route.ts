import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// GET: Fetch SOW items
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);

        const sowId = searchParams.get("sow_id");
        const itemId = searchParams.get("id");

        // If item ID is provided, fetch specific item
        if (itemId) {
            const { data, error } = await supabase
                .from("u_sow_items")
                .select("*")
                .eq("id", itemId)
                .single();

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 400 });
            }

            return NextResponse.json({ data });
        }

        // If sow_id is provided, fetch all items for that SOW
        if (sowId) {
            const { data, error } = await supabase
                .from("u_sow_items")
                .select("*")
                .eq("sow_id", sowId)
                .order("component_qid", { ascending: true });

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 400 });
            }

            return NextResponse.json({ data });
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

// POST: Create or update SOW item
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const body = await request.json();

        const {
            id,
            sow_id,
            component_id,
            inspection_type_id,
            component_qid,
            component_type,
            inspection_code,
            inspection_name,
            elevation_required,
            elevation_data,
            status,
            notes,
            report_number,
        } = body;

        // If ID is provided, update existing item
        if (id) {
            const { data, error } = await (supabase as any)
                .from("u_sow_items")
                .update({
                    component_qid,
                    component_type,
                    inspection_code,
                    inspection_name,
                    elevation_required,
                    elevation_data,
                    status,
                    notes,
                    report_number,
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

        // Create new SOW item
        const { data, error } = await (supabase as any)
            .from("u_sow_items")
            .insert({
                sow_id,
                component_id,
                inspection_type_id,
                component_qid,
                component_type,
                inspection_code,
                inspection_name,
                elevation_required: elevation_required || false,
                elevation_data: elevation_data || [],
                status: status || "pending",
                notes,
                report_number,
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

// PUT: Bulk update SOW items (for updating multiple items at once)
export async function PUT(request: NextRequest) {
    try {
        const supabase = await createClient();
        const body = await request.json();
        const { items } = body;

        if (!items || !Array.isArray(items)) {
            return NextResponse.json(
                { error: "Items array is required" },
                { status: 400 }
            );
        }

        const results = [];
        const errors = [];

        for (const item of items) {
            const { id, ...updateData } = item;

            if (!id) {
                errors.push({ item, error: "Item ID is required" });
                continue;
            }

            const { data, error } = await supabase
                .from("u_sow_items")
                .update({
                    ...updateData,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", id)
                .select()
                .single();

            if (error) {
                errors.push({ item, error: error.message });
            } else {
                results.push(data);
            }
        }

        return NextResponse.json({
            data: results,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}

// DELETE: Delete SOW item
export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { error: "Item ID is required" },
                { status: 400 }
            );
        }

        const { error } = await supabase
            .from("u_sow_items")
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
