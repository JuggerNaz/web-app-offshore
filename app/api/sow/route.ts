import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { withTenant } from "@/utils/tenant-auth";

export const GET = withTenant(async (request, { companyId }) => {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);

        const jobpackId = searchParams.get("jobpack_id");
        const structureId = searchParams.get("structure_id");
        const sowId = searchParams.get("sow_id");

        if (sowId) {
            const { data: sow, error: sowError } = await (supabase as any)
                .from("u_sow")
                .select("*")
                .eq("id", sowId)
                .eq("company_id", companyId)
                .single();

            if (sowError) {
                return NextResponse.json({ error: sowError.message }, { status: 400 });
            }

            const { data: items, error: itemsError } = await (supabase as any)
                .from("u_sow_items")
                .select("*")
                .eq("sow_id", sowId)
                .order("component_qid", { ascending: true });

            if (itemsError) {
                return NextResponse.json({ error: itemsError.message }, { status: 400 });
            }

            return NextResponse.json({ data: { ...sow, items } });
        }

        if (jobpackId && structureId) {
            const { data: sow, error: sowError } = await (supabase as any)
                .from("u_sow")
                .select("*")
                .eq("jobpack_id", jobpackId)
                .eq("structure_id", structureId)
                .eq("company_id", companyId)
                .single();

            if (sowError) {
                if (sowError.code === "PGRST116") {
                    return NextResponse.json({ data: null });
                }
                return NextResponse.json({ error: sowError.message }, { status: 400 });
            }

            const { data: items, error: itemsError } = await (supabase as any)
                .from("u_sow_items")
                .select("*")
                .eq("sow_id", sow.id)
                .order("component_qid", { ascending: true });

            if (itemsError) {
                return NextResponse.json({ error: itemsError.message }, { status: 400 });
            }

            return NextResponse.json({ data: { ...sow, items } });
        }

        if (jobpackId) {
            const { data: sows, error } = await (supabase as any)
                .from("u_sow")
                .select("*")
                .eq("jobpack_id", jobpackId)
                .eq("company_id", companyId)
                .order("created_at", { ascending: false });

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 400 });
            }

            return NextResponse.json({ data: sows });
        }

        if (structureId) {
            const { data: sows, error } = await (supabase as any)
                .from("u_sow")
                .select("*")
                .eq("structure_id", structureId)
                .eq("company_id", companyId)
                .order("created_at", { ascending: false });

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 400 });
            }

            return NextResponse.json({ data: sows });
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
            jobpack_id,
            structure_id,
            structure_type,
            structure_title,
            report_numbers,
            metadata,
        } = body;

        if (id) {
            const { data, error } = await (supabase as any)
                .from("u_sow")
                .update({
                    structure_type,
                    structure_title,
                    report_numbers,
                    metadata,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", id)
                .eq("company_id", companyId)
                .select()
                .single();

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 400 });
            }

            return NextResponse.json({ data });
        }

        const { data, error } = await (supabase as any)
            .from("u_sow")
            .insert({
                jobpack_id,
                structure_id,
                structure_type,
                structure_title,
                report_numbers: report_numbers || [],
                metadata: metadata || {},
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

export const DELETE = withTenant(async (request, { companyId }) => {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { error: "SOW ID is required" },
                { status: 400 }
            );
        }

        const { error } = await (supabase as any)
            .from("u_sow")
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
