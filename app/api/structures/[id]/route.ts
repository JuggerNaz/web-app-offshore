import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { withTenant } from "@/utils/tenant-auth";

export const GET = withTenant(async (request, { companyId, params }) => {
    try {
        const supabase = createClient();
        const { id } = await params;
        const cleanId = String(id).replace(/^(platform|pipeline)-/, "").trim();
        const structureId = parseInt(cleanId);

        const { data: structure, error: structureError } = await (supabase as any)
            .from("structure")
            .select("*")
            .eq("company_id", companyId)
            .eq("str_id", structureId)
            .single();

        if (structureError) {
            return NextResponse.json(
                { error: "Structure not found", details: structureError.message },
                { status: 404 }
            );
        }

        let detailedData: any = {};

        if (structure.str_type === "PLATFORM") {
            const { data: platform } = await supabase
                .from("platform" as any)
                .select("*")
                .eq("company_id", companyId)
                .eq("plat_id", structureId)
                .single() as any;

            if (!platform) {
                return NextResponse.json(
                    { error: "Platform details not found" },
                    { status: 404 }
                );
            }

            const { data: levels } = await supabase
                .from("str_level" as any)
                .select("*")
                .eq("plat_id", structureId)
                .order("elv_from", { ascending: false });

            const { data: elevations } = await supabase
                .from("str_elv" as any)
                .select("*")
                .eq("plat_id", structureId)
                .order("elv", { ascending: false });

            const { data: faces } = await supabase
                .from("str_faces" as any)
                .select("*")
                .eq("plat_id", structureId);

            const { data: discussions } = await supabase
                .from("discussion" as any)
                .select("*, user:user_id(full_name)")
                .eq("company_id", companyId)
                .eq("str_id", structureId)
                .order("created_at", { ascending: false })
                .limit(5) as any;

            // Fetch all attachments linked to this platform / structure
            const { data: rawAttachments, error: attError } = await supabase
                .from("attachment" as any)
                .select("*")
                .eq("source_id", structureId)
                .in("source_type", [
                    "platform_structure_image",
                    "structure_image",
                    "platform",
                    "PLATFORM",
                    "structure",
                    "STRUCTURE",
                    "platform_visual",
                    "visual",
                    "VISUAL",
                    "photo",
                    "PHOTO",
                    "attachment",
                    "ATTACHMENT"
                ]);

            if (attError) {
                console.error("Error fetching platform attachments in structures API:", attError);
            }

            const attachments = (rawAttachments || []).map((a: any) => {
                let metaObj = a.meta;
                if (typeof metaObj === "string") {
                    try { metaObj = JSON.parse(metaObj); } catch {}
                }
                let directUrl = metaObj?.file_url || a.file_url || "";
                if (!directUrl && a.path) {
                    const p = String(a.path).trim().replace(/\\/g, '/');
                    if (p.startsWith("http://") || p.startsWith("https://") || p.startsWith("data:")) {
                        directUrl = p;
                    } else {
                        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
                        const cleanP = p.replace(/^\/?(attachments\/)?/, "");
                        if (supabaseUrl) {
                            directUrl = `${supabaseUrl}/storage/v1/object/public/attachments/${cleanP}`;
                        }
                    }
                }
                const proxyUrl = a.id ? `/api/attachment/url?id=${a.id}` : (a.path ? `/api/attachment/url?path=${encodeURIComponent(a.path)}` : directUrl);

                return {
                    ...a,
                    id: a.id,
                    url: proxyUrl || directUrl,
                    file_url: directUrl || proxyUrl,
                    proxy_url: proxyUrl,
                    path: a.path,
                    title: metaObj?.title || a.title || a.name || metaObj?.original_file_name || "Platform Visual"
                };
            });

            const legs: any[] = [];
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
                id: structureId,
                str_name: platform.title || structure.str_name || `Platform ${structureId}`,
                str_id: structureId,
                str_type: "PLATFORM",
                field_name: platform.pfield || structure.field_name || "",

                title: platform.title || structure.title,
                description: platform.pdesc || platform.description,
                pdesc: platform.pdesc,
                pfield: platform.pfield,
                depth: platform.depth,
                desg_life: platform.desg_life,
                inst_date: platform.inst_date,
                northing: platform.st_north ?? platform.northing,
                easting: platform.st_east ?? platform.easting,
                st_north: platform.st_north,
                st_east: platform.st_east,
                true_north_angle: platform.north_angle ?? platform.true_north_angle,
                north_angle: platform.north_angle,
                platform_north_side: (platform.nleg_t1 && platform.nleg_t2) ? `${platform.nleg_t1} - ${platform.nleg_t2}` : (platform.north_side || ""),
                nleg_t1: platform.nleg_t1,
                nleg_t2: platform.nleg_t2,
                ptype: platform.ptype,
                function: platform.process ?? platform.function,
                process: platform.process,
                material: platform.material,
                cp_system: platform.cp_system,
                corr_ctg: platform.corr_ctg,
                inst_contractor: platform.inst_ctr ?? platform.inst_contractor,
                inst_ctr: platform.inst_ctr,
                max_leg_dia: platform.dleg ?? platform.max_leg_dia,
                dleg: platform.dleg,
                max_wall_thk: platform.wall_thk ?? platform.max_wall_thk,
                wall_thk: platform.wall_thk,
                helipad: (platform.helipad === "YES" || platform.helipad === "Yes" || platform.helipad === "1" || platform.helipad === true) ? "Yes" : "No",
                manned: (platform.manned === "YES" || platform.manned === "Yes" || platform.manned === "1" || platform.manned === true) ? "Yes" : "No",
                conductors: platform.conduct || 0,
                conduct: platform.conduct || 0,
                internal_piles: platform.pileint ?? platform.int_pile ?? 0,
                pileint: platform.pileint || 0,
                slots: platform.cslot ?? platform.cslota ?? platform.slots ?? "N/A",
                cslot: platform.cslot,
                fenders: platform.fender || 0,
                fender: platform.fender || 0,
                risers: platform.riser || 0,
                riser: platform.riser || 0,
                sumps: platform.sump || 0,
                sump: platform.sump || 0,
                skirt_piles: platform.pileskt || 0,
                pileskt: platform.pileskt || 0,
                caissons: platform.caisson || 0,
                caisson: platform.caisson || 0,
                anodes: platform.an_qty || 0,
                an_qty: platform.an_qty || 0,
                cranes: platform.crane || 0,
                crane: platform.crane || 0,
                unit_system: platform.def_unit ?? platform.unit ?? "METRIC",
                def_unit: platform.def_unit ?? platform.unit ?? "METRIC",

                levels: levels || [],
                elevations: elevations || [],
                faces: faces || [],
                legs: legs || [],

                discussions: discussions || [],

                visuals: attachments || [],
                photos: attachments || [],
                photo_url: platform.photo_url || (attachments && attachments.length > 0 ? (attachments[0].file_url || attachments[0].meta?.file_url || attachments[0].path) : null),

                specifications: {
                    "Title": platform.title || "N/A",
                    "Description": platform.pdesc || platform.description || "N/A",
                    "Oil Field": platform.pfield || "N/A",
                    "Water Depth": platform.depth ? `${platform.depth} m` : "N/A",
                    "Design Life": platform.desg_life ? `${platform.desg_life} years` : "N/A",
                    "Installation Date": platform.inst_date || "N/A",

                    "Northing": (platform.st_north ?? platform.northing) ? `${platform.st_north ?? platform.northing} m` : "N/A",
                    "Easting": (platform.st_east ?? platform.easting) ? `${platform.st_east ?? platform.easting} m` : "N/A",
                    "True North Angle": (platform.north_angle ?? platform.true_north_angle) ? `${platform.north_angle ?? platform.true_north_angle}°` : "N/A",

                    "Platform Type": platform.ptype || "N/A",
                    "Function": platform.process ?? platform.function ?? "N/A",
                    "Material": platform.material || "N/A",
                    "CP System": platform.cp_system || "N/A",
                    "Corrosion Coating": platform.corr_ctg || "N/A",
                    "Installation Contractor": platform.inst_ctr ?? platform.inst_contractor ?? "N/A",

                    "Max Leg Diameter": (platform.dleg ?? platform.max_leg_dia) ? `${platform.dleg ?? platform.max_leg_dia} mm` : "N/A",
                    "Max Wall Thickness": (platform.wall_thk ?? platform.max_wall_thk) ? `${platform.wall_thk ?? platform.max_wall_thk} mm` : "N/A",

                    "Helipad": (platform.helipad === "YES" || platform.helipad === "Yes" || platform.helipad === "1" || platform.helipad === true) ? "Yes" : "No",
                    "Manned": (platform.manned === "YES" || platform.manned === "Yes" || platform.manned === "1" || platform.manned === true) ? "Yes" : "No",

                    "Conductors": platform.conduct || 0,
                    "Internal Piles": platform.pileint ?? platform.int_pile ?? 0,
                    "Slots": platform.cslot ?? platform.cslota ?? platform.slots ?? "N/A",
                    "Fenders": platform.fender || 0,
                    "Risers": platform.riser || 0,

                    "Unit System": platform.def_unit ?? platform.unit ?? "METRIC",
                },

                comments: platform.comments || "",
            };
        } else if (structure.str_type === "PIPELINE") {
            const { data: pipeline } = await supabase
                .from("u_pipeline" as any)
                .select("*")
                .eq("company_id", companyId)
                .eq("pipe_id", structureId)
                .single() as any;

            if (!pipeline) {
                return NextResponse.json(
                    { error: "Pipeline details not found" },
                    { status: 404 }
                );
            }

            const { data: discussions } = await supabase
                .from("discussion" as any)
                .select("*, user:user_id(full_name)")
                .eq("company_id", companyId)
                .eq("str_id", structureId)
                .order("created_at", { ascending: false })
                .limit(5) as any;

            const { data: rawPipeAtts, error: pipeAttError } = await supabase
                .from("attachment" as any)
                .select("*")
                .eq("source_id", structureId)
                .in("source_type", [
                    "pipeline_structure_image",
                    "structure_image",
                    "pipeline",
                    "PIPELINE",
                    "structure",
                    "STRUCTURE",
                    "visual",
                    "VISUAL",
                    "photo",
                    "PHOTO",
                    "attachment",
                    "ATTACHMENT"
                ]);

            if (pipeAttError) {
                console.error("Error fetching pipeline attachments in structures API:", pipeAttError);
            }

            const attachments = (rawPipeAtts || []).map((a: any) => {
                let fileUrl = a.meta?.file_url || a.file_url || a.path || "";
                if (fileUrl && !fileUrl.startsWith("http://") && !fileUrl.startsWith("https://") && !fileUrl.startsWith("data:")) {
                    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
                    if (supabaseUrl) fileUrl = `${supabaseUrl}/storage/v1/object/public/attachments/${fileUrl}`;
                }
                return {
                    ...a,
                    url: fileUrl,
                    file_url: fileUrl,
                    title: a.meta?.title || a.title || a.name || a.meta?.original_file_name || "Pipeline Photo"
                };
            });

            const { data: pipeGeo } = await supabase
                .from("pipe_geo" as any)
                .select("*")
                .eq("str_id", structureId)
                .single() as any;

            detailedData = {
                ...structure,
                id: structureId,
                str_name: pipeline.title || structure.str_name || `Pipeline ${structureId}`,
                str_id: structureId,
                str_type: "PIPELINE",
                field_name: pipeline.pfield || structure.field_name || "",

                title: pipeline.title || structure.title,
                description: pipeline.pdesc,
                pdesc: pipeline.pdesc,
                pfield: pipeline.pfield,
                inst_date: pipeline.inst_date,
                inst_contractor: pipeline.inst_ctr ?? pipeline.inst_contractor,
                inst_ctr: pipeline.inst_ctr,

                od: pipeline.line_diam ?? pipeline.outer_diam,
                outer_diam: pipeline.line_diam ?? pipeline.outer_diam,
                wall_thickness: pipeline.wall_thk,
                wall_thk: pipeline.wall_thk,
                plength: pipeline.plength ?? pipeline.pipe_len,
                pipe_len: pipeline.plength ?? pipeline.pipe_len,
                material: pipeline.material,
                cp_system: pipeline.cp_system,
                corr_ctg: pipeline.corr_ctg,

                from_plat: pipeline.st_loc ?? pipeline.from_plat,
                to_plat: pipeline.end_loc ?? pipeline.to_plat,
                st_loc: pipeline.st_loc,
                end_loc: pipeline.end_loc,
                start_northing: pipeline.st_y ?? pipeline.st_north,
                start_easting: pipeline.st_x ?? pipeline.st_east,
                end_northing: pipeline.end_y ?? pipeline.end_north,
                end_easting: pipeline.end_x ?? pipeline.end_east,

                burial_status: pipeline.burial ?? pipeline.burial_stat,
                protection_method: pipeline.conc_ctg ?? pipeline.protect_method,

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
                photos: attachments || [],
                photo_url: pipeline.photo_url || (attachments && attachments.length > 0 ? (attachments[0].file_url || attachments[0].meta?.file_url || attachments[0].path) : null),

                specifications: {
                    "Pipeline Title": pipeline.title || "N/A",
                    "Oil Field": pipeline.pfield || "N/A",
                    "Pipeline Type": pipeline.ptype || "N/A",
                    "Diameter": (pipeline.line_diam ?? pipeline.outer_diam) ? `${pipeline.line_diam ?? pipeline.outer_diam} in` : "N/A",
                    "Length": (pipeline.plength ?? pipeline.pipe_len) ? `${pipeline.plength ?? pipeline.pipe_len} m` : "N/A",
                    "Material": pipeline.material || "N/A",
                    "Coating": pipeline.corr_ctg || "N/A",
                    "CP System": pipeline.cp_system || "N/A",
                    "From Platform": pipeline.st_loc || pipeline.from_plat || "N/A",
                    "To Platform": pipeline.end_loc || pipeline.to_plat || "N/A",
                    "Installation Date": pipeline.inst_date || "N/A",
                    "Installation Contractor": pipeline.inst_ctr || pipeline.inst_contractor || "N/A",
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
});
