import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ structure_id: string }> }
) {
  try {
    const supabase = await createClient();
    const { structure_id } = await params;

    if (!structure_id) {
      return NextResponse.json(
        { error: "Structure ID is required" },
        { status: 400 }
      );
    }

    const structId = parseInt(structure_id);

    // Fetch components for structure (both active and archived)
    const { data: components, error: compError } = await supabase
      .from("structure_components")
      .select("*")
      .eq("structure_id", structId)
      .order("q_id", { ascending: true });

    if (compError) {
      return NextResponse.json({ error: compError.message }, { status: 400 });
    }

    // Fetch ALL inspection records for this structure
    const { data: inspRecords } = await supabase
      .from("insp_records")
      .select(`
        insp_id, component_id, has_anomaly, status, inspection_date, inspection_type_code, description, sow_report_no, inspection_data,
        jobpack:jobpack_id(id, name)
      `)
      .eq("structure_id", structId);

    // Fetch ALL anomalies for this structure
    const { data: componentAnomalies } = await (supabase as any)
      .from("v_anomaly_details")
      .select(
        "anomaly_id, component_id, component_qid, priority, status, defect_type, category, description, display_ref_no, jobpack_name"
      )
      .eq("structure_id", structId);

    const mappedData = (components || []).map((item: any) => {
      const qidUpper = item.q_id ? item.q_id.toUpperCase() : "";

      const compInsps = (inspRecords || []).filter((r: any) => {
        if (r.component_id && r.component_id === item.id) return true;
        if (qidUpper) {
          if (r.component_qid && String(r.component_qid).toUpperCase() === qidUpper) return true;
          if (r.inspection_data?.component && String(r.inspection_data.component).toUpperCase() === qidUpper) return true;
          if (r.inspection_data?.component_qid && String(r.inspection_data.component_qid).toUpperCase() === qidUpper) return true;
          if (r.inspection_data?.qid && String(r.inspection_data.qid).toUpperCase() === qidUpper) return true;
        }
        return false;
      });

      const compAnoms = (componentAnomalies || []).filter((a: any) => {
        if (a.component_id && a.component_id === item.id) return true;
        if (qidUpper) {
          if (a.component_qid && String(a.component_qid).toUpperCase() === qidUpper) return true;
          if (a.component_name && String(a.component_name).toUpperCase() === qidUpper) return true;
          if (a.q_id && String(a.q_id).toUpperCase() === qidUpper) return true;
          if (a.description && String(a.description).toUpperCase().includes(qidUpper)) return true;
        }
        return false;
      });

      const hasAnom = compAnoms.length > 0 || compInsps.some((r: any) => r.has_anomaly || String(r.status).toUpperCase() === 'ANOMALY');

      return {
        ...item,
        qid: item.q_id,
        type: item.code,
        inspections: compInsps,
        anomalies: compAnoms,
        has_anomaly: hasAnom,
        hasAnomaly: hasAnom,
        is_deleted: Boolean(item.is_deleted || item.is_archived || item.archived),
      };
    });

    return NextResponse.json({ data: mappedData });
  } catch (error: any) {
    console.error("[structure-components/[structure_id]] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
