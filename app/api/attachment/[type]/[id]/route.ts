import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; type: string }> }
) {
  const { id, type } = await params;

  const supabase = createClient();
  const { data: directData, error } = await supabase
    .from("attachment")
    .select("*")
    .eq("source_id", Number(id))
    .in("source_type", [type.toLowerCase(), type.toUpperCase()]);

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    } else if (error.code === "22P02") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    } else
      return NextResponse.json(
        { error: `Failed to fetch attachment for source id ${id} and source type ${type}` },
        { status: 500 }
      );
  }

  let data: any[] = directData ? [...directData] : [];

  if (type === "inspection" || type === "INSPECTION") {
    const { data: media, error: mediaError } = await (supabase as any)
      .from("insp_media")
      .select("*")
      .eq("inspection_id", Number(id));

    if (media && media.length > 0) {
      const normalizedMedia = (media as any[]).map((m: any) => ({
        id: `media-${m.media_id}`,
        name: m.name || `Snapshot ${m.media_id}`,
        path: m.file_path,
        source_id: m.inspection_id,
        source_type: "INSPECTION",
        meta: {
          ...m.meta,
          bucket: "inspection-media",
          is_insp_media: true,
        },
        cr_date: m.captured_at,
        created_at: m.captured_at || new Date().toISOString(),
      }));
      data = [...data, ...normalizedMedia];
    }
  }

  if (type.toLowerCase() === "component" || type.toLowerCase() === "structure_component") {
    // 1. Fetch component details
    const { data: comp } = await supabase
      .from("structure_components")
      .select("id, comp_id, q_id, structure_id")
      .eq("id", Number(id))
      .maybeSingle();

    const compIds = [Number(id)];
    if (comp?.comp_id && !isNaN(Number(comp.comp_id)) && Number(comp.comp_id) !== Number(id)) {
      compIds.push(Number(comp.comp_id));
    }

    // Direct component attachments from attachment table
    const { data: compAtts } = await supabase
      .from("attachment")
      .select("*")
      .in("source_id", compIds)
      .in("source_type", ["component", "COMPONENT", "structure_component", "STRUCTURE_COMPONENT"]);

    if (compAtts && compAtts.length > 0) {
      data = [...data, ...compAtts];
    }

    // 2. Fetch all inspection records linked to this component (by component_id OR QID)
    let inspRecords: any[] = [];
    if (comp?.structure_id) {
      const { data: allInsps } = await (supabase as any)
        .from("insp_records")
        .select("insp_id, jobpack_id, structure_id, component_id, component_qid, inspection_data")
        .eq("structure_id", comp.structure_id);

      const qidUpper = comp?.q_id ? comp.q_id.toUpperCase() : "";
      inspRecords = (allInsps || []).filter((r: any) => {
        if (r.component_id && compIds.includes(Number(r.component_id))) return true;
        if (qidUpper) {
          if (r.component_qid && String(r.component_qid).toUpperCase() === qidUpper) return true;
          if (r.inspection_data?.component && String(r.inspection_data.component).toUpperCase() === qidUpper) return true;
          if (r.inspection_data?.component_qid && String(r.inspection_data.component_qid).toUpperCase() === qidUpper) return true;
          if (r.inspection_data?.qid && String(r.inspection_data.qid).toUpperCase() === qidUpper) return true;
        }
        return false;
      });
    } else {
      const { data: directInsps } = await (supabase as any)
        .from("insp_records")
        .select("insp_id, jobpack_id, structure_id, component_id")
        .in("component_id", compIds);
      inspRecords = directInsps || [];
    }

    if (inspRecords && inspRecords.length > 0) {
      const inspIds = inspRecords.map((r: any) => r.insp_id);

      // 1. Fetch from attachment table
      const { data: inspAttachments } = await supabase
        .from("attachment")
        .select("*")
        .in("source_type", ["inspection", "INSPECTION"])
        .in("source_id", inspIds);

      // 2. Fetch from insp_media table
      const { data: inspMedia } = await (supabase as any)
        .from("insp_media")
        .select("*")
        .in("inspection_id", inspIds);

      const allInspAttachments = [
        ...(inspAttachments || []),
        ...((inspMedia || []) as any[]).map((m: any) => ({
          id: `media-${m.media_id}`,
          name: m.name || `Snapshot ${m.media_id}`,
          path: m.file_path,
          source_id: m.inspection_id,
          source_type: "INSPECTION",
          meta: {
            ...m.meta,
            bucket: "inspection-media",
            is_insp_media: true,
          },
          cr_date: m.captured_at,
          created_at: m.captured_at || new Date().toISOString(),
        })),
      ];

      if (allInspAttachments.length > 0) {
        // Fetch Jobpacks, Platforms, and Pipelines for enrichment
        const jobpackIds = Array.from(
          new Set(inspRecords.map((r: any) => r.jobpack_id).filter(Boolean) as number[])
        );
        const structureIds = Array.from(
          new Set(inspRecords.map((r: any) => r.structure_id).filter(Boolean) as number[])
        );

        const jobpackMap = new Map();
        if (jobpackIds.length > 0) {
          const { data: jobpacks } = await supabase
            .from("jobpack")
            .select("id, name")
            .in("id", jobpackIds);
          (jobpacks || []).forEach((jp: any) => jobpackMap.set(jp.id, jp.name));
        }

        const structureMap = new Map();
        if (structureIds.length > 0) {
          const { data: platforms } = await (supabase as any)
            .from("platform")
            .select("plat_id, title")
            .in("plat_id", structureIds);
          (platforms || []).forEach((p: any) => structureMap.set(p.plat_id, p.title));

          const { data: pipelines } = await (supabase as any)
            .from("pipeline")
            .select("pipe_id, title")
            .in("pipe_id", structureIds);
          (pipelines || []).forEach((p: any) => structureMap.set(p.pipe_id, p.title));
        }

        const inspMap = new Map();
        inspRecords.forEach((r: any) => inspMap.set(r.insp_id, r));

        const enrichedInspAttachments = allInspAttachments.map((att: any) => {
          const inspId = Number(att.source_id || att.inspection_id);
          const insp = inspMap.get(inspId);
          let sourceName = "Inspection";
          if (insp) {
            const jpName = jobpackMap.get(insp.jobpack_id);
            const strName = structureMap.get(insp.structure_id);
            if (jpName && strName) {
              sourceName = `${jpName} | ${strName}`;
            } else if (jpName) {
              sourceName = `JP: ${jpName}`;
            } else if (strName) {
              sourceName = strName;
            }
          }
          return {
            ...att,
            created_at: att.created_at || att.cr_date || new Date().toISOString(),
            source_name: sourceName,
            source_type: "Inspection",
          };
        });

        data = [...data, ...enrichedInspAttachments];
      }
    }

    // 3. Fetch all anomaly attachments linked to this component or its structure
    if (comp?.structure_id) {
      const { data: compAnomalies } = await (supabase as any)
        .from("v_anomaly_details")
        .select("anomaly_id, component_id, component_qid, display_ref_no, structure_id, jobpack_name")
        .eq("structure_id", comp.structure_id);

      const qidUpper = comp?.q_id ? comp.q_id.toUpperCase() : "";
      const matchedAnomalies = (compAnomalies || []).filter((a: any) => {
        if (a.component_id && compIds.includes(Number(a.component_id))) return true;
        if (qidUpper) {
          if (a.component_qid && String(a.component_qid).toUpperCase() === qidUpper) return true;
        }
        return false;
      });

      const anomalyIds = matchedAnomalies.map((a: any) => a.anomaly_id).filter(Boolean);
      const displayRefNos = matchedAnomalies.map((a: any) => String(a.display_ref_no || "").trim()).filter(Boolean);

      let anomAttachments: any[] = [];
      if (anomalyIds.length > 0) {
        const { data: directAnomAtts } = await supabase
          .from("attachment")
          .select("*")
          .in("source_type", ["anomaly", "ANOMALY", "defect", "DEFECT"])
          .in("source_id", anomalyIds);
        if (directAnomAtts) anomAttachments.push(...directAnomAtts);
      }

      // Structure-level attachments matching anomaly title/ref or prefix "Anomaly"
      const { data: strAtts } = await supabase
        .from("attachment")
        .select("*")
        .in("source_type", ["structure", "STRUCTURE", "pipeline", "PIPELINE", "platform", "PLATFORM"])
        .eq("source_id", comp.structure_id);

      (strAtts || []).forEach((att: any) => {
        const attName = String(att.name || "").toUpperCase();
        const attTitle = String(att.meta?.title || "").toUpperCase();
        const attDesc = String(att.meta?.description || "").toUpperCase();
        const attFile = String(att.meta?.original_file_name || "").toUpperCase();

        const matchesRef = displayRefNos.some((ref: string) => {
          const rUpper = ref.toUpperCase();
          const suffix = rUpper.split("/").pop() || "";
          return (
            attName.includes(rUpper) ||
            attTitle.includes(rUpper) ||
            attDesc.includes(rUpper) ||
            attFile.includes(rUpper) ||
            (suffix && (attName.includes(suffix) || attTitle.includes(suffix)))
          );
        });

        const isAnomalyNamed = attName.startsWith("ANOMALY ") || attTitle.startsWith("ANOMALY ") || attName.includes("ANOMALY");

        if (matchesRef || (isAnomalyNamed && matchedAnomalies.length > 0)) {
          anomAttachments.push({
            ...att,
            source_name: att.name || "Anomaly Attachment",
            source_type: "Anomaly",
          });
        }
      });

      if (anomAttachments.length > 0) {
        data = [...data, ...anomAttachments];
      }
    }
  }

  // Set source names for direct component attachments and normalize created_at
  data = data.map((att) => {
    const isComp = ["component", "structure_component"].includes(String(att.source_type || "").toLowerCase());
    return {
      ...att,
      created_at: att.created_at || att.cr_date || new Date().toISOString(),
      source_name: isComp ? "Direct Component" : (att.source_name || att.source_type || "Attachment"),
      source_type: isComp ? "Component" : (att.source_type || "Attachment"),
    };
  });

  // Deduplicate attachments by id or path
  const seenIds = new Set<string>();
  data = data.filter((att) => {
    const key = String(att.id || att.path || "");
    if (!key || seenIds.has(key)) return false;
    seenIds.add(key);
    return true;
  });

  // Enrich data with user information
  if (data && data.length > 0) {
    const userIds = Array.from(new Set(data.map((item) => item.user_id).filter(Boolean)));

    // Fetch user information using RPC function
    const { data: usersData, error: usersError } = await (supabase.rpc as any)("get_user_info", {
      user_ids: userIds,
    });

    // Create a map of user_id to user name
    const userMap = new Map();
    if (usersData && !usersError && Array.isArray(usersData)) {
      usersData.forEach((user: any) => {
        userMap.set(user.id, user.full_name || user.email || "Unknown User");
      });
    }

    // Enrich attachments with user names
    const enrichedData = data.map((attachment) => ({
      ...attachment,
      user_name: attachment.user_id
        ? userMap.get(attachment.user_id) || attachment.user_id
        : "System",
    }));

    return NextResponse.json({ data: enrichedData });
  }

  return NextResponse.json({ data });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; type: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const supabase = createClient();

  const { data, error } = await supabase.from("attachment").insert(body).single();

  console.log(body.file);

  const { error: uploadError } = await supabase.storage
    .from("attachments")
    .upload("uploads/test.jpg", body.file);

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    } else if (error.code === "22P02") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    } else
      return NextResponse.json(
        { error: `Failed to post attachment for structure id ${id}` },
        { status: 500 }
      );
  }

  if (uploadError) throw uploadError;

  return NextResponse.json({ data });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; type: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const supabase = createClient();

  const { data, error } = await supabase
    .from("attachment")
    .update(body)
    .eq("source_id", Number(id))
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    } else if (error.code === "22P02") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    } else
      return NextResponse.json(
        { error: `Failed to update attachment for structure id ${id}` },
        { status: 500 }
      );
  }

  return NextResponse.json({ data });
}
