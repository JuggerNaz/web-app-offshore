import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data } = await supabase.from('webapp_3d').select('*, structure_components(*)').eq('structure_id', 1510);
    const matches = data.filter((x: any) => x.structure_components?.q_id?.includes('144') || x.structure_components?.q_id?.includes('147'));
    return NextResponse.json(matches);
}
