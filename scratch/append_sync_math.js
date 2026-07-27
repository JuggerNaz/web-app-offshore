const fs = require('fs');
const content = fs.readFileSync('utils/platform-3d-math.ts', 'utf8');

const syncFunction = `
export async function syncWebapp3D(supabase: any, structureId: number) {
  try {
    // 1. Fetch Platform Details
    const { data: platformDetails } = await supabase
      .from("u_lib_list")
      .select("*")
      .eq("structure_id", structureId)
      .single();

    // 2. Fetch Elevations
    const { data: elevations } = await supabase
      .from("platform_elevation")
      .select("*")
      .eq("plat_id", structureId);

    // 3. Fetch Faces
    const { data: faces } = await supabase
      .from("platform_faces")
      .select("*")
      .eq("plat_id", structureId);

    // 4. Fetch Components
    const { data: rawComponents } = await supabase
      .from("structure_components")
      .select("*")
      .eq("structure_id", structureId)
      .eq("is_deleted", false);

    const excludeCodes = ["IT", "CU", "FV", "HS", "GP", "PG", "PC", "RC", "RB", "SD"];
    const components = (rawComponents || [])
      .filter((c: any) => {
          const code = (c.code || "").trim().toUpperCase();
          const qIdUpper = (c.q_id || "").toUpperCase();
          const isRiserSupport = qIdUpper.includes("SUPP") || qIdUpper.includes("CLP");
          if (excludeCodes.includes(code) && !isRiserSupport) return false;
          if (code === "WN" && c.q_id && c.q_id.includes("-")) return false;
          if (/^FEND\\s+\\d+-SUPP-/i.test(qIdUpper)) return false;
          if (qIdUpper.endsWith("TERM")) return false;
          return true;
      })
      .map((c: any) => ({
          ...c.metadata,
          ...c,
          qid: c.q_id,
          type: c.code,
      }));

    // 5. Generate coordinates
    const { componentLayouts } = generatePlatform3DCoordinates(
      platformDetails || {},
      elevations || [],
      faces || [],
      components
    );

    if (!componentLayouts || componentLayouts.length === 0) return;

    // 6. Delete old and Upsert new webapp_3d
    await supabase.from("webapp_3d").delete().eq("structure_id", structureId);
    
    const insertData = componentLayouts.map((m: any) => ({
      structure_id: structureId,
      component_id: m.id,
      pos_x: m.position?.[0] || 0,
      pos_y: m.position?.[1] || 0,
      pos_z: m.position?.[2] || 0,
      rot_x: m.rotation?.[0] || 0,
      rot_y: m.rotation?.[1] || 0,
      rot_z: m.rotation?.[2] || 0,
      scale_x: m.scale?.[0] || 1,
      scale_y: m.scale?.[1] || 1,
      scale_z: m.scale?.[2] || 1,
      shape_type: m.shape || "cylinder",
      dimensions: { length: m.length, radius: m.thickness, offset: m.offsetDistance },
      color_hex: m.color || null,
      material_type: "steel",
      opacity: 1.0,
      visibility_flag: true,
      has_geometry_issue: false,
    }));

    // Chunk the insert to avoid postgres limits
    const chunkSize = 500;
    for (let i = 0; i < insertData.length; i += chunkSize) {
      const chunk = insertData.slice(i, i + chunkSize);
      await supabase.from("webapp_3d").insert(chunk);
    }
    
    console.log(\`Successfully synced \${insertData.length} 3D components for structure \${structureId}\`);
  } catch (err) {
    console.error("Error syncing webapp_3d:", err);
  }
}
`;

fs.writeFileSync('utils/platform-3d-math.ts', content + '\n' + syncFunction);
