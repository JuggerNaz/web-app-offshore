import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { getPaginationParams, createPaginationMeta, applyPagination } from "@/utils/pagination";
import { apiPaginated, apiSuccess } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";
import { withTenant } from "@/utils/tenant-auth";

export const GET = withTenant(async (request) => {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
        const { data, error } = await supabase
            .from("inspection_type")
            .select("*")
            .eq("id", Number(id));

        if (error) return handleSupabaseError(error, "Failed to fetch inspection type");
        const singleData = data && data.length > 0 ? data[0] : null;
        return apiSuccess(singleData);
    }

    const paginationParams = getPaginationParams(request);
    let query = supabase.from("inspection_type").select("*", { count: "exact" });
    query = applyPagination(query, paginationParams);

    const { data, error, count } = await query;
    if (error) return handleSupabaseError(error, "Failed to fetch inspection_types");

    const pagination = createPaginationMeta(paginationParams, count || 0);
    return apiPaginated(data || [], pagination);
});

export const POST = withTenant(async (request) => {
    const useAdmin = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = useAdmin ? createAdminClient() : createClient();
    const body = await request.json();
    const { id, ...payload } = body;

    let result;

    console.log("[INSPECTION TYPE POST] Received payload keys:", Object.keys(payload));

    if (id) {
        console.log(`[INSPECTION TYPE POST] Updating record ${id}...`);
        result = await supabase
            .from("inspection_type")
            .update(payload)
            .eq("id", Number(id))
            .select();
    } else {
        console.log(`[INSPECTION TYPE POST] Inserting new record...`);
        result = await supabase
            .from("inspection_type")
            .insert(payload)
            .select();
    }

    console.log("[INSPECTION TYPE POST] Supabase Result:", { error: result.error, dataCount: result.data?.length });

    if (result.error) return handleSupabaseError(result.error, "Failed to save inspection type");

    if (id && (!result.data || result.data.length === 0)) {
        console.warn(`[INSPECTION TYPE POST] WARNING: Update returned 0 rows for ID ${id}. RLS or invalid ID?`);
        return NextResponse.json({
            success: false,
            error: "Failed to save configuration. You do not have the required administrative permissions to modify this library record."
        }, { status: 403 });
    }

    const savedData = result.data && result.data.length > 0 ? result.data[0] : null;
    return apiSuccess(savedData);
});

export const DELETE = withTenant(async (request) => {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    const { error } = await supabase
        .from("inspection_type")
        .delete()
        .eq("id", Number(id));

    if (error) return handleSupabaseError(error, "Failed to delete inspection type");
    return apiSuccess({ success: true });
});
