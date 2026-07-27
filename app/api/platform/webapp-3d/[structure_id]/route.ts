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

    const { data: rawComponents } = await (supabase as any)
      .from("structure_components")
      .select("*")
      .eq("structure_id", structureIdNum)
      .eq("is_deleted", false);

    // 2. Try fetching from webapp_3d database table first
    const { data: webapp3d, error } = await (supabase as any)
      .from("webapp_3d")
      .select(`
        *,
        structure_components (
          id, q_id, code, name, is_deleted
        )
      `)
      .eq("structure_id", structureIdNum);

    let componentsToEnrich: any[] = [];
    let foundationMembers: any[] = [];
    let elvMarkers: any[] = [];

    const excludeCodes = ["IT", "CU", "FV", "HS", "GP", "PG", "PC", "RC", "RB", "SD"];
    const filteredRawComponents = (rawComponents || [])
      .filter((c: any) => {
        const code = (c.code || "").trim().toUpperCase();
        const qIdUpper = (c.q_id || "").toUpperCase();
        const isRiserSupport = qIdUpper.includes("SUPP") || qIdUpper.includes("CLP");
        if (excludeCodes.includes(code) && !isRiserSupport) return false;
        if (code === "WN" && c.q_id && c.q_id.includes("-")) return false;

        if (/^FEND\s+\d+-SUPP-/i.test(qIdUpper)) return false;
        if (qIdUpper.endsWith("TERM")) return false;
        return true;
      })
      .map((c: any) => ({ ...c.metadata, ...c }));

    // Compute foundation & elevation markers from math
    const mathResult = generatePlatform3DCoordinates(
      platformDetails || {},
      elevations || [],
      faces || [],
      filteredRawComponents
    );
    foundationMembers = mathResult.foundationMembers || [];
    elvMarkers = mathResult.elvMarkers || [];

    let isDegenerate = false;
    if (webapp3d && webapp3d.length > 0) {
      const legCoords = webapp3d
        .filter((w: any) => (w.code || "").toUpperCase().includes("LG") || (w.code || "").toUpperCase() === "LEG")
        .map((w: any) => ({ x: Number(w.start_x || 0), z: Number(w.start_z || 0) }));
      const coordsToCheck = legCoords.length >= 2 ? legCoords : webapp3d.map((w: any) => ({ x: Number(w.start_x || 0), z: Number(w.start_z || 0) }));
      isDegenerate = isDegenerateFootprint(coordsToCheck);
    }

    if (webapp3d && webapp3d.length > 0 && !isDegenerate) {
      // Use stored 3D data from webapp_3d table
      componentsToEnrich = webapp3d.filter((item: any) => !item.structure_components?.is_deleted);
    } else {
      if (isDegenerate) {
        await (supabase as any).from("webapp_3d").delete().eq("structure_id", structureIdNum);
      }
      // Fallback: Generate 3D component coordinates dynamically on the fly
      componentsToEnrich = (mathResult.componentLayouts || []).map((m: any) => {
        const start = m.start || [0, 0, 0];
        const end = m.end || [0, 0, 0];
        const posX = (start[0] + end[0]) / 2;
        const posY = (start[1] + end[1]) / 2;
        const posZ = (start[2] + end[2]) / 2;
        return {
          component_id: m.id?.toString() || `${m.q_id || "COMP"}-${Math.random()}`,
          start_x: start[0],
          start_y: start[1],
          start_z: start[2],
          end_x: end[0],
          end_y: end[1],
          end_z: end[2],
          pos_x: posX,
          pos_y: posY,
          pos_z: posZ,
          rot_x: m.rotation?.[0] || 0,
          rot_y: m.rotation?.[1] || 0,
          rot_z: m.rotation?.[2] || 0,
          scale_x: m.scale?.[0] || 1,
          scale_y: m.scale?.[1] || 1,
          scale_z: m.scale?.[2] || 1,
          shape_type: m.shape || "cylinder",
          dimensions: { length: m.length, radius: m.thickness, offset: m.offsetDistance },
          color_hex: m.color || "#64748b",
          visibility_flag: true,
          has_geometry_issue: false
        };
      });

      // Auto-populate webapp_3d table in Postgres
      if (componentsToEnrich.length > 0) {
        (async () => {
          try {
            const insertData = componentsToEnrich.map((item: any) => ({
              structure_id: structureIdNum,
              component_id: item.component_id,
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
        })();
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
