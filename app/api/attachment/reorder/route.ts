import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { withTenant } from "@/utils/tenant-auth";
import { parseMediaId } from "@/utils/attachment-category";

export const dynamic = "force-dynamic";

/**
 * POST /api/attachment/reorder
 * Bulk updates the sort order of attachments / insp_media records.
 * Body: { items: Array<{ id: string | number; sort_order: number }> }
 */
export const POST = withTenant(async (request: NextRequest, { companyId }) => {
  try {
    const body = await request.json();
    const items: Array<{ id: string | number; sort_order: number }> = body.items || body.reorder || [];

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "No items provided for reordering" }, { status: 400 });
    }

    const useAdmin = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = useAdmin ? createAdminClient() : createClient();

    const updatePromises = items.map(async (item) => {
      const rawId = String(item.id);
      const sortOrder = Number(item.sort_order);

      // 1. Check if insp_media record
      const mediaId = parseMediaId(rawId);
      if (mediaId !== null) {
        const { data: current } = await (supabase as any)
          .from("insp_media")
          .select("meta")
          .eq("media_id", mediaId)
          .maybeSingle();

        const currentMeta = current?.meta && typeof current.meta === "object" ? current.meta : {};
        const updatedMeta = { ...currentMeta, sort_order: sortOrder };

        return (supabase as any)
          .from("insp_media")
          .update({ meta: updatedMeta })
          .eq("media_id", mediaId);
      }

      // 2. attachment record
      const attId = Number(rawId);
      if (!isNaN(attId)) {
        const { data: current } = await (supabase as any)
          .from("attachment")
          .select("meta")
          .eq("id", attId)
          .maybeSingle();

        const currentMeta = current?.meta && typeof current.meta === "object" ? current.meta : {};
        const updatedMeta = { ...currentMeta, sort_order: sortOrder };

        return (supabase as any)
          .from("attachment")
          .update({ meta: updatedMeta })
          .eq("id", attId);
      }
    });

    await Promise.all(updatePromises);

    return NextResponse.json({ success: true, count: items.length });
  } catch (err: any) {
    console.error("[POST /api/attachment/reorder] Error:", err);
    return NextResponse.json({ error: err.message || "Failed to update attachment order" }, { status: 500 });
  }
});
