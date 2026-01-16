import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { apiSuccess } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ filter: string; id: string }> }) {
    const supabase = createClient();
    const { filter, id } = await params;
    const decodedFilter = decodeURIComponent(filter);
    const decodedId = decodeURIComponent(id);
    const body = await request.json();

    const { data, error } = await supabase
        .from("u_lib_list" as any)
        .update(body)
        .match({ lib_code: decodedFilter, lib_id: decodedId })
        .select()
        .single();

    if (error) {
        return handleSupabaseError(error, "Failed to update library item");
    }

    return apiSuccess(data);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ filter: string; id: string }> }) {
    const supabase = createClient();
    const { filter, id } = await params;
    const decodedFilter = decodeURIComponent(filter);
    const decodedId = decodeURIComponent(id);

    // Soft delete implementation
    const { data, error } = await supabase
        .from("u_lib_list" as any)
        .update({ lib_delete: 1 })
        .match({ lib_code: decodedFilter, lib_id: decodedId })
        .select()
        .single();

    if (error) {
        return handleSupabaseError(error, "Failed to delete library item");
    }

    return apiSuccess(data);
}
