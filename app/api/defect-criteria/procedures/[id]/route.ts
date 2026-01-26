import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/defect-criteria/procedures/[id]
 * Fetch a specific procedure with its rules
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient();
        const { id } = await params;

        // Fetch procedure
        const { data: procedure, error: procedureError } = await (supabase as any)
            .from('defect_criteria_procedures')
            .select('*')
            .eq('id', id)
            .single();

        if (procedureError) {
            return NextResponse.json(
                { error: procedureError.message },
                { status: 404 }
            );
        }

        // Fetch associated rules
        const { data: rules, error: rulesError } = await (supabase as any)
            .from('defect_criteria_rules')
            .select('*')
            .eq('procedure_id', id)
            .order('evaluation_priority', { ascending: false })
            .order('rule_order', { ascending: true });

        if (rulesError) {
            return NextResponse.json(
                { error: rulesError.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            id: procedure.id.toString(),
            procedureNumber: procedure.procedure_number,
            procedureName: procedure.procedure_name,
            version: procedure.version,
            effectiveDate: procedure.effective_date,
            createdBy: procedure.created_by,
            createdAt: procedure.created_at,
            status: procedure.status,
            notes: procedure.notes,
            rules: rules || [], // Keeping rules here just in case, though they likely need mapping too if used
        });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to fetch procedure' },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/defect-criteria/procedures/[id]
 * Update a procedure's status or details
 */
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient();
        const { id } = await params;
        const body = await request.json();

        // Map camelCase to snake_case
        const updates: any = {};
        if (body.procedureNumber !== undefined) updates.procedure_number = body.procedureNumber;
        if (body.procedureName !== undefined) updates.procedure_name = body.procedureName;
        if (body.effectiveDate !== undefined) updates.effective_date = body.effectiveDate;
        if (body.status !== undefined) updates.status = body.status;
        if (body.notes !== undefined) updates.notes = body.notes;

        console.log('PATCH Request Body:', body);
        console.log('Mapped Updates:', updates);

        // If no valid fields to update
        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No valid update fields found', receivedKeys: Object.keys(body) }, { status: 400 });
        }

        const { data, error } = await (supabase as any)
            .from('defect_criteria_procedures')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Update error details:', JSON.stringify(error, null, 2));
            return NextResponse.json({
                error: error.message,
                details: error.details,
                hint: error.hint
            }, { status: 500 });
        }

        // Map snake_case to camelCase
        const updatedProcedure = {
            id: data.id.toString(),
            procedureNumber: data.procedure_number,
            procedureName: data.procedure_name,
            version: data.version,
            effectiveDate: data.effective_date,
            createdBy: data.created_by,
            createdAt: data.created_at,
            status: data.status,
            notes: data.notes
        };

        return NextResponse.json(updatedProcedure);
    } catch (error) {
        console.error('PATCH handler error:', error);
        return NextResponse.json(
            { error: 'Failed to update procedure' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/defect-criteria/procedures/[id]
 * Delete a procedure (only if in draft status)
 */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient();
        const { id } = await params;

        // Check if procedure is in draft status
        const { data: procedure } = await (supabase as any)
            .from('defect_criteria_procedures')
            .select('status')
            .eq('id', id)
            .single();

        if (procedure?.status !== 'draft') {
            return NextResponse.json(
                { error: 'Only draft procedures can be deleted' },
                { status: 400 }
            );
        }

        const { error } = await (supabase as any)
            .from('defect_criteria_procedures')
            .delete()
            .eq('id', id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to delete procedure' },
            { status: 500 }
        );
    }
}
