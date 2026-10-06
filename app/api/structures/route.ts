import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { withTenant } from "@/utils/tenant-auth";

const serverStructuresCache = new Map<string, { data: any[]; timestamp: number }>();
const STRUCTURES_CACHE_TTL_MS = 60 * 1000; // 60s

export const GET = withTenant(async (request, { companyId }) => {
    try {
        const supabase = createClient();
        const { searchParams } = new URL(request.url);

        const type = searchParams.get("type");
        const field = searchParams.get("field");
        const search = searchParams.get("search");

        const cacheKey = `${companyId || "all"}`;
        const now = Date.now();
        const cached = serverStructuresCache.get(cacheKey);

        let result: any[] = [];

        if (cached && now - cached.timestamp < STRUCTURES_CACHE_TTL_MS) {
            result = cached.data;
        } else {
            // Fetch all platforms, pipelines, and structures in parallel without restrictive subquery filters
            const [
                { data: structuresData },
                { data: platformsData },
                { data: pipelinesData }
            ] = await Promise.all([
                companyId 
                    ? (supabase as any).from("structure").select("*").eq("company_id", companyId)
                    : (supabase as any).from("structure").select("*"),
                (supabase as any).from("platform").select("*"),
                (supabase as any).from("u_pipeline").select("*"),
            ]);

            // Fallback for structures if tenant query returned 0
            let structures = structuresData;
            if ((!structures || structures.length === 0) && companyId) {
                const { data: allStr } = await (supabase as any).from("structure").select("*");
                if (allStr && allStr.length > 0) {
                    structures = allStr;
                }
            }

            // Build fast index lookup maps for platforms and pipelines
            const platformMap = new Map<string, any>();
            (platformsData || []).forEach((p: any) => {
                if (p.plat_id !== undefined && p.plat_id !== null) platformMap.set(String(p.plat_id), p);
                if (p.id !== undefined && p.id !== null) platformMap.set(String(p.id), p);
                if (p.str_id !== undefined && p.str_id !== null) platformMap.set(String(p.str_id), p);
            });

            const pipelineMap = new Map<string, any>();
            (pipelinesData || []).forEach((pl: any) => {
                if (pl.pipe_id !== undefined && pl.pipe_id !== null) pipelineMap.set(String(pl.pipe_id), pl);
                if (pl.id !== undefined && pl.id !== null) pipelineMap.set(String(pl.id), pl);
                if (pl.str_id !== undefined && pl.str_id !== null) pipelineMap.set(String(pl.str_id), pl);
            });

            const processedIds = new Set<string>();

            // Map structures with enriched platform and pipeline data
            const mappedStructures = (structures || []).map((item: any) => {
                const sId = String(item.str_id || item.id || "");
                if (processedIds.has(sId)) return null;
                processedIds.add(sId);

                const isPipeline = String(item.str_type).toUpperCase() === "PIPELINE";
                if (isPipeline) {
                    const pipeline = pipelineMap.get(sId);
                    const title = pipeline?.title || pipeline?.str_name || pipeline?.name || pipeline?.pipeline_name || pipeline?.pipe_name || item.str_name || item.title || item.name || item.str_title || `Pipeline ${sId}`;
                    return {
                        id: item.str_id || item.id,
                        str_id: item.str_id || item.id,
                        str_name: title,
                        title: title,
                        str_type: "PIPELINE",
                        field_name: pipeline?.pfield || item.field_name || item.pfield || "Offshore",
                        location: pipeline?.location || "",
                        water_depth: 0,
                        installation_date: pipeline?.installation_date || pipeline?.inst_date || "",
                        status: pipeline?.status || "Active",
                        photo_url: pipeline?.photo_url || null,
                    };
                } else {
                    const platform = platformMap.get(sId);
                    const title = platform?.title || platform?.str_name || platform?.name || platform?.platform_name || platform?.plat_name || item.str_name || item.title || item.name || item.str_title || `Platform ${sId}`;
                    return {
                        id: item.str_id || item.id,
                        str_id: item.str_id || item.id,
                        str_name: title,
                        title: title,
                        str_type: "PLATFORM",
                        field_name: platform?.pfield || item.field_name || item.pfield || "Offshore",
                        location: platform?.location || "",
                        water_depth: platform?.depth || 0,
                        installation_date: platform?.installation_date || platform?.inst_date || "",
                        status: platform?.status || "Active",
                        photo_url: platform?.photo_url || null,
                    };
                }
            }).filter(Boolean);

            // Also append any platforms from platform table not already mapped in structure
            (platformsData || []).forEach((p: any) => {
                const pid = String(p.plat_id || p.id || "");
                if (pid && !processedIds.has(pid)) {
                    processedIds.add(pid);
                    const title = p.title || p.str_name || p.name || p.platform_name || p.plat_name || `Platform ${pid}`;
                    mappedStructures.push({
                        id: p.plat_id || p.id,
                        str_id: p.plat_id || p.id,
                        str_name: title,
                        title: title,
                        str_type: "PLATFORM",
                        field_name: p.pfield || "Offshore",
                        location: p.location || "",
                        water_depth: p.depth || 0,
                        installation_date: p.installation_date || p.inst_date || "",
                        status: p.status || "Active",
                        photo_url: p.photo_url || null,
                    });
                }
            });

            // Also append any pipelines from u_pipeline table not already mapped
            (pipelinesData || []).forEach((pl: any) => {
                const pid = String(pl.pipe_id || pl.id || "");
                if (pid && !processedIds.has(pid)) {
                    processedIds.add(pid);
                    const title = pl.title || pl.str_name || pl.name || pl.pipeline_name || pl.pipe_name || `Pipeline ${pid}`;
                    mappedStructures.push({
                        id: pl.pipe_id || pl.id,
                        str_id: pl.pipe_id || pl.id,
                        str_name: title,
                        title: title,
                        str_type: "PIPELINE",
                        field_name: pl.pfield || "Offshore",
                        location: pl.location || "",
                        water_depth: 0,
                        installation_date: pl.installation_date || pl.inst_date || "",
                        status: pl.status || "Active",
                        photo_url: pl.photo_url || null,
                    });
                }
            });

            result = mappedStructures;
            serverStructuresCache.set(cacheKey, { data: result, timestamp: now });
        }

        // Apply type filter
        let filteredResult = result;
        if (type && type !== "all") {
            filteredResult = filteredResult?.filter((s: any) => String(s.str_type).toUpperCase() === type.toUpperCase());
        }

        // Apply search filter
        if (search) {
            filteredResult = filteredResult?.filter((s: any) =>
                s.str_name.toLowerCase().includes(search.toLowerCase()) ||
                s.str_id.toString().includes(search)
            );
        }

        // Apply field filter
        if (field && field !== "all") {
            filteredResult = filteredResult?.filter((s: any) => s.field_name === field);
        }

        return NextResponse.json({
            success: true,
            data: filteredResult,
            count: filteredResult?.length || 0,
        });
    } catch (error: any) {
        console.error("Error in GET /api/structures:", error);
        return NextResponse.json(
            { error: "Internal server error", details: error.message },
            { status: 500 }
        );
    }
});
