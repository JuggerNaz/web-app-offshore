import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

/**
 * PATCH /api/defect-criteria/rules/[id]
 * Update a defect criteria rule
 */
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient();
        const { id } = await params;
        const body = await request.json();

        const {
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

        // Map camelCase to snake_case for DB
        const updateData: any = {
            structure_group: structureGroup,
            priority_id: priorityId,
            defect_code_id: defectCodeId,
            defect_type_id: defectTypeId,
            jobpack_type: jobpackType,
            elevation_min: elevationMin,
            elevation_max: elevationMax,
            nominal_thickness: nominalThickness,
            threshold_value: thresholdValue,
            threshold_text: thresholdText,
            threshold_operator: thresholdOperator,
            custom_parameters: customParameters,
            auto_flag: autoFlag,
            alert_message: alertMessage,
            evaluation_priority: evaluationPriority,
        };

        // Remove undefined keys so we don't overwrite with null unless intended
        Object.keys(updateData).forEach(
            (key) => updateData[key] === undefined && delete updateData[key]
        );

        const { data, error } = await supabase
            .from('defect_criteria_rules')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to update rule' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/defect-criteria/rules/[id]
 * Delete a defect criteria rule
 */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient();
        const { id } = await params;

        const { error } = await supabase
            .from('defect_criteria_rules')
            .delete()
            .eq('id', id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to delete rule' },
            { status: 500 }
        );
    }
}
