import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/utils/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; type: string }> }
) {
  const { id, type } = await params;

  const useAdmin = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = useAdmin ? createAdminClient() : createClient();
  const numericId = Number(id);

  if (isNaN(numericId)) {
    return NextResponse.json({ error: "Invalid source ID" }, { status: 400 });
  }

  let data: any[] = [];

  if (type.toLowerCase() === "inspection") {
    // 1. Fetch anomaly IDs linked to this inspection record
    const { data: anomalies } = await (supabase as any)
      .from("insp_anomalies")
      .select("anomaly_id")
      .eq("inspection_id", numericId);

    const anomalyIds = (anomalies || []).map((a: any) => a.anomaly_id).filter(Boolean);
    const allSourceIds = [numericId, ...anomalyIds];

    // 2. Fetch all attachments for inspection + its anomalies
    const { data: directData } = await supabase
      .from("attachment")
      .select("*")
      .in("source_id", allSourceIds)
      .in("source_type", ["inspection", "INSPECTION", "anomaly", "ANOMALY", "defect", "DEFECT", "insp_record", "INSP_RECORD"]);

    if (directData && directData.length > 0) {
      data.push(...directData);
    }

    // 3. Fetch from insp_media
    const { data: media } = await (supabase as any)
      .from("insp_media")
      .select("*")
      .or(`inspection_id.eq.${numericId}${anomalyIds.length > 0 ? `,anomaly_id.in.(${anomalyIds.join(',')})` : ''}`);

    if (media && media.length > 0) {
      const normalizedMedia = (media as any[]).map((m: any) => ({
        id: `media-${m.media_id}`,
        name: m.name || m.file_name || `Snapshot ${m.media_id}`,
        path: m.file_path,
        source_id: m.inspection_id || numericId,
        source_type: "INSPECTION",
        meta: {
          ...m.meta,
          bucket: "inspection-media",
          is_insp_media: true,
        },
        cr_date: m.captured_at,
        created_at: m.captured_at || new Date().toISOString(),
      }));
      for (const nm of normalizedMedia) {
        if (!data.some(d => d.path === nm.path || String(d.id) === String(nm.id))) {
          data.push(nm);
        }
      }
    }

    return NextResponse.json(data);
  }

  const { data: directData, error } = await supabase
    .from("attachment")
    .select("*")
    .eq("source_id", numericId)
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

  data = directData ? [...directData] : [];

  if (type.toLowerCase() === "component" || type.toLowerCase() === "structure_component") {
    const { searchParams } = new URL(request.url);
    const paramStructureId = searchParams.get("structure_id") || searchParams.get("structureId");

    // 1. Fetch component details
    const { data: comp } = await supabase
      .from("structure_components")
      .select("id, comp_id, q_id, id_no, structure_id")
      .or(`id.eq.${numericId},comp_id.eq.${numericId}`)
      .maybeSingle();

    const effectiveStructureId = comp?.structure_id || (paramStructureId ? Number(paramStructureId) : undefined);

    const compIds = Array.from(
      new Set([numericId, Number(comp?.id), Number(comp?.comp_id)].filter((n) => !isNaN(n) && n > 0))
    );
    const qid = (comp?.q_id || "").trim();
    const qidUpper = qid.toUpperCase();

    // Direct component attachments from attachment table
    const { data: compAtts } = await supabase
      .from("attachment")
      .select("*")
      .in("source_id", compIds)
      .in("source_type", ["component", "COMPONENT", "structure_component", "STRUCTURE_COMPONENT", "structure_components"]);

    if (compAtts && compAtts.length > 0) {
      data = [...data, ...compAtts.map(a => ({ ...a, source_name: "Direct Component", source_type: "Component" }))];
    }

    // 2. Fetch all inspection records linked to this component (by component_id OR QID)
    let inspQuery = supabase
      .from("insp_records")
      .select("insp_id, jobpack_id, structure_id, component_id, component_qid, sow_report_no, inspection_type_code, description, inspection_date");

    if (effectiveStructureId) {
      inspQuery = inspQuery.eq("structure_id", effectiveStructureId);
    }

    const orConditions = [`component_id.in.(${compIds.join(",")})`];
    if (qid) {
      orConditions.push(`component_qid.ilike.${qid}`);
    }
    inspQuery = inspQuery.or(orConditions.join(","));

    const { data: directInsps } = await inspQuery;
    const inspRecords: any[] = directInsps || [];

    // 3. Fetch all anomaly details linked to this component (by component_id OR QID)
    let anomQuery = (supabase as any)
      .from("v_anomaly_details")
      .select("anomaly_id, id, display_ref_no, component_id, component_qid, structure_id, jobpack_name, sow_report_no, defect_type, description, priority");

    if (effectiveStructureId) {
      anomQuery = anomQuery.eq("structure_id", effectiveStructureId);
    }
    anomQuery = anomQuery.or(`component_id.in.(${compIds.join(",")})${qid ? `,component_qid.ilike.${qid}` : ""}`);

    const { data: compAnomalies } = await anomQuery;
    const matchedAnomalies: any[] = compAnomalies || [];

    // Also check raw insp_anomalies if any inspection has anomalies
    const directInspIds = inspRecords.map((r: any) => Number(r.insp_id)).filter(Boolean);
    if (directInspIds.length > 0 || compIds.length > 0) {
      const { data: rawAnoms } = await (supabase as any)
        .from("insp_anomalies")
        .select("anomaly_id, inspection_id, anomaly_ref_no, defect_type_code, defect_description, component_id")
        .or(`component_id.in.(${compIds.join(",")})${directInspIds.length > 0 ? `,inspection_id.in.(${directInspIds.join(",")})` : ""}`);

      (rawAnoms || []).forEach((ra: any) => {
        if (!matchedAnomalies.some((ma) => ma.anomaly_id === ra.anomaly_id)) {
          matchedAnomalies.push({
            anomaly_id: ra.anomaly_id,
            id: ra.inspection_id,
            display_ref_no: ra.anomaly_ref_no,
            defect_type: ra.defect_type_code,
            description: ra.defect_description,
          });
        }
      });
    }

    const allInspIds = Array.from(
      new Set([
        ...directInspIds,
        ...matchedAnomalies.map((a: any) => Number(a.id || a.inspection_id)).filter(Boolean),
      ])
    );

    const allAnomalyIds = Array.from(
      new Set(matchedAnomalies.map((a: any) => Number(a.anomaly_id)).filter(Boolean))
    );

    // 4. Fetch inspection attachments and media
    if (allInspIds.length > 0) {
      const { data: inspAttachments } = await supabase
        .from("attachment")
        .select("*")
        .in("source_type", ["inspection", "INSPECTION", "insp_record", "INSP_RECORD"])
        .in("source_id", allInspIds);

      const { data: inspMedia } = await (supabase as any)
        .from("insp_media")
        .select("*")
        .in("inspection_id", allInspIds);

      const allInspAttachments = [
        ...(inspAttachments || []),
        ...((inspMedia || []) as any[]).map((m: any) => ({
          id: `media-${m.media_id}`,
          name: m.name || m.file_name || `Snapshot ${m.media_id}`,
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
        // Fetch Jobpacks and Structures for enrichment
        const jobpackIds = Array.from(
          new Set(inspRecords.map((r: any) => r.jobpack_id).filter(Boolean) as number[])
        );
        const structureIds = Array.from(
          new Set(
            [effectiveStructureId, ...inspRecords.map((r: any) => r.structure_id)].filter(Boolean) as number[]
          )
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
          let sourceName = att.name || "Inspection";
          if (insp) {
            const jpName = jobpackMap.get(insp.jobpack_id);
            const strName = structureMap.get(insp.structure_id);
            if (jpName && strName) {
              sourceName = `${att.name || "Inspection"} (${jpName} | ${strName})`;
            } else if (jpName) {
              sourceName = `${att.name || "Inspection"} (${jpName})`;
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

    // 5. Fetch anomaly attachments
    if (allAnomalyIds.length > 0) {
      const { data: directAnomAtts } = await supabase
        .from("attachment")
        .select("*")
        .in("source_type", ["anomaly", "ANOMALY", "defect", "DEFECT"])
        .in("source_id", allAnomalyIds);

      const { data: anomMedia } = await (supabase as any)
        .from("insp_media")
        .select("*")
        .in("anomaly_id", allAnomalyIds);

      const allAnomAttachments = [
        ...(directAnomAtts || []),
        ...((anomMedia || []) as any[]).map((m: any) => ({
          id: `media-anom-${m.media_id}`,
          name: m.name || m.file_name || `Anomaly Snapshot ${m.media_id}`,
          path: m.file_path,
          source_id: m.anomaly_id,
          source_type: "ANOMALY",
          meta: {
            ...m.meta,
            bucket: "inspection-media",
            is_insp_media: true,
          },
          cr_date: m.captured_at,
          created_at: m.captured_at || new Date().toISOString(),
        })),
      ];

      if (allAnomAttachments.length > 0) {
        const enrichedAnomAtts = allAnomAttachments.map((att: any) => {
          const anom = matchedAnomalies.find((a: any) => a.anomaly_id === att.source_id);
          const ref = anom?.display_ref_no || anom?.anomaly_ref_no || `Anomaly #${att.source_id}`;
          return {
            ...att,
            created_at: att.created_at || att.cr_date || new Date().toISOString(),
            source_name: att.name ? `${att.name} (${ref})` : ref,
            source_type: "Anomaly",
          };
        });
        data = [...data, ...enrichedAnomAtts];
      }
    }

    // 6. Structure-level attachments matching anomaly ref or component QID
    if (effectiveStructureId) {
      const displayRefNos = matchedAnomalies
        .map((a: any) => String(a.display_ref_no || "").trim())
        .filter(Boolean);

      const { data: strAtts } = await supabase
        .from("attachment")
        .select("*")
        .in("source_type", ["structure", "STRUCTURE", "pipeline", "PIPELINE", "platform", "PLATFORM"])
        .eq("source_id", effectiveStructureId);

      const matchedStrAtts: any[] = [];
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

        const matchesQid =
          qidUpper &&
          (attName.includes(qidUpper) ||
            attTitle.includes(qidUpper) ||
            attDesc.includes(qidUpper) ||
            attFile.includes(qidUpper));

        if (matchesRef || matchesQid) {
          matchedStrAtts.push({
            ...att,
            created_at: att.created_at || att.cr_date || new Date().toISOString(),
            source_name: att.name || "Structure File",
            source_type: matchesRef ? "Anomaly" : "Component",
          });
        }
      });

      if (matchedStrAtts.length > 0) {
        data = [...data, ...matchedStrAtts];
      }
    }
  }

  // Set source names for direct component attachments and normalize created_at
  data = data.map((att) => {
    const rawType = String(att.source_type || "").toLowerCase();
    const isComp = ["component", "structure_component"].includes(rawType);
    const isAnom = ["anomaly", "defect"].includes(rawType);
    const isInsp = ["inspection", "insp_record"].includes(rawType);

    let normalizedType = "Component";
    if (isAnom) normalizedType = "Anomaly";
    else if (isInsp) normalizedType = "Inspection";
    else if (!isComp) normalizedType = att.source_type || "Attachment";

    return {
      ...att,
      created_at: att.created_at || att.cr_date || new Date().toISOString(),
      source_name: isComp ? (att.source_name || "Direct Component") : (att.source_name || att.name || "Attachment"),
      source_type: normalizedType,
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
