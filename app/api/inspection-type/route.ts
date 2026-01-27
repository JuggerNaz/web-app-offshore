import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getPaginationParams, createPaginationMeta, applyPagination } from "@/utils/pagination";
import { apiPaginated, apiSuccess } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";

/**
 * GET /api/inspection-type
 * Fetch all inspection types or a single record
 * Query params: ?page=1&pageSize=50 OR ?id=1
 */
export async function GET(request: NextRequest) {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
        const { data, error } = await supabase
            .from("inspection_type")
            .select("*")
            .eq("id", id)
            .single();

        if (error) return handleSupabaseError(error, "Failed to fetch inspection type");
        return apiSuccess(data);
    }

    const paginationParams = getPaginationParams(request);
    let query = supabase.from("inspection_type").select("*", { count: "exact" });
    query = applyPagination(query, paginationParams);

    const { data, error, count } = await query;
    if (error) return handleSupabaseError(error, "Failed to fetch inspection_types");

    const pagination = createPaginationMeta(paginationParams, count || 0);
    return apiPaginated(data || [], pagination);
}

/**
 * POST /api/inspection-type
 * Create or update an inspection type record
 */
export async function POST(request: NextRequest) {
    const supabase = createClient();
    const body = await request.json();
    const { id, ...payload } = body;

    let result;
    if (id) {
        // Update existing
        result = await supabase
            .from("inspection_type")
            .update(payload)
            .eq("id", id)
            .select()
            .single();
    } else {
        // Create new
        result = await supabase
            .from("inspection_type")
            .insert(payload)
            .select()
            .single();
    }

    if (result.error) return handleSupabaseError(result.error, "Failed to save inspection type");
    return apiSuccess(result.data);
}

/**
 * DELETE /api/inspection-type
 */
export async function DELETE(request: NextRequest) {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    const { error } = await supabase
        .from("inspection_type")
        .delete()
        .eq("id", id);

    if (error) return handleSupabaseError(error, "Failed to delete inspection type");
    return apiSuccess({ success: true });
}
