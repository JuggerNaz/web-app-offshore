import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/defect-criteria/library/priorities
 * Fetch defect priorities from U_LIB_LIST (AMLY_TYP)
 */
export async function GET() {
    try {
        const supabase = await createClient();

        const { data, error } = await supabase
            .from('u_lib_list')
            .select('*')
            .eq('lib_code', 'AMLY_TYP')
            .or('lib_delete.is.null,lib_delete.eq.0')
            .order('lib_desc');

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to fetch priorities' },
            { status: 500 }
        );
    }
}
