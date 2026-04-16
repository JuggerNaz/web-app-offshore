import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const jobpackId = searchParams.get('jobpack_id');

    let query = supabase.from('mgi_profiles')
        .select('*')
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

    if (jobpackId) {
        // If jobpack_id is provided, we might want to filter specifically 
        // but the requirement is that multiple jobpacks use the same profile.
        // We could filter for profiles linked to this jobpack via the jobpack table.
        const { data: jobData } = await supabase
            .from('jobpack')
            .select('mgi_profile_id')
            .eq('id', parseInt(jobpackId))
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
}

export async function POST(request: NextRequest) {
    const supabase = createClient();
    const body = await request.json();
    const { name, thresholds, is_active, is_job_specific, description } = body;

    const { data: { user } } = await supabase.auth.getUser();

    // Activation management: only one global active profile at a time
    if (is_active && !is_job_specific) {
        await supabase
            .from('mgi_profiles')
            .update({ is_active: false })
            .eq('is_active', true)
            .eq('is_job_specific', false);
    }

    const { data, error } = await supabase
        .from('mgi_profiles')
        .insert({
            name,
            thresholds,
            is_active: !!is_active,
            is_job_specific: !!is_job_specific,
            description,
            created_by: user?.email || 'system',
            updated_by: user?.email || 'system'
        })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
}
