import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * POST /api/library/field
 * Add a new oil field or re-enable a deleted field in u_lib_list table.
 * 
 * Rules:
 * 1. lib_code = 'OILFIELD'
 * 2. Duplicate check (case-insensitive) against lib_id and lib_desc.
 * 3. If active match exists (lib_delete != 1) -> Block duplicate.
 * 4. If deleted match exists (lib_delete == 1) -> Prompt user / re-enable if confirmed.
 * 5. If no match exists -> Insert new oil field record.
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = createClient();
        const body = await request.json();
        const { fieldId, fieldDesc, confirmEnable } = body;
        const companyId = request.headers.get("x-company-id") || 
          request.cookies.get("active_company_id")?.value || 
          body.company_id;

        if (!fieldId || typeof fieldId !== "string" || !fieldId.trim()) {
            return NextResponse.json({ error: "Field ID / Code is required." }, { status: 400 });
        }

        const normalizedId = fieldId.trim().toUpperCase();
        const normalizedDesc = (fieldDesc && typeof fieldDesc === "string" && fieldDesc.trim())
            ? fieldDesc.trim()
            : normalizedId;

        // Fetch all oil field records from u_lib_list (including active and deleted ones) for this tenant
        let fetchQuery = (supabase as any)
            .from("u_lib_list")
            .select("*")
            .eq("lib_code", "OILFIELD");

        if (companyId) {
            fetchQuery = fetchQuery.eq("company_id", companyId);
        }

        const { data: allFields, error: fetchError } = (await fetchQuery) as any;

        if (fetchError) {
            return NextResponse.json({ error: `Failed to query library: ${fetchError.message}` }, { status: 500 });
        }

        // Check for duplicate lib_id or lib_desc (case-insensitive)
        const existingItem = (allFields || []).find((item: any) => {
            const itemLibId = String(item.lib_id || "").trim().toUpperCase();
            const itemLibDesc = String(item.lib_desc || "").trim().toUpperCase();
            return itemLibId === normalizedId || itemLibDesc === normalizedDesc.toUpperCase();
        });

        if (existingItem) {
            const isDeleted = existingItem.lib_delete === 1;

            if (isDeleted) {
                if (!confirmEnable) {
                    // Prompt user: field exists but is currently flagged as deleted
                    return NextResponse.json({
                        status: "EXISTS_DELETED",
                        message: `Oil field "${existingItem.lib_id}" (${existingItem.lib_desc}) exists in the library list but is currently disabled. Do you want to enable it?`,
                        existingItem
                    }, { status: 200 });
                } else {
                    // User confirmed re-enabling! Set lib_delete = 0
                    let reenableQuery = (supabase as any)
                        .from("u_lib_list")
                        .update({
                            lib_delete: 0,
                            lib_desc: normalizedDesc,
                            ...(companyId ? { company_id: companyId } : {})
                        })
                        .eq("lib_code", "OILFIELD")
                        .eq("lib_id", existingItem.lib_id);

                    if (companyId) {
                        reenableQuery = reenableQuery.eq("company_id", companyId);
                    }

                    const { data: updated, error: updateError } = (await reenableQuery
                        .select()
                        .single()) as any;

                    if (updateError) {
                        return NextResponse.json({ error: `Failed to re-enable field: ${updateError.message}` }, { status: 500 });
                    }

                    return NextResponse.json({
                        status: "RE_ENABLED",
                        message: `Oil field "${existingItem.lib_id}" has been re-enabled successfully.`,
                        data: updated
                    }, { status: 200 });
                }
            } else {
                // Active duplicate entry exists! Block creation.
                return NextResponse.json({
                    status: "EXISTS_ACTIVE",
                    error: `Oil field "${existingItem.lib_id}" already exists in the library list.`
                }, { status: 409 });
            }
        }

        // No duplicate found -> Create new oil field record
        const insertPayload: any = {
            lib_code: "OILFIELD",
            lib_id: normalizedId,
            lib_desc: normalizedDesc,
            lib_delete: 0,
            workunit: "000",
            cr_date: new Date().toISOString()
        };

        if (companyId) {
            insertPayload.company_id = companyId;
        }

        const { data: created, error: insertError } = (await (supabase as any)
            .from("u_lib_list")
            .insert(insertPayload)
            .select()
            .single()) as any;

        if (insertError) {
            return NextResponse.json({ error: `Failed to create oil field: ${insertError.message}` }, { status: 500 });
        }

        return NextResponse.json({
            status: "CREATED",
            message: `Oil field "${normalizedId}" created successfully.`,
            data: created
        }, { status: 201 });

    } catch (err: any) {
        return NextResponse.json({ error: err.message || "An unexpected error occurred." }, { status: 500 });
    }
}
