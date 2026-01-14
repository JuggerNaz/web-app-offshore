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

        const { lib_com, lib_delete, code_1, code_2 } = body;

        // Build update object
        const updateData: any = {};
        if (lib_com !== undefined) updateData.lib_com = lib_com;
        if (lib_delete !== undefined) updateData.lib_delete = lib_delete;

        // The 'id' param is actually "code_1-code_2" format, split it
        const [updateCode1, updateCode2] = id.split('-');

        const { data, error } = await supabase
            .from("u_lib_combo" as any)
            .update(updateData)
            .eq("lib_code", lib_code)
            .eq("code_1", updateCode1)
            .eq("code_2", updateCode2)
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

        // The 'id' param is actually "code_1-code_2" format, split it
        const [deleteCode1, deleteCode2] = id.split('-');

        const { error } = await supabase
            .from("u_lib_combo" as any)
            .delete()
            .eq("lib_code", lib_code)
            .eq("code_1", deleteCode1)
            .eq("code_2", deleteCode2);

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
