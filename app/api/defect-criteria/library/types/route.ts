import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/defect-criteria/library/types
 * Uses Database View v_defect_types_by_code (Updated Schema)
 * Logic: code_1 = Defect Code (Input), code_2 = Defect Type (Output)
 */
export async function GET(request: Request) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const defectCodeId = searchParams.get('defectCodeId');

        if (!defectCodeId) {
            // Fetch ALL defect types if no code specified (for lookup maps)
            const { data: allTypes, error: allTypesError } = await supabase
                .from('u_lib_list')
                .select('lib_id, lib_desc, lib_code')
                .eq('lib_code', 'AMLY_FND')
                .or('lib_delete.is.null,lib_delete.eq.0')
                .order('lib_desc');

            if (allTypesError) {
                return NextResponse.json({ error: allTypesError.message }, { status: 500 });
            }
            return NextResponse.json(allTypes);
        }

        // ---------------------------------------------------------
        // METHOD 1: Database View (Optimized)
        // ---------------------------------------------------------
        try {
            const { data, error } = await supabase
                .from('v_defect_types_by_code')
                .select('lib_id, lib_desc') // Only fetch needed columns
                .eq('defect_code_id', defectCodeId) // User confirmed alias is defect_code_id
                .order('lib_desc');

            if (!error) {
                return NextResponse.json(data);
            }
            console.warn('View retrieval failed, attempting fallback logic:', error.message);
        } catch (viewError) {
            console.warn('View access exception:', viewError);
        }

        // ---------------------------------------------------------
        // METHOD 2: Fallback (Manual 2-Step Fetch)
        // ---------------------------------------------------------

        // 1. Get Combo Targets (code_1 is Parent/Input, code_2 is Child/Output)
        const { data: combos } = await supabase
            .from('u_lib_combo')
            .select('code_2') // We need the Type ID
            .eq('lib_code', 'AMLYCODFND')
            .eq('code_1', defectCodeId) // Input matches code_1
            .or('lib_delete.is.null,lib_delete.eq.0');

        if (!combos || combos.length === 0) {
            return NextResponse.json([]);
        }

        const typeIds = combos.map((c: any) => c.code_2);

        // 2. Get Types (AMLY_FND) matching those IDs
        const { data: manualData, error: manualError } = await supabase
            .from('u_lib_list')
            .select('lib_id, lib_desc, lib_code')
            .eq('lib_code', 'AMLY_FND')
            .or('lib_delete.is.null,lib_delete.eq.0')
            .in('lib_id', typeIds)
            .order('lib_desc');

        if (manualError) {
            throw manualError;
        }

        return NextResponse.json(manualData || []);

    } catch (error) {
        console.error('Defect Type API Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch defect types' },
            { status: 500 }
        );
    }
}
