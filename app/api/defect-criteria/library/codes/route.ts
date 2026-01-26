import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/defect-criteria/library/codes
 * Fetch defect codes from U_LIB_LIST (AMLY_COD)
 * Query params: structureType (platform|pipeline)
 */
export async function GET(request: Request) {
    try {
        const supabase = await createClient();
        const { searchParams } = new URL(request.url);
        const structureType = searchParams.get('structureType') || 'platform';

        let query = (supabase as any)
            .from('u_lib_list')
            .select('*')
            .eq('lib_code', 'AMLY_COD')
            .or('lib_delete.is.null,lib_delete.eq.0');

        // Platform: exclude codes with 'PIPELINE' in description
        if (structureType === 'platform') {
            query = query.not('lib_desc', 'ilike', '%PIPELINE%');
        }

        const { data, error } = await query.order('lib_desc');

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to fetch defect codes' },
            { status: 500 }
        );
    }
}
