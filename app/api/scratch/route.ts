// @ts-nocheck
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
    const supabase = createClient();
    
    // Check u_sow_items for SOW 1 (which is PLAT-C)
    const { data: sowItems1 } = await supabase.from('u_sow_items').select('id, sow_id, report_number, component_qid, component_id, component_type').eq('sow_id', 1).limit(10);
    
    // Also check for SOW 2 & 3 (PLAT-B)
    const { data: sowItems2 } = await supabase.from('u_sow_items').select('id, sow_id, report_number, component_qid, component_id, component_type').in('sow_id', [2,3]).limit(10);

    return NextResponse.json({ sowItems1, sowItems2 });
}
