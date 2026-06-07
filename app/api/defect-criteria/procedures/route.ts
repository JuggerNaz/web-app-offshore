import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { withTenant } from "@/utils/tenant-auth";

export const GET = withTenant(async (request, { companyId }) => {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');

        let query = (supabase as any)
            .from('defect_criteria_procedures')
            .select('*')
            .eq('company_id', companyId)
            .order('effective_date', { ascending: false });

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const procedures = data.map((proc: any) => ({
            id: proc.id.toString(),
            procedureNumber: proc.procedure_number,
            procedureName: proc.procedure_name,
            version: proc.version,
            effectiveDate: proc.effective_date,
            createdBy: proc.created_by,
            createdAt: proc.created_at,
            status: proc.status,
            notes: proc.notes
        }));

        return NextResponse.json(procedures);
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to fetch procedures' },
            { status: 500 }
        );
    }
});

export const POST = withTenant(async (request, { companyId }) => {
    try {
        const supabase = await createClient();
        const body = await request.json();

        const {
            procedureNumber,
            procedureName,
            effectiveDate,
            notes,
            copyFromProcedureId,
        } = body;

        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: existing } = await (supabase as any)
            .from('defect_criteria_procedures')
            .select('procedure_number, version')
            .eq('procedure_number', procedureNumber)
            .eq('company_id', companyId)
            .order('version', { ascending: false })
            .limit(1)
            .single();

        const nextVersion = existing ? existing.version + 1 : 1;

        const { data: newProcedure, error: procedureError } = await (supabase as any)
            .from('defect_criteria_procedures')
            .insert({
                procedure_number: procedureNumber,
                procedure_name: procedureName,
                version: nextVersion,
                effective_date: effectiveDate,
                created_by: user.id,
                status: 'draft',
                notes: notes || null,
                company_id: companyId,
            })
            .select()
            .single();

        if (procedureError) {
            return NextResponse.json(
                { error: procedureError.message },
                { status: 500 }
            );
        }

        if (copyFromProcedureId) {
            const { data: rulesToCopy } = await (supabase as any)
                .from('defect_criteria_rules')
                .select('*')
                .eq('procedure_id', copyFromProcedureId)
                .eq('company_id', companyId);

            if (rulesToCopy && rulesToCopy.length > 0) {
                const copiedRules = rulesToCopy.map((rule: any) => ({
                    procedure_id: newProcedure.id,
                    structure_group: rule.structure_group,
                    priority_id: rule.priority_id,
                    defect_code_id: rule.defect_code_id,
                    defect_type_id: rule.defect_type_id,
                    jobpack_type: rule.jobpack_type,
                    elevation_min: rule.elevation_min,
                    elevation_max: rule.elevation_max,
                    nominal_thickness: rule.nominal_thickness,
                    threshold_value: rule.threshold_value,
                    threshold_operator: rule.threshold_operator,
                    custom_parameters: rule.custom_parameters,
                    auto_flag: rule.auto_flag,
                    alert_message: rule.alert_message,
                    rule_order: rule.rule_order,
                    evaluation_priority: rule.evaluation_priority,
                    company_id: companyId,
                }));

                await (supabase as any)
                    .from('defect_criteria_rules')
                    .insert(copiedRules);
            }
        }

        const createdProcedure = {
            id: newProcedure.id.toString(),
            procedureNumber: newProcedure.procedure_number,
            procedureName: newProcedure.procedure_name,
            version: newProcedure.version,
            effectiveDate: newProcedure.effective_date,
            createdBy: newProcedure.created_by,
            createdAt: newProcedure.created_at,
            status: newProcedure.status,
            notes: newProcedure.notes
        };

        return NextResponse.json(createdProcedure, { status: 201 });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to create procedure' },
            { status: 500 }
        );
    }
});
