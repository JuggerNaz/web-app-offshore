import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// PUT: Update combo item
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ lib_code: string; id: string }> }
) {
    try {
        const supabase = await createClient();
        const { lib_code, id } = await params;
        const body = await request.json();

        const { lib_com, lib_delete } = body;

        // Build update object
        const updateData: any = {};
        if (lib_com !== undefined) updateData.workunit = lib_com; // Map lib_com to workunit
        if (lib_delete !== undefined) updateData.lib_delete = lib_delete;

        const { data, error } = await supabase
            .from("u_lib_combo" as any)
            .update(updateData)
            .eq("id", id)
            .eq("lib_code", lib_code)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ data });
    } catch (error: any) {
        console.error("Error updating combo item:", error);
        return NextResponse.json(
            { error: error.message || "Failed to update combo item" },
            { status: 500 }
        );
    }
}

// DELETE: Hard delete combo item (optional, for admin use)
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ lib_code: string; id: string }> }
) {
    try {
        const supabase = await createClient();
        const { lib_code, id } = await params;

        const { error } = await supabase
            .from("u_lib_combo" as any)
            .delete()
            .eq("id", id)
            .eq("lib_code", lib_code);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error deleting combo item:", error);
        return NextResponse.json(
            { error: error.message || "Failed to delete combo item" },
            { status: 500 }
        );
    }
}
