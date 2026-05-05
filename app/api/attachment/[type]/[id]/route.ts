import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; type: string }> }) {
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

  let data = directData ? [...directData] : [];

  if (type === "component") {
    const { data: inspRecords } = await (supabase as any)
      .from("insp_records")
      .select("insp_id, jobpack_id, structure_id")
      .eq("component_id", Number(id));

    if (inspRecords && inspRecords.length > 0) {
      const inspIds = inspRecords.map((r: any) => r.insp_id);
      const { data: inspAttachments } = await supabase
        .from("attachment")
        .select("*")
        .in("source_type", ["inspection", "INSPECTION"])
        .in("source_id", inspIds);

      if (inspAttachments && inspAttachments.length > 0) {
        // Fetch Jobpacks and Platforms for enrichment
        const jobpackIds = Array.from(new Set(inspRecords.map((r: any) => r.jobpack_id).filter(Boolean) as number[]));
        const structureIds = Array.from(new Set(inspRecords.map((r: any) => r.structure_id).filter(Boolean) as number[]));
        
        const jobpackMap = new Map();
        if (jobpackIds.length > 0) {
          const { data: jobpacks } = await supabase.from("jobpack").select("id, name").in("id", jobpackIds);
          (jobpacks || []).forEach((jp: any) => jobpackMap.set(jp.id, jp.name));
        }

        const platformMap = new Map();
        if (structureIds.length > 0) {
          const { data: platforms } = await (supabase as any).from("platform").select("plat_id, title").in("plat_id", structureIds);
          (platforms || []).forEach((p: any) => platformMap.set(p.plat_id, p.title));
        }

        const inspMap = new Map();
        inspRecords.forEach((r: any) => inspMap.set(r.insp_id, r));

        const enrichedInspAttachments = inspAttachments.map((att: any) => {
          const insp = inspMap.get(att.source_id);
          let sourceName = "Inspection";
          if (insp) {
            const jpName = jobpackMap.get(insp.jobpack_id);
            const platName = platformMap.get(insp.structure_id);
            if (jpName && platName) {
              sourceName = `${jpName} | ${platName}`;
            } else if (jpName) {
              sourceName = `JP: ${jpName}`;
            } else if (platName) {
              sourceName = `Plat: ${platName}`;
            }
          }
          return {
            ...att,
            source_name: sourceName,
            source_type: "Inspection"
          };
        });

        data = [...data, ...enrichedInspAttachments];
      }
    }
  }

  // Set source names for direct component attachments
  data = data.map(att => {
    if (att.source_type?.toLowerCase() === "component") {
      return { ...att, source_name: "Direct Component", source_type: "Component" };
    }
    return att;
  });

  // Enrich data with user information
  if (data && data.length > 0) {
    const userIds = Array.from(new Set(data.map((item) => item.user_id).filter(Boolean)));
    
    // Fetch user information using RPC function
    const { data: usersData, error: usersError } = await (supabase.rpc as any)('get_user_info', {
      user_ids: userIds
    });
    
    // Create a map of user_id to user name
    const userMap = new Map();
    if (usersData && !usersError && Array.isArray(usersData)) {
      usersData.forEach((user: any) => {
        userMap.set(user.id, user.full_name || user.email || 'Unknown User');
      });
    }

    // Enrich attachments with user names
    const enrichedData = data.map((attachment) => ({
      ...attachment,
      user_name: attachment.user_id ? userMap.get(attachment.user_id) || attachment.user_id : 'Unknown',
    }));

    return NextResponse.json({ data: enrichedData });
  }

  return NextResponse.json({ data });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string; type: string }> }) {
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

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; type: string }> }) {
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
