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
    const companyId = request.headers.get("x-company-id") || 
      request.cookies.get("active_company_id")?.value || 
      body.company_id;

    let updateQuery = supabase
        .from("u_lib_list" as any)
        .update(body)
        .match({ lib_code: decodedFilter, lib_id: decodedId });

    if (companyId) {
        updateQuery = updateQuery.eq("company_id", companyId);
    }

    const { data, error } = await updateQuery
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
    const companyId = request.nextUrl.searchParams.get("company_id") || 
      request.headers.get("x-company-id") || 
      request.cookies.get("active_company_id")?.value;

    // Soft delete implementation
    let deleteQuery = supabase
        .from("u_lib_list" as any)
        .update({ lib_delete: 1 })
        .match({ lib_code: decodedFilter, lib_id: decodedId });

    if (companyId) {
        deleteQuery = deleteQuery.eq("company_id", companyId);
    }

    const { data, error } = await deleteQuery
        .select()
        .single();

    if (error) {
        return handleSupabaseError(error, "Failed to delete library item");
    }

    return apiSuccess(data);
}
