import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { apiSuccess } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";
import { withAuth } from "@/utils/with-auth";
import { generatePlatform3DCoordinates, isDegenerateFootprint } from "@/utils/platform-3d-math";

/**
 * GET /api/platform/webapp-3d/[structure_id]
 * Fetch WebApp 3D coordinates enriched with inspection and anomaly status.
 * Fallback to dynamic math generation if webapp_3d table is empty or degenerate.
 */
export const GET = withAuth(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ structure_id: string }>; user: any }
  ) => {
    const supabase = createClient();
    const { structure_id } = await params;
    const structureIdNum = Number(structure_id);

    if (isNaN(structureIdNum)) {
      return handleSupabaseError(
        { message: "Invalid structure id", details: null, hint: null, code: "400" } as any,
        "Invalid structure id"
      );
    }

    // 1. Fetch Platform Details & Structure Components
    const { data: platformDetails } = await (supabase as any)
      .from("platform")
      .select("*")
      .eq("plat_id", structureIdNum)
      .maybeSingle();

    const { data: elevations } = await (supabase as any)
      .from("platform_elevation")
      .select("*")
      .eq("plat_id", structureIdNum);

    const { data: faces } = await (supabase as any)
      .from("platform_faces")
      .select("*")
      .eq("plat_id", structureIdNum);

    async function fetchAllRawComponents(supabaseClient: any, platId: number) {
      let allData: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        const { data, error } = await (supabaseClient as any)
          .from("structure_components")
          .select("*")
          .eq("structure_id", platId)
          .eq("is_deleted", false)
          .range(from, to);

        if (error || !data || data.length === 0) {
          hasMore = false;
        } else {
          allData = allData.concat(data);
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        }
      }
      return allData;
    }

    const rawComponents = await fetchAllRawComponents(supabase, structureIdNum);

    // 2. Try fetching from webapp_3d database table first
    const { data: webapp3d, error } = await (supabase as any)
      .from("webapp_3d")
      .select(`
        *,
        structure_components (
          *
        )
      `)
      .eq("structure_id", structureIdNum);

    let componentsToEnrich: any[] = [];
    let foundationMembers: any[] = [];
    let elvMarkers: any[] = [];

    const excludeCodes = ["IT", "FV", "HS", "GP", "PG", "PC", "RC", "RB", "SD", "FA"];
    const webapp3dMap = new Map<number, any>();
    if (webapp3d) {
      webapp3d.forEach((w: any) => {
        const cid = w.comp_id || w.structure_components?.id;
        if (cid) webapp3dMap.set(Number(cid), w);
      });
    }
    const filteredRawComponents = (rawComponents || [])
      .filter((c: any) => {
        const code = (c.code || "").trim().toUpperCase();
        const qIdUpper = (c.q_id || "").toUpperCase();
        const isRiserSupport = qIdUpper.includes("SUPP") || qIdUpper.includes("CLP") || code === "CL" || code === "RC" || code.includes("CLAM");
        if ((excludeCodes.includes(code) || code.startsWith("FA") || code.includes("FACE")) && !isRiserSupport) return false;
        if (qIdUpper.startsWith("FACE") || /^FACE[\s\-]/i.test(qIdUpper)) return false;
        if (code === "WN") {
          const md = c.metadata || c;
          const sNode = (md.s_node || "").toString().trim().toUpperCase();
          const fNode = (md.f_node || "").toString().trim().toUpperCase();
          const hasAssociation = !!(md.associated_comp_id || md.associated_member || md.associated_comp || md.parent_id);
          if (sNode && fNode && sNode !== fNode && !hasAssociation) return false;
        }

        if (/^FEND\s+\d+-SUPP-/i.test(qIdUpper)) return false;
        if (qIdUpper.endsWith("TERM")) return false;
        return true;
      })
      .map((c: any) => {
        const w3d = webapp3dMap.get(Number(c.id));
        const _webapp3d = w3d ? {
          start_x: w3d.start_x, start_y: w3d.start_y, start_z: w3d.start_z,
          end_x: w3d.end_x, end_y: w3d.end_y, end_z: w3d.end_z
        } : null;
        return { ...c.metadata, ...c, _webapp3d };
      });

    // Compute foundation & elevation markers from math
    const mathResult = generatePlatform3DCoordinates(
      platformDetails || {},
      elevations || [],
      faces || [],
      filteredRawComponents
    );
    foundationMembers = mathResult.foundationMembers || [];
    elvMarkers = mathResult.elvMarkers || [];

    const { searchParams } = new URL(request.url);
    const forceResync = searchParams.get("resync") === "true" || searchParams.get("resync") === "1";

    let isDegenerate = forceResync;
    if (webapp3d && webapp3d.length > 0 && !forceResync) {
      const unlinkedCount = webapp3d.filter((w: any) => !w.structure_components).length;
      const isUnlinked = unlinkedCount > webapp3d.length * 0.2; // if > 20% unlinked, force auto-heal resync

      const legCoords = webapp3d
        .filter((w: any) => (w.code || "").toUpperCase().includes("LG") || (w.code || "").toUpperCase() === "LEG")
        .map((w: any) => ({ x: Number(w.start_x || 0), z: Number(w.start_z || 0) }));
      const coordsToCheck = legCoords.length >= 2 ? legCoords : webapp3d.map((w: any) => ({ x: Number(w.start_x || 0), z: Number(w.start_z || 0) }));
      isDegenerate = isDegenerateFootprint(coordsToCheck) || isUnlinked;
    }

    if (webapp3d && webapp3d.length > 0 && !isDegenerate) {
      // Use stored 3D data from webapp_3d table
      componentsToEnrich = webapp3d.filter((item: any) => !item.structure_components?.is_deleted);

      // Build lookup maps of dynamic math layouts by component ID and Q ID
      const mathLayoutsByCompId = new Map<number, any>();
      const mathLayoutsByQId = new Map<string, any>();
      (mathResult.componentLayouts || []).forEach((m: any) => {
        const comp = m.component || m;
        if (comp.id) mathLayoutsByCompId.set(Number(comp.id), m);
        if (comp.comp_id) mathLayoutsByCompId.set(Number(comp.comp_id), m);
        if (comp.q_id) mathLayoutsByQId.set(comp.q_id.toUpperCase().trim(), m);
      });

      // Repair stored rows if their 3D coordinates are (0,0,0) or missing and merge real database component specifications
      componentsToEnrich = componentsToEnrich.map((item: any) => {
        const sc = item.structure_components || {};
        const cid1 = Number(item.comp_id);
        const cid2 = Number(sc.id);
        const realQId = sc.q_id || (item.q_id && !item.q_id.startsWith("COMP-") ? item.q_id : null) || sc.name || item.q_id;
        const qid = String(realQId || "").toUpperCase().trim();
        const mathLayout = mathLayoutsByCompId.get(cid1) || mathLayoutsByCompId.get(cid2) || mathLayoutsByQId.get(qid);

        const code = (sc.code || item.code || "").toUpperCase();
        const isPile = code === "PL" || code === "PILE" || qid.includes("PILE");

        let updatedItem = {
          ...item,
          ...sc,
          id: sc.id || item.comp_id || item.id,
          q_id: realQId,
          code: code || item.code,
          structure_components: sc
        };

        if (isPile) {
          const sX = mathLayout?.start?.x ?? mathLayout?.start?.[0] ?? (item.start_x || 0);
          let sY = mathLayout?.start?.y ?? mathLayout?.start?.[1] ?? (item.start_y || 0);
          const sZ = mathLayout?.start?.z ?? mathLayout?.start?.[2] ?? (item.start_z || 0);

          let eX = mathLayout?.end?.x ?? mathLayout?.end?.[0] ?? (item.end_x || sX);
          let eY = mathLayout?.end?.y ?? mathLayout?.end?.[1] ?? (item.end_y || sY);
          let eZ = mathLayout?.end?.z ?? mathLayout?.end?.[2] ?? (item.end_z || sZ);

          const isSingleNodePoint = (sX === eX && sY === eY && sZ === eZ);

          if (isSingleNodePoint) {
            eY = sY - 2.0;
          }

          updatedItem = {
            ...updatedItem,
            start_x: sX,
            start_y: sY,
            start_z: sZ,
            end_x: eX,
            end_y: eY,
            end_z: eZ,
            is_single_node: isSingleNodePoint,
            pos_x: (sX + eX) / 2,
            pos_y: (sY + eY) / 2,
            pos_z: (sZ + eZ) / 2,
            thickness: mathLayout?.thickness || 0.2,
          };
          return updatedItem;
        }

        const isZeroOrPoint = ((item.start_x === 0 || item.start_x === "0" || !item.start_x) &&
                       (item.start_y === 0 || item.start_y === "0" || !item.start_y) &&
                       (item.start_z === 0 || item.start_z === "0" || !item.start_z)) ||
                       (item.start_x === item.end_x && item.start_y === item.end_y && item.start_z === item.end_z);

        const isSupportWeld = code === "WP" || code === "CL" || (typeof qid === "string" && (qid.includes("SUPP") || qid.includes("CLP")));
        const isCaisson = code === "CS" || code === "CA" || code.includes("CAIS") || (typeof qid === "string" && qid.startsWith("CS-"));

        if ((isZeroOrPoint || isSupportWeld || isCaisson) && mathLayout) {
          const sX = mathLayout.start?.x ?? mathLayout.start?.[0] ?? 0;
          const sY = mathLayout.start?.y ?? mathLayout.start?.[1] ?? 0;
          const sZ = mathLayout.start?.z ?? mathLayout.start?.[2] ?? 0;
          const eX = mathLayout.end?.x ?? mathLayout.end?.[0] ?? sX;
          const eY = mathLayout.end?.y ?? mathLayout.end?.[1] ?? sY;
          const eZ = mathLayout.end?.z ?? mathLayout.end?.[2] ?? sZ;
          updatedItem = {
            ...updatedItem,
            start_x: sX,
            start_y: sY,
            start_z: sZ,
            end_x: eX,
            end_y: eY,
            end_z: eZ,
            pos_x: (sX + eX) / 2,
            pos_y: (sY + eY) / 2,
            pos_z: (sZ + eZ) / 2,
            thickness: mathLayout.thickness || item.thickness || 0.2,
          };
          return updatedItem;
        }
        return updatedItem;
      });

      // Also append any dynamic math layouts missing from webapp3d entirely
      const cachedCompIds = new Set(componentsToEnrich.map((w: any) => Number(w.comp_id || w.structure_components?.id)).filter(Boolean));
      const cachedQIds = new Set(componentsToEnrich.map((w: any) => (w.q_id || w.structure_components?.q_id || "").toUpperCase()).filter(Boolean));

      const missingMathLayouts = (mathResult.componentLayouts || []).filter((m: any) => {
        const comp = m.component || m;
        const cid = Number(comp.id);
        const qid = (comp.q_id || "").toUpperCase();
        return (!cid || !cachedCompIds.has(cid)) && (!qid || !cachedQIds.has(qid));
      });

      if (missingMathLayouts.length > 0) {
        const extraEnriched = missingMathLayouts.map((m: any) => {
          const sX = m.start?.x ?? m.start?.[0] ?? 0;
          const sY = m.start?.y ?? m.start?.[1] ?? 0;
          const sZ = m.start?.z ?? m.start?.[2] ?? 0;
          const eX = m.end?.x ?? m.end?.[0] ?? sX;
          const eY = m.end?.y ?? m.end?.[1] ?? sY;
          const eZ = m.end?.z ?? m.end?.[2] ?? sZ;
          const posX = (sX + eX) / 2;
          const posY = (sY + eY) / 2;
          const posZ = (sZ + eZ) / 2;
          return {
            component_id: m.id?.toString() || `${m.q_id || "COMP"}-${Math.random()}`,
            comp_id: m.id || m.component?.id,
            start_x: sX,
            start_y: sY,
            start_z: sZ,
            end_x: eX,
            end_y: eY,
            end_z: eZ,
            pos_x: posX,
            pos_y: posY,
            pos_z: posZ,
            q_id: m.q_id || m.component?.q_id,
            code: m.code || m.component?.code,
            thickness: m.thickness || 0.2,
            shape_type: m.shape_type || m.component?.shape_type || "Cylinder",
            visibility_flag: true,
            structure_components: m.component || m,
          };
        });
        componentsToEnrich = [...componentsToEnrich, ...extraEnriched];
      }
    } else {
      if (isDegenerate) {
        await (supabase as any).from("webapp_3d").delete().eq("structure_id", structureIdNum);
      }
      // Fallback: Generate 3D component coordinates dynamically on the fly
      componentsToEnrich = (mathResult.componentLayouts || []).map((m: any) => {
        const c = m.component || m;
        const sX = m.start?.x ?? m.start?.[0] ?? 0;
        const sY = m.start?.y ?? m.start?.[1] ?? 0;
        const sZ = m.start?.z ?? m.start?.[2] ?? 0;
        const eX = m.end?.x ?? m.end?.[0] ?? sX;
        const eY = m.end?.y ?? m.end?.[1] ?? sY;
        const eZ = m.end?.z ?? m.end?.[2] ?? sZ;
        const posX = (sX + eX) / 2;
        const posY = (sY + eY) / 2;
        const posZ = (sZ + eZ) / 2;
        const compIdVal = c.id ? String(c.id) : (m.id ? String(m.id) : `${c.q_id || "COMP"}-${Math.random()}`);
        return {
          component_id: compIdVal,
          comp_id: c.id || c.comp_id || m.id,
          q_id: c.q_id || m.q_id,
          code: c.code || m.code,
          start_x: sX,
          start_y: sY,
          start_z: sZ,
          end_x: eX,
          end_y: eY,
          end_z: eZ,
          pos_x: posX,
          pos_y: posY,
          pos_z: posZ,
          rot_x: m.rotation?.[0] || 0,
          rot_y: m.rotation?.[1] || 0,
          rot_z: m.rotation?.[2] || 0,
          scale_x: m.scale?.[0] || 1,
          scale_y: m.scale?.[1] || 1,
          scale_z: m.scale?.[2] || 1,
          shape_type: m.shape || m.shape_type || c.shape_type || "cylinder",
          dimensions: { length: m.length, radius: m.thickness || 0.3, offset: m.offsetDistance },
          thickness: m.thickness || 0.3,
          color_hex: m.color || "#64748b",
          visibility_flag: true,
          has_geometry_issue: false,
          structure_components: c,
          metadata: m.component?.metadata || m.metadata
        };
      });

      // Auto-populate webapp_3d table in Postgres
      if (componentsToEnrich.length > 0) {
        (async () => {
          try {
            const insertData = componentsToEnrich.map((item: any) => ({
              structure_id: structureIdNum,
              component_id: item.component_id,
              comp_id: item.comp_id ? Number(item.comp_id) : null,
              q_id: item.q_id || null,
              code: item.code || null,
              start_x: item.start_x,
              start_y: item.start_y,
              start_z: item.start_z,
              end_x: item.end_x,
              end_y: item.end_y,
              end_z: item.end_z,
              pos_x: item.pos_x,
              pos_y: item.pos_y,
              pos_z: item.pos_z,
              rot_x: item.rot_x,
              rot_y: item.rot_y,
              rot_z: item.rot_z,
              scale_x: item.scale_x,
              scale_y: item.scale_y,
              scale_z: item.scale_z,
              shape_type: item.shape_type,
              dimensions: item.dimensions,
              thickness: item.thickness,
              color_hex: item.color_hex,
              material_type: "steel",
              opacity: 1.0,
              visibility_flag: true,
              has_geometry_issue: false
            }));

            const chunkSize = 500;
            for (let i = 0; i < insertData.length; i += chunkSize) {
              const chunk = insertData.slice(i, i + chunkSize);
              await (supabase as any).from("webapp_3d").insert(chunk);
            }
          } catch (syncErr) {
            console.error("[webapp-3d] Auto-population background sync failed:", syncErr);
          }
        })().catch(err => {
          console.error("[webapp-3d] Auto-population background error caught:", err);
        });
      }
    }

    const componentIds = componentsToEnrich
      .map((item: any) => typeof item.component_id === "number" ? item.component_id : parseInt(item.component_id, 10))
      .filter((id: any) => typeof id === "number" && !isNaN(id));

    // 3. Fetch Inspection Records & Anomalies
    const { data: inspRecords } = componentIds.length > 0
      ? await (supabase as any)
          .from("insp_records")
          .select("component_id, has_anomaly")
          .in("component_id", componentIds)
      : { data: [] };

    const { data: anomalies } = componentIds.length > 0
      ? await (supabase as any)
          .from("v_anomaly_details")
          .select("component_id, status")
          .in("component_id", componentIds)
      : { data: [] };

    const inspectedSet = new Set();
    const anomalySet = new Set();

    if (inspRecords) {
      inspRecords.forEach((r: any) => {
        inspectedSet.add(r.component_id);
        if (r.has_anomaly) anomalySet.add(r.component_id);
      });
    }

    if (anomalies) {
      anomalies.forEach((a: any) => {
        inspectedSet.add(a.component_id);
        if (a.status !== 'Closed') {
          anomalySet.add(a.component_id);
        }
      });
    }

    const enrichedData = componentsToEnrich.map((item: any) => {
      let inspection_color = "grey";
      const compIdNum = typeof item.component_id === "number" ? item.component_id : parseInt(item.component_id, 10);
      
      if (anomalySet.has(compIdNum)) {
        inspection_color = "red";
      } else if (inspectedSet.has(compIdNum)) {
        inspection_color = "green";
      }

      return {
        ...item,
        inspection_color,
        is_inspected: inspectedSet.has(compIdNum),
        has_anomaly: anomalySet.has(compIdNum)
      };
    });

    return apiSuccess({
      components: enrichedData,
      foundationMembers,
      elvMarkers
    });
  }
);

export const POST = GET;

