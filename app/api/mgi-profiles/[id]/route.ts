import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { withTenant } from "@/utils/tenant-auth";

export const GET = withTenant(async (request, { companyId, params }) => {
    const supabase = createClient();
    const { id } = await params;
    const numId = parseInt(id);

    if (isNaN(numId)) {
        return NextResponse.json({ error: "Invalid profile ID" }, { status: 400 });
    }

    const { data, error } = await (supabase as any)
        .from('mgi_profiles')
        .select('*')
        .eq('id', numId)
        .eq('company_id', companyId)
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
});

export const PATCH = withTenant(async (request, { companyId, user, params }) => {
    const supabase = createClient();
    const { id } = await params;
    const numId = parseInt(id);

    if (isNaN(numId)) {
        return NextResponse.json({ error: "Invalid profile ID" }, { status: 400 });
    }

    const body = await request.json();
    const { name, thresholds, is_active, is_job_specific, description } = body;

    // Requirement: At any time only ONE active profile is allowed
    if (is_active && !is_job_specific) {
        const { data: existingActive } = await (supabase as any)
            .from('mgi_profiles')
            .select('id, name')
            .eq('is_active', true)
            .eq('is_job_specific', false)
            .eq('company_id', companyId)
            .eq('is_archived', false)
            .neq('id', numId)
            .maybeSingle();

        if (existingActive) {
            return NextResponse.json({
                error: `Only one active profile is allowed. "${existingActive.name}" is currently active. Please inactivate it first before activating this profile.`
            }, { status: 400 });
        }
    }

    const updatePayload: any = {
        updated_by: user?.email || 'system',
        updated_at: new Date().toISOString()
    };

    if (name !== undefined) updatePayload.name = name;
    if (description !== undefined) updatePayload.description = description;
    if (thresholds !== undefined) updatePayload.thresholds = thresholds;
    if (is_active !== undefined) updatePayload.is_active = !!is_active;
    if (is_job_specific !== undefined) updatePayload.is_job_specific = !!is_job_specific;

    const { data, error } = await (supabase as any)
        .from('mgi_profiles')
        .update(updatePayload)
        .eq('id', numId)
        .eq('company_id', companyId)
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
});

export const DELETE = withTenant(async (request, { companyId, params }) => {
    const supabase = createClient();
    const { id } = await params;
    const numId = parseInt(id);

    if (isNaN(numId)) {
        return NextResponse.json({ error: "Invalid profile ID" }, { status: 400 });
    }

    // 1. Fetch profile to check if it exists and whether it's active
    const { data: profile, error: profErr } = await (supabase as any)
        .from('mgi_profiles')
        .select('id, name, is_active, is_job_specific')
        .eq('id', numId)
        .eq('company_id', companyId)
        .maybeSingle();

    if (profErr || !profile) {
        return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (profile.is_active && !profile.is_job_specific) {
        return NextResponse.json({
            error: `Cannot delete profile "${profile.name}": It is currently set as the active global profile. Please deactivate or set another active profile first.`
        }, { status: 400 });
    }

    // 2. Check if the profile is used in any jobpack
    const { data: usedJobpacks, error: jpErr } = await (supabase as any)
        .from('jobpack')
        .select('id, name')
        .eq('mgi_profile_id', numId)
        .eq('company_id', companyId);

    if (jpErr) {
        return NextResponse.json({ error: jpErr.message }, { status: 500 });
    }

    if (usedJobpacks && usedJobpacks.length > 0) {
        const sampleNames = usedJobpacks.slice(0, 3).map((j: any) => j.name).join(", ");
        const moreCount = usedJobpacks.length > 3 ? ` and ${usedJobpacks.length - 3} more` : "";
        return NextResponse.json({
            error: `Cannot delete profile "${profile.name}": It is currently in use by ${usedJobpacks.length} jobpack(s) (${sampleNames}${moreCount}). Please unassign or switch profile on those jobpacks first.`
        }, { status: 400 });
    }

    // 3. Not in use by any jobpack -> Soft delete (archiving)
    const { error } = await (supabase as any)
        .from('mgi_profiles')
        .update({ is_archived: true, is_active: false })
        .eq('id', numId)
        .eq('company_id', companyId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `Profile "${profile.name}" deleted successfully` });
});
