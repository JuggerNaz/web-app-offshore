import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pipelineId = Number(id);

  if (isNaN(pipelineId)) {
    return NextResponse.json({ error: "Invalid pipeline ID" }, { status: 400 });
  }

  const supabase = createClient();

  try {
    // 1. Query riser components
    const { data: risers, error } = await (supabase as any)
      .from("structure_components")
      .select("id, comp_id, structure_id, q_id, id_no, code, metadata, is_deleted, created_at, updated_at")
      .or("code.ilike.RS,code.ilike.rs")
      .or("is_deleted.is.null,is_deleted.eq.false");

    if (error) {
      console.error("[associated-risers] Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 2. Filter components where metadata->>associated_pipeline_id matches pipelineId
    const matchingRisers = (risers || []).filter((r: any) => {
      let md: any = r.metadata;
      if (typeof md === "string") {
        try {
          md = JSON.parse(md);
        } catch {
          md = {};
        }
      }
      if (!md) return false;
      const assocId = md.associated_pipeline_id;
      return assocId !== undefined && assocId !== null && (Number(assocId) === pipelineId || String(assocId) === String(pipelineId));
    });

    if (matchingRisers.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // 3. Resolve Platform titles for the risers
    const structureIds = Array.from(new Set(matchingRisers.map((r: any) => Number(r.structure_id)).filter(Boolean)));
    const platformMap = new Map<number, { title: string; str_name?: string }>();

    if (structureIds.length > 0) {
      const { data: platforms } = await (supabase as any)
        .from("platform")
        .select("plat_id, title, str_name")
        .in("plat_id", structureIds);

      (platforms || []).forEach((p: any) => {
        platformMap.set(Number(p.plat_id), { title: p.title || p.str_name || `Platform #${p.plat_id}`, str_name: p.str_name });
      });
    }

    const enrichedRisers = matchingRisers.map((r: any) => {
      let md: any = r.metadata;
      if (typeof md === "string") {
        try {
          md = JSON.parse(md);
        } catch {
          md = {};
        }
      }
      const platInfo = platformMap.get(Number(r.structure_id));
      return {
        ...r,
        metadata: md,
        platform_id: r.structure_id,
        platform_title: platInfo?.title || `Platform #${r.structure_id}`,
        platform_name: platInfo?.str_name || platInfo?.title || `Platform #${r.structure_id}`,
      };
    });

    return NextResponse.json({ success: true, data: enrichedRisers });
  } catch (err: any) {
    console.error("[associated-risers] Internal error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch associated risers" }, { status: 500 });
  }
}

