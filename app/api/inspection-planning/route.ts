import { NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { apiSuccess, apiCreated, apiPaginated } from "@/utils/api-response";
import {
    getPaginationParams,
    createPaginationMeta,
    applyPagination,
    getSearchParam,
    buildSearchFilter,
} from "@/utils/pagination";
import { handleSupabaseError } from "@/utils/api-error-handler";
import { withAuth } from "@/utils/with-auth";

/**
 * GET /api/inspection-planning
 * Fetch planning records (paginated listing with optional ?q= name search,
 * or a single record by ID via ?id=)
 *
 * Query params: ?page=1&pageSize=50&q=<name search>&id=<single record>
 */
export const GET = withAuth(async (request: NextRequest) => {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
        const { data, error } = await supabase
            .from("inspection_planning")
            .select("*")
            .eq("id", parseInt(id, 10))
            .single();

        if (error) {
            return handleSupabaseError(error, "Failed to fetch planning data");
        }

        return apiSuccess(data || []);
    }

    // Paginated listing (scroll-to-load). `name` is the only plain text column
    // on inspection_planning, so the free-text search runs over it.
    const paginationParams = getPaginationParams(request);
    const q = getSearchParam(request);

    let query: any = supabase
        .from("inspection_planning")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

    const searchFilter = buildSearchFilter(q, ["name"]);
    if (searchFilter) {
        query = query.or(searchFilter);
    }

    query = applyPagination(query, paginationParams);

    const { data, error, count } = await query;

    if (error) {
        return handleSupabaseError(error, "Failed to fetch planning data");
    }

    const pagination = createPaginationMeta(paginationParams, count || 0);

    return apiPaginated(data || [], pagination);
});

/**
 * POST /api/inspection-planning
 * Create or Update a planning record
 */
export const POST = withAuth(async (request: NextRequest, { user }) => {
    const supabase = createClient();
    const body = await request.json();

    const { name, metadata, id } = body;

    const payload: any = {
        name,
        metadata,
        modified_by: user.id,
    };

    if (id) {
        // Update existing
        const { data, error } = await supabase
            .from("inspection_planning")
            .update(payload)
            .eq("id", id)
            .select()
            .single();

        if (error) {
            return handleSupabaseError(error, "Failed to update planning record");
        }
        return apiSuccess(data);
    } else {
        // Create new
        payload.created_by = user.id;
        const { data, error } = await supabase
            .from("inspection_planning")
            .insert(payload)
            .select()
            .single();

        if (error) {
            return handleSupabaseError(error, "Failed to create planning record");
        }
        return apiCreated(data);
    }
});

/**
 * DELETE /api/inspection-planning
 * Decommission a planning record
 */
export const DELETE = withAuth(async (request: NextRequest) => {
    const useAdmin = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = useAdmin ? createAdminClient() : createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
        return handleSupabaseError(null as any, "Plan ID is required for deletion");
    }

    const { error } = await supabase
        .from("inspection_planning")
        .delete()
        .eq("id", parseInt(id, 10));

    if (error) {
        return handleSupabaseError(error, "Failed to decommission plan");
    }

    return apiSuccess({ message: "Plan successfully decommissioned" });
});
