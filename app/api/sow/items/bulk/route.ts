import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { withTenant } from "@/utils/tenant-auth";

export const POST = withTenant(async (request, { companyId }) => {
    try {
        const supabase = await createClient();
        const body = await request.json();

        const { sow_id, items } = body;

        if (!sow_id) {
            return NextResponse.json({ error: "sow_id is required" }, { status: 400 });
        }

        if (!Array.isArray(items)) {
            return NextResponse.json({ error: "items must be an array" }, { status: 400 });
        }

        const { data: existingItems, error: fetchError } = await (supabase as any)
            .from("u_sow_items")
            .select("*")
            .eq("sow_id", sow_id)
            .eq("company_id", companyId);

        if (fetchError) {
            return NextResponse.json({ error: fetchError.message }, { status: 400 });
        }

        const existingMap = new Map();
        existingItems?.forEach((item: any) => {
            const key = `${item.report_number || 'null'}:${item.component_id}:${item.inspection_type_id}`;
            existingMap.set(key, item);
        });

        const itemsToUpsert = items.map((item: any) => {
            const key = `${item.report_number || 'null'}:${item.component_id}:${item.inspection_type_id}`;
            const existing = existingMap.get(key);

            return {
                sow_id,
                component_id: item.component_id,
                inspection_type_id: item.inspection_type_id,
                report_number: item.report_number,
                component_qid: item.component_qid,
                component_type: item.component_type,
                inspection_code: item.inspection_code,
                inspection_name: item.inspection_name,
                elevation_required: item.elevation_required || false,
                elevation_data: item.elevation_data || [],
                status: existing?.status || item.status || "pending",
                notes: existing?.notes || item.notes || null,
                updated_at: new Date().toISOString(),
                company_id: companyId,
            };
        });

        const toUpdate: any[] = [];
        const toInsert: any[] = [];

        itemsToUpsert.forEach((item: any) => {
            const key = `${item.report_number || 'null'}:${item.component_id}:${item.inspection_type_id}`;
            const existing = existingMap.get(key);
            
            if (existing?.id) {
                toUpdate.push({ ...item, id: existing.id });
            } else {
                toInsert.push(item);
            }
        });

        const newItemKeys = new Set(items.map((item: any) => 
            `${item.report_number || 'null'}:${item.component_id}:${item.inspection_type_id}`
        ));

        const itemIdsToDelete = existingItems
            ?.filter((item: any) => {
                const key = `${item.report_number || 'null'}:${item.component_id}:${item.inspection_type_id}`;
                return !newItemKeys.has(key);
            })
            .map((item: any) => item.id) || [];

        if (itemIdsToDelete.length > 0) {
            const { error: deleteError } = await (supabase as any)
                .from("u_sow_items")
                .delete()
                .in("id", itemIdsToDelete);

            if (deleteError) {
                console.error("Bulk Delete Error:", deleteError);
                return NextResponse.json({ error: `Delete failed: ${deleteError.message}` }, { status: 400 });
            }
        }

        if (toUpdate.length > 0) {
            const { error: updateError } = await (supabase as any)
                .from("u_sow_items")
                .upsert(toUpdate);

            if (updateError) {
                console.error("Bulk Update Error:", updateError);
                return NextResponse.json({ error: `Update failed: ${updateError.message}` }, { status: 400 });
            }
        }

        if (toInsert.length > 0) {
            const { error: insertError } = await (supabase as any)
                .from("u_sow_items")
                .insert(toInsert);

            if (insertError) {
                console.error("Bulk Insert Error:", insertError);
                return NextResponse.json({ error: `Insert failed: ${insertError.message}` }, { status: 400 });
            }
        }

        return NextResponse.json({ 
            success: true, 
            updated: toUpdate.length, 
            inserted: toInsert.length, 
            deleted: itemIdsToDelete.length 
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
});
