import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { withTenant } from "@/utils/tenant-auth";

export const GET = withTenant(async (request, { companyId }) => {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const jobpackId = searchParams.get('jobpack_id');

    let query = (supabase as any).from('mgi_profiles')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

    if (jobpackId) {
        const { data: jobData } = await (supabase as any)
            .from('jobpack')
            .select('mgi_profile_id')
            .eq('id', parseInt(jobpackId))
            .eq('company_id', companyId)
            .single();
            
        if (jobData?.mgi_profile_id) {
            query = query.eq('id', jobData.mgi_profile_id);
        }
    }

    const { data, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
});

export const POST = withTenant(async (request, { companyId }) => {
    const supabase = createClient();
    const body = await request.json();
    const { name, thresholds, is_active, is_job_specific, description } = body;

    const { data: { user } } = await supabase.auth.getUser();

    if (is_active && !is_job_specific) {
        await (supabase as any)
            .from('mgi_profiles')
            .update({ is_active: false })
            .eq('is_active', true)
            .eq('is_job_specific', false)
            .eq('company_id', companyId);
    }

    const { data, error } = await (supabase as any)
        .from('mgi_profiles')
        .insert({
            name,
            thresholds,
            is_active: !!is_active,
            is_job_specific: !!is_job_specific,
            description,
            created_by: user?.email || 'system',
            updated_by: user?.email || 'system',
            company_id: companyId,
        })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
});
