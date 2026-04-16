import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const supabase = createClient();
    const { id } = await params;

    const { data, error } = await supabase
        .from('mgi_profiles')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const supabase = createClient();
    const { id } = await params;
    const body = await request.json();
    
    const { data: { user } } = await supabase.auth.getUser();

    // Activation management: only one global active profile at a time
    if (body.is_active && !body.is_job_specific) {
        await supabase
            .from('mgi_profiles')
            .update({ is_active: false })
            .eq('is_active', true)
            .eq('is_job_specific', false)
            .neq('id', id);
    }

    const { data, error } = await supabase
        .from('mgi_profiles')
        .update({
            ...body,
            updated_by: user?.email || 'system',
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const supabase = createClient();
    const { id } = await params;

    // We prefer soft delete (archiving)
    const { error } = await supabase
        .from('mgi_profiles')
        .update({ is_archived: true, is_active: false })
        .eq('id', id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
