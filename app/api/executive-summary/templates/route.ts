import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { withTenant } from "@/utils/tenant-auth";

export const GET = withTenant(async (request, { companyId }) => {
    try {
        const { searchParams } = new URL(request.url);
        const sectionId = searchParams.get("section_id");
        const clientName = searchParams.get("client_name");

        const supabase = await createClient() as any;
        let query = supabase.from("exec_summary_templates")
            .select("*")
            .eq("company_id", companyId);

        if (sectionId) {
            query = query.eq("section_id", sectionId);
        }
        if (clientName) {
            query = query.eq("client_name", clientName);
        }

        const { data, error } = await query.order("template_name", { ascending: true });

        if (error) throw error;

        return NextResponse.json({ data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
});

export const POST = withTenant(async (request, { companyId }) => {
    try {
        const body = await request.json();
        const { template_name, section_id, content, client_name, metadata } = body;

        if (!template_name || !section_id || !content) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const supabase = await createClient() as any;

        // If it's a conditional template, check if one already exists for this section and tenant.
        // If so, update it instead of creating a duplicate row.
        if (metadata?.template_type === "conditional") {
            const { data: existing } = await supabase.from("exec_summary_templates")
                .select("id")
                .eq("company_id", companyId)
                .eq("section_id", section_id)
                .eq("metadata->>template_type", "conditional")
                .maybeSingle();

            if (existing) {
                const { data, error } = await supabase.from("exec_summary_templates")
                    .update({
                        template_name,
                        content,
                        client_name,
                        metadata: metadata || {},
                        updated_at: new Date().toISOString()
                    })
                    .eq("id", existing.id)
                    .eq("company_id", companyId)
                    .select()
                    .single();

                if (error) throw error;
                return NextResponse.json({ data });
            }
        }

        // If it's a standard template and we pass metadata.id, update that specific record
        if (metadata?.template_type === "standard" && metadata?.id) {
            const { data, error } = await supabase.from("exec_summary_templates")
                .update({
                    template_name,
                    content,
                    client_name,
                    metadata: metadata || {},
                    updated_at: new Date().toISOString()
                })
                .eq("id", metadata.id)
                .eq("company_id", companyId)
                .select()
                .single();

            if (error) throw error;
            return NextResponse.json({ data });
        }

        const { data, error } = await supabase.from("exec_summary_templates").insert({
            company_id: companyId,
            template_name,
            section_id,
            content,
            client_name,
            metadata: metadata || {}
        }).select().single();

        if (error) throw error;

        return NextResponse.json({ data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
});

export const DELETE = withTenant(async (request, { companyId }) => {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "Missing ID" }, { status: 400 });
        }

        const supabase = await createClient() as any;
        const { error } = await supabase.from("exec_summary_templates")
            .delete()
            .eq("id", id)
            .eq("company_id", companyId);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
});
