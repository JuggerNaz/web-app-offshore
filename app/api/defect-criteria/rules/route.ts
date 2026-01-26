import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/defect-criteria/rules
 * Fetch rules for a specific procedure
 */
export async function GET(request: Request) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const procedureId = searchParams.get('procedureId');

        if (!procedureId) {
            return NextResponse.json(
                { error: 'procedureId is required' },
                { status: 400 }
            );
        }

        const { data, error } = await supabase
            .from('defect_criteria_rules')
            .select('*')
            .eq('procedure_id', procedureId)
            .order('evaluation_priority', { ascending: false })
            .order('rule_order', { ascending: true });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Transform snake_case to camelCase to match Frontend interfaces
        const camelData = data.map(r => ({
            id: r.id,
            procedureId: r.procedure_id,
            structureGroup: r.structure_group,
            priorityId: r.priority_id,
            defectCodeId: r.defect_code_id,
            defectTypeId: r.defect_type_id,
            jobpackType: r.jobpack_type,
            elevationMin: r.elevation_min,
            elevationMax: r.elevation_max,
            nominalThickness: r.nominal_thickness,
            thresholdValue: r.threshold_value,
            thresholdText: r.threshold_text,
            thresholdOperator: r.threshold_operator,
            customParameters: r.custom_parameters,
            autoFlag: r.auto_flag,
            alertMessage: r.alert_message,
            ruleOrder: r.rule_order,
            evaluationPriority: r.evaluation_priority,
            createdAt: r.created_at,
            updatedAt: r.updated_at
        }));

        return NextResponse.json(camelData);
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to fetch rules' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/defect-criteria/rules
 * Create a new defect criteria rule
 */
export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const body = await request.json();

        const {
            procedureId,
            structureGroup,
            priorityId,
            defectCodeId,
            defectTypeId,
            jobpackType,
            elevationMin,
            elevationMax,
            nominalThickness,
            thresholdValue,
            thresholdText,
            thresholdOperator,
            customParameters,
            autoFlag,
            alertMessage,
            evaluationPriority,
        } = body;

        // Get the current max rule_order for this procedure
        const { data: maxOrderRule } = await supabase
            .from('defect_criteria_rules')
            .select('rule_order')
            .eq('procedure_id', procedureId)
            .order('rule_order', { ascending: false })
            .limit(1)
            .single();

        const nextOrder = maxOrderRule ? maxOrderRule.rule_order + 1 : 1;

        const { data, error } = await supabase
            .from('defect_criteria_rules')
            .insert({
                procedure_id: procedureId,
                structure_group: structureGroup,
                priority_id: priorityId,
                defect_code_id: defectCodeId,
                defect_type_id: defectTypeId,
                jobpack_type: jobpackType || null,
                elevation_min: elevationMin || null,
                elevation_max: elevationMax || null,
                nominal_thickness: nominalThickness || null,
                threshold_value: thresholdValue || null,
                threshold_text: thresholdText || null,
                threshold_operator: thresholdOperator || null,
                custom_parameters: customParameters || null,
                auto_flag: autoFlag,
                alert_message: alertMessage,
                rule_order: nextOrder,
                evaluation_priority: evaluationPriority || 0,
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data, { status: 201 });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to create rule' },
            { status: 500 }
        );
    }
}
