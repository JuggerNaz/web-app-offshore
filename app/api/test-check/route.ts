import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  const supabase = createClient();
  const { data: comps } = await supabase
    .from("structure_components")
    .select("*")
    .in("q_id", ["BAN002", "BL-supp-10", "CS-S1-SUPP-9M"]);

  let results: any = { comps };

  if (comps && comps.length > 0) {
    const ids = comps.map((c: any) => c.id);
    const { data: atts } = await supabase
      .from("attachment")
      .select("*")
      .in("source_id", ids)
      .in("source_type", ["component", "COMPONENT", "structure_component"]);
    
    results.directAtts = atts;

    const { data: inspRecords } = await (supabase as any)
      .from("insp_records")
      .select("insp_id, component_id")
      .in("component_id", ids);
    
    results.inspRecords = inspRecords;

    if (inspRecords && inspRecords.length > 0) {
      const inspIds = inspRecords.map((r: any) => r.insp_id);
      const { data: inspAtts } = await supabase
        .from("attachment")
        .select("*")
        .in("source_id", inspIds)
        .in("source_type", ["INSPECTION", "inspection"]);
      results.inspAtts = inspAtts;
    }
  }

  return NextResponse.json(results);
}
