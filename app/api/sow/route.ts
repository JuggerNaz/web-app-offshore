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
            let query = (supabase as any).from("u_sow").select("*").eq("id", sowId);
            if (companyId) {
                query = query.or(`company_id.eq.${companyId},company_id.is.null`);
            }
            const { data: sow, error: sowError } = await query.maybeSingle();

            if (sowError) {
                return NextResponse.json({ error: sowError.message }, { status: 400 });
            }
            if (!sow) {
                return NextResponse.json({ data: null });
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
            const rawId = String(structureId).replace(/^(platform|pipeline)-/, "");
            const numRawId = Number(rawId);

            let query = (supabase as any)
                .from("u_sow")
                .select("*")
                .eq("jobpack_id", Number(jobpackId));

            if (!isNaN(numRawId)) {
                query = query.eq("structure_id", numRawId);
            }

            if (companyId) {
                query = query.or(`company_id.eq.${companyId},company_id.is.null`);
            }

            let { data: sows, error: sowError } = await query;

            if (sowError) {
                return NextResponse.json({ error: sowError.message }, { status: 400 });
            }

            // Fallback: if no row matches both jobpack_id and structure_id, try fetching by jobpack_id alone
            if (!sows || sows.length === 0) {
                let fbQuery = (supabase as any)
                    .from("u_sow")
                    .select("*")
                    .eq("jobpack_id", Number(jobpackId));
                if (companyId) {
                    fbQuery = fbQuery.or(`company_id.eq.${companyId},company_id.is.null`);
                }
                const { data: fbData } = await fbQuery;
                if (fbData && fbData.length > 0) {
                    sows = fbData;
                }
            }

            if (!sows || sows.length === 0) {
                return NextResponse.json({ data: null });
            }

            const sow = sows[0];

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
            let query = (supabase as any)
                .from("u_sow")
                .select("*")
                .eq("jobpack_id", Number(jobpackId));

            if (companyId) {
                query = query.or(`company_id.eq.${companyId},company_id.is.null`);
            }

            const { data: sows, error } = await query.order("created_at", { ascending: false });

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 400 });
            }

            return NextResponse.json({ data: sows });
        }

        if (structureId) {
            const rawId = String(structureId).replace(/^(platform|pipeline)-/, "");
            const numRawId = Number(rawId);
            if (isNaN(numRawId)) {
                return NextResponse.json({ data: [] });
            }
            let query = (supabase as any)
                .from("u_sow")
                .select("*")
                .eq("structure_id", numRawId);

            if (companyId) {
                query = query.or(`company_id.eq.${companyId},company_id.is.null`);
            }

            const { data: sows, error } = await query.order("created_at", { ascending: false });

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
