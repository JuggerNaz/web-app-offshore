import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { withTenant } from "@/utils/tenant-auth";

export const GET = withTenant(async (request, { companyId }) => {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);

        const sowId = searchParams.get("sow_id");
        const itemId = searchParams.get("id");

        if (itemId) {
            let query = (supabase as any)
                .from("u_sow_items")
                .select("*")
                .eq("id", itemId);

            if (companyId) {
                query = query.or(`company_id.eq.${companyId},company_id.is.null`);
            }

            const { data, error } = await query.maybeSingle();

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 400 });
            }

            return NextResponse.json({ data });
        }

        if (sowId) {
            let query = (supabase as any)
                .from("u_sow_items")
                .select("*")
                .eq("sow_id", sowId);

            if (companyId) {
                query = query.or(`company_id.eq.${companyId},company_id.is.null`);
            }

            const { data, error } = await query.order("component_qid", { ascending: true });

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 400 });
            }

            return NextResponse.json({ data });
        }

        return NextResponse.json(
            { error: "Missing required parameters" },
            { status: 400 }
        );
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
});

export const POST = withTenant(async (request, { companyId }) => {
    try {
        const supabase = await createClient();
        const body = await request.json();

        const {
            id,
            sow_id,
            component_id,
            inspection_type_id,
            component_qid,
            component_type,
            inspection_code,
            inspection_name,
            elevation_required,
            elevation_data,
            status,
            notes,
            report_number,
        } = body;

        if (id) {
            let { data, error } = await (supabase as any)
                .from("u_sow_items")
                .update({
                    component_qid,
                    component_type,
                    inspection_code,
                    inspection_name,
                    elevation_required,
                    elevation_data,
                    status,
                    notes,
                    report_number,
                    company_id: companyId,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", id)
                .eq("company_id", companyId)
                .select()
                .maybeSingle();

            if (!data) {
                const { data: retryData, error: retryError } = await (supabase as any)
                    .from("u_sow_items")
                    .update({
                        component_qid,
                        component_type,
                        inspection_code,
                        inspection_name,
                        elevation_required,
                        elevation_data,
                        status,
                        notes,
                        report_number,
                        company_id: companyId,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", id)
                    .is("company_id", null)
                    .select()
                    .maybeSingle();

                if (retryData) {
                    data = retryData;
                    error = null;
                }
            }

            if (error || !data) {
                return NextResponse.json({ error: error?.message || "Failed to update SOW item" }, { status: 400 });
            }

            return NextResponse.json({ data });
        }

        const { data, error } = await (supabase as any)
            .from("u_sow_items")
            .insert({
                sow_id,
                component_id,
                inspection_type_id,
                component_qid,
                component_type,
                inspection_code,
                inspection_name,
                elevation_required: elevation_required || false,
                elevation_data: elevation_data || [],
                status: status || "pending",
                notes,
                report_number,
                company_id: companyId,
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json({ data });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
});

export const PUT = withTenant(async (request, { companyId }) => {
    try {
        const supabase = await createClient();
        const body = await request.json();
        const { items } = body;

        if (!items || !Array.isArray(items)) {
            return NextResponse.json(
                { error: "Items array is required" },
                { status: 400 }
            );
        }

        const results: any[] = [];
        const errors: any[] = [];

        for (const item of items) {
            const { id, ...updateData } = item;

            if (!id) {
                errors.push({ item, error: "Item ID is required" });
                continue;
            }

            let { data, error } = await (supabase as any)
                .from("u_sow_items")
                .update({
                    ...updateData,
                    company_id: companyId,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", id)
                .eq("company_id", companyId)
                .select()
                .maybeSingle();

            if (!data) {
                const { data: retryData, error: retryError } = await (supabase as any)
                    .from("u_sow_items")
                    .update({
                        ...updateData,
                        company_id: companyId,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", id)
                    .is("company_id", null)
                    .select()
                    .maybeSingle();

                if (retryData) {
                    data = retryData;
                    error = null;
                } else if (retryError) {
                    error = retryError;
                }
            }

            if (error || !data) {
                errors.push({ item, error: error?.message || "Not found" });
            } else {
                results.push(data);
            }
        }

        return NextResponse.json({
            data: results,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
});

export const DELETE = withTenant(async (request, { companyId }) => {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { error: "Item ID is required" },
                { status: 400 }
            );
        }

        const { error } = await (supabase as any)
            .from("u_sow_items")
            .delete()
            .eq("id", id)
            .eq("company_id", companyId);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
});
