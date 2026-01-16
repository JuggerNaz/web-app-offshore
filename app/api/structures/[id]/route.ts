import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = createClient();
        const { id } = await context.params;
        const structureId = parseInt(id);

        // Get structure
        const { data: structure, error: structureError } = await supabase
            .from("structure")
            .select("*")
            .eq("str_id", structureId)
            .single();

        if (structureError) {
            return NextResponse.json(
                { error: "Structure not found", details: structureError.message },
                { status: 404 }
            );
        }

        let detailedData: any = {};

        // Get platform or pipeline details with ALL fields
        if (structure.str_type === "PLATFORM") {
            const { data: platform } = await supabase
                .from("platform" as any)
                .select("*")
                .eq("plat_id", structureId)
                .single() as any;

            if (!platform) {
                return NextResponse.json(
                    { error: "Platform details not found" },
                    { status: 404 }
                );
            }

            // Get platform elevations/levels
            const { data: levels } = await supabase
                .from("str_level" as any)
                .select("*")
                .eq("plat_id", structureId)
                .order("elv_from", { ascending: false });

            // Get platform elevations (Above/Below Splash Level)
            const { data: elevations } = await supabase
                .from("str_elv" as any)
                .select("*")
                .eq("plat_id", structureId)
                .order("elv", { ascending: false });

            // Get platform faces
            const { data: faces } = await supabase
                .from("str_faces" as any)
                .select("*")
                .eq("plat_id", structureId);

            // Get discussions/comments
            const { data: discussions } = await supabase
                .from("discussion" as any)
                .select("*, user:user_id(full_name)")
                .eq("str_id", structureId)
                .order("created_at", { ascending: false })
                .limit(5) as any;

            // Get visuals/attachments
            const { data: attachments } = await supabase
                .from("attachment" as any)
                .select("*")
                .eq("source_id", structureId)
                .eq("source_type", "platform_structure_image") as any;

            // Build legs array from platform fields
            const legs = [];
            const legsCount = platform.plegs || 0;
            for (let i = 1; i <= Math.min(legsCount, 20); i++) {
                const legName = platform[`leg_t${i}`];
                if (legName) {
                    legs.push({
                        leg_number: i,
                        leg_name: legName,
                        designation: legName
                    });
                }
            }

            detailedData = {
                ...structure,
                str_name: platform.title || `Platform ${structureId}`,
                str_id: structureId,
                str_type: "PLATFORM",
                field_name: platform.pfield || "",

                // Basic Specs
                title: platform.title,
                description: platform.description,
                pfield: platform.pfield,
                depth: platform.depth,
                desg_life: platform.desg_life,
                inst_date: platform.inst_date,
                northing: platform.northing,
                easting: platform.easting,
                true_north_angle: platform.true_north_angle,
                platform_north_side: platform.platform_north_side,
                ptype: platform.ptype,
                function: platform.function,
                material: platform.material,
                cp_system: platform.cp_system,
                corr_ctg: platform.corr_ctg,
                inst_contractor: platform.inst_contractor,
                max_leg_dia: platform.max_leg_dia,
                max_wall_thk: platform.max_wall_thk,
                helipad: platform.helipad,
                manned: platform.manned,
                conductors: platform.conduct || 0,
                internal_piles: platform.int_pile || 0,
                slots: platform.slots,
                fenders: platform.fender || 0,
                risers: platform.riser || 0,
                sumps: platform.sump || 0,
                skirt_piles: platform.pileskt || 0,
                caissons: platform.caisson || 0,
                anodes: platform.an_qty || 0,
                cranes: platform.crane || 0,
                unit_system: platform.unit || "METRIC",

                // Extended Data
                levels: levels || [],
                elevations: elevations || [],
                faces: faces || [],
                legs: legs || [],

                // Discussions
                discussions: discussions || [],

                // Visuals
                visuals: attachments || [],
                photo_url: platform.photo_url || (attachments && attachments.length > 0 ? (attachments[0].file_url || attachments[0].meta?.file_url) : null),

                specifications: {
                    // General Information
                    "Title": platform.title || "N/A",
                    "Description": platform.description || "N/A",
                    "Oil Field": platform.pfield || "N/A",
                    "Water Depth": platform.depth ? `${platform.depth} m` : "N/A",
                    "Design Life": platform.desg_life ? `${platform.desg_life} years` : "N/A",
                    "Installation Date": platform.inst_date || "N/A",

                    // Location & Coordinates
                    "Northing": platform.northing ? `${platform.northing} m` : "N/A",
                    "Easting": platform.easting ? `${platform.easting} m` : "N/A",
                    "True North Angle": platform.true_north_angle ? `${platform.true_north_angle}°` : "N/A",

                    // Configuration
                    "Platform Type": platform.ptype || "N/A",
                    "Function": platform.function || "N/A",
                    "Material": platform.material || "N/A",
                    "CP System": platform.cp_system || "N/A",
                    "Corrosion Coating": platform.corr_ctg || "N/A",
                    "Installation Contractor": platform.inst_contractor || "N/A",

                    // Dimensions
                    "Max Leg Diameter": platform.max_leg_dia ? `${platform.max_leg_dia} mm` : "N/A",
                    "Max Wall Thickness": platform.max_wall_thk ? `${platform.max_wall_thk} mm` : "N/A",

                    // Status
                    "Helipad": platform.helipad ? "Yes" : "No",
                    "Manned": platform.manned ? "Yes" : "No",

                    // Inventory
                    "Conductors": platform.conduct || 0,
                    "Internal Piles": platform.int_pile || 0,
                    "Slots": platform.slots || "N/A",
                    "Fenders": platform.fender || 0,
                    "Risers": platform.riser || 0,

                    // Unit System
                    "Unit System": platform.unit || "METRIC",
                },

                comments: platform.comments || "",
            };
        } else if (structure.str_type === "PIPELINE") {
            const { data: pipeline } = await supabase
                .from("u_pipeline" as any)
                .select("*")
                .eq("pipe_id", structureId)
                .single() as any;

            if (!pipeline) {
                return NextResponse.json(
                    { error: "Pipeline details not found" },
                    { status: 404 }
                );
            }

            // Get discussions/comments
            const { data: discussions } = await supabase
                .from("discussion" as any)
                .select("*, user:user_id(full_name)")
                .eq("str_id", structureId)
                .order("created_at", { ascending: false })
                .limit(5) as any;

            // Get visuals/attachments
            const { data: attachments } = await supabase
                .from("attachment" as any)
                .select("*")
                .eq("str_id", structureId)
                .eq("category", "visual")
                .limit(3) as any;

            // Get geodetic parameters from pipe_geo table
            const { data: pipeGeo } = await supabase
                .from("pipe_geo" as any)
                .select("*")
                .eq("str_id", structureId)
                .single() as any;

            detailedData = {
                ...structure,
                str_name: pipeline.title || `Pipeline ${structureId}`,
                str_id: structureId,
                str_type: "PIPELINE",
                field_name: pipeline.pfield || "",

                // Basic Info
                title: pipeline.title,
                description: pipeline.pdesc,
                pfield: pipeline.pfield,
                inst_date: pipeline.inst_date,
                inst_contractor: pipeline.inst_contractor,

                // Technical Parameters (using correct field names)
                od: pipeline.outer_diam,
                wall_thickness: pipeline.wall_thk,
                plength: pipeline.pipe_len,
                material: pipeline.material,
                cp_system: pipeline.cp_system,
                corr_ctg: pipeline.corr_ctg,

                // Location & Path (using correct field names)
                from_plat: pipeline.from_plat,
                to_plat: pipeline.to_plat,
                start_northing: pipeline.st_north,
                start_easting: pipeline.st_east,
                end_northing: pipeline.end_north,
                end_easting: pipeline.end_east,

                // Burial & Protection (using correct field names)
                burial_status: pipeline.burial_stat,
                protection_method: pipeline.protect_method,

                // Geodetic Parameters (from pipe_geo table with correct field names)
                project_name: pipeGeo?.geo_proj_nam,
                unit: pipeGeo?.geo_units || pipeline.def_unit || pipeline.workunit,
                unit_system: pipeGeo?.geo_units || pipeline.def_unit || pipeline.workunit,
                datum: pipeGeo?.geo_datum,
                ellipsoid: pipeGeo?.geo_elli_sph,
                spheroid: pipeGeo?.geo_elli_sph,
                datum_shift: pipeGeo?.geo_dir,
                dx: pipeGeo?.geo_dx,
                dy: pipeGeo?.geo_dy,
                dz: pipeGeo?.geo_dz,

                discussions: discussions || [],
                visuals: attachments || [],
                photo_url: pipeline.photo_url || (attachments && attachments.length > 0 ? attachments[0].file_url : null),

                specifications: {
                    "Pipeline Title": pipeline.title || "N/A",
                    "Oil Field": pipeline.pfield || "N/A",
                    "Pipeline Type": pipeline.ptype || "N/A",
                    "Diameter": pipeline.outer_diam ? `${pipeline.outer_diam} inches` : "N/A",
                    "Length": pipeline.pipe_len ? `${pipeline.pipe_len} m` : "N/A",
                    "Material": pipeline.material || "N/A",
                    "Coating": pipeline.corr_ctg || "N/A",
                    "CP System": pipeline.cp_system || "N/A",
                    "From Platform": pipeline.from_plat || "N/A",
                    "To Platform": pipeline.to_plat || "N/A",
                    "Installation Date": pipeline.inst_date || "N/A",
                    "Installation Contractor": pipeline.inst_contractor || "N/A",
                    "Unit System": pipeline.def_unit || pipeline.workunit || "METRIC",
                },

                comments: pipeline.comments || "",
            };
        }

        return NextResponse.json({
            success: true,
            data: detailedData,
        });
    } catch (error: any) {
        console.error("Error fetching structure details:", error);
        return NextResponse.json(
            { error: "Internal server error", details: error.message },
            { status: 500 }
        );
    }
}
