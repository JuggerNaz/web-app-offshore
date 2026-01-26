import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/defect-criteria/library/structure-groups
 * Fetch structure groups from U_LIB_LIST (COMPGRP)
 */
export async function GET() {
    try {
        const supabase = await createClient();

        const { data, error } = await supabase
            .from('u_lib_list')
            .select('*')
            .eq('lib_code', 'COMPGRP')
            .or('lib_delete.is.null,lib_delete.eq.0')
            .order('lib_desc');

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to fetch structure groups' },
            { status: 500 }
        );
    }
}
