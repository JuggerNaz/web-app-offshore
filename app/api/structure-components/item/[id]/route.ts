import { NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { apiSuccess } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";
import { withAuth } from "@/utils/with-auth";
import type { Database } from "@/supabase/schema";

type StructureComponentUpdate =
  Database["public"]["Tables"]["structure_components"]["Update"];

/**
 * PATCH /api/structure-components/item/[id]
 * Soft delete or update flags for a single structure component by id.
 * Body: { is_deleted?: boolean }
 */
export const PATCH = withAuth(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }>; user: any }
  ) => {
    const supabase = createClient();
    const { id } = await params;
    const body =
      (await request.json().catch(() => ({}))) as StructureComponentUpdate;

    const componentId = Number(id);
    if (Number.isNaN(componentId)) {
      return handleSupabaseError(
        { message: "Invalid component id", details: null, hint: null, code: "400" } as any,
        "Invalid component id"
      );
    }

    const { data, error } = await supabase
      .from("structure_components")
      .update(body)
      .eq("id", componentId)
      .select()
      .single();

    if (error) {
      return handleSupabaseError(error, "Failed to update structure component");
    }

    return apiSuccess(data);
  }
);

/**
 * DELETE /api/structure-components/item/[id]
 * Permanently delete a structure component by id.
 */
export const DELETE = withAuth(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }>; user: any }
  ) => {
    const useAdmin = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = useAdmin ? createAdminClient() : createClient();
    const { id } = await params;

    const componentId = Number(id);
    if (Number.isNaN(componentId)) {
      return handleSupabaseError(
        { message: "Invalid component id", details: null, hint: null, code: "400" } as any,
        "Invalid component id"
      );
    }

    const { error } = await supabase
      .from("structure_components")
      .delete()
      .eq("id", componentId);

    if (error) {
      return handleSupabaseError(error, "Failed to delete structure component");
    }

    return apiSuccess({ success: true });
  }
);
