import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const body = await request.json();
        const { sow_id, structure_id } = body;

        if (!sow_id || !structure_id) {
            return NextResponse.json({ error: "sow_id and structure_id are required" }, { status: 400 });
        }

        // 1. Fetch all SOW items
        const { data: sowItems, error: sowError } = await (supabase as any)
            .from("u_sow_items")
            .select("*")
            .eq("sow_id", sow_id);

        if (sowError) throw sowError;

        // 2. Fetch all inspection records for this structure
        const { data: records, error: recError } = await (supabase as any)
            .from("insp_records")
            .select("component_id, inspection_type_id, inspection_type_code, status, elevation")
            .eq("structure_id", structure_id);

        if (recError) throw recError;

        const results = [];
        const updates = [];

        // 3. Process each SOW item
        for (const item of sowItems) {
            const itemRecords = (records || []).filter((r: any) => 
                r.component_id === item.component_id && 
                (r.inspection_type_id === item.inspection_type_id || r.inspection_type_code === item.inspection_code)
            );

            let newStatus = "pending";
            let newElevationData = item.elevation_data || [];
            let statusChanged = false;

            if (item.elevation_required && Array.isArray(item.elevation_data)) {
                // Handle elevation-bound items
                const updatedElevData = item.elevation_data.map((elev: any) => {
                    const start = parseFloat(elev.start);
                    const end = parseFloat(elev.end);
                    const minE = Math.min(start, end);
                    const maxE = Math.max(start, end);

                    const rangeRecords = itemRecords.filter((r: any) => 
                        r.elevation !== null && 
                        r.elevation >= minE && 
                        r.elevation <= maxE
                    );

                    let rangeStatus = "pending";
                    if (rangeRecords.length > 0) {
                        const hasIncomplete = rangeRecords.some((r: any) => r.status === 'INCOMPLETE');
                        rangeStatus = hasIncomplete ? 'incomplete' : 'completed';
                    }

                    if (rangeStatus !== elev.status) statusChanged = true;
                    return { ...elev, status: rangeStatus };
                });

                newElevationData = updatedElevData;

                const allDone = updatedElevData.every((e: any) => e.status === 'completed');
                const allPending = updatedElevData.every((e: any) => e.status === 'pending');
                
                if (allDone) newStatus = 'completed';
                else if (allPending) newStatus = 'pending';
                else newStatus = 'incomplete';
            } else {
                // Handle standard items
                if (itemRecords.length > 0) {
                    const hasIncomplete = itemRecords.some((r: any) => r.status === 'INCOMPLETE');
                    newStatus = hasIncomplete ? 'incomplete' : 'completed';
                }
            }

            if (newStatus !== item.status) statusChanged = true;

            if (statusChanged) {
                updates.push({
                    id: item.id,
                    status: newStatus,
                    elevation_data: newElevationData,
                    updated_at: new Date().toISOString()
                });
            }
        }

        // 4. Perform bulk update if there are changes
        if (updates.length > 0) {
            for (const up of updates) {
                await (supabase as any)
                    .from("u_sow_items")
                    .update({ status: up.status, elevation_data: up.elevation_data, updated_at: up.updated_at })
                    .eq("id", up.id);
            }
        }

        // 5. Identify missing SOW items (records that don't have a corresponding SOW item)
        const missingItems = [];
        const existingKeys = new Set((sowItems || []).map((item: any) => `${item.component_id}:${item.inspection_type_id}`));

        // Group records by component and task to avoid duplicate inserts
        const recordGroups: Record<string, any[]> = {};
        for (const rec of (records || [])) {
            const key = `${rec.component_id}:${rec.inspection_type_id}`;
            if (!existingKeys.has(key)) {
                if (!recordGroups[key]) recordGroups[key] = [];
                recordGroups[key].push(rec);
            }
        }

        if (Object.keys(recordGroups).length > 0) {
            // Fetch structure details to populate missing item metadata
            const { data: structData } = await (supabase as any).from(
                body.structure_type === 'PIPELINE' ? 'pipeline' : 'platform'
            )
            .select('title')
            .eq(body.structure_type === 'PIPELINE' ? 'pipe_id' : 'plat_id', structure_id)
            .single();

            // Fetch component details
            const compIds = Object.keys(recordGroups).map(k => parseInt(k.split(':')[0]));
            const { data: comps } = await supabase.from('structure_components')
                .select('id, q_id, code')
                .in('id', compIds);

            // Fetch inspection type details
            const typeIds = Object.keys(recordGroups).map(k => parseInt(k.split(':')[1]));
            const { data: types } = await supabase.from('inspection_type')
                .select('id, code, name')
                .in('id', typeIds);

            for (const [key, group] of Object.entries(recordGroups)) {
                const [compId, typeId] = key.split(':');
                const comp = (comps || []).find((c: any) => String(c.id) === compId);
                const type = (types || []).find((t: any) => String(t.id) === typeId);

                if (comp && type) {
                    const hasIncomplete = (group || []).some((r: any) => r.status === 'INCOMPLETE');
                    const status = hasIncomplete ? 'incomplete' : 'completed';

                    missingItems.push({
                        sow_id,
                        component_id: parseInt(compId),
                        component_qid: comp.q_id,
                        component_type: comp.code,
                        inspection_type_id: parseInt(typeId),
                        inspection_code: type.code,
                        inspection_name: type.name,
                        status,
                        created_by: 'Correction Tool',
                        updated_at: new Date().toISOString()
                    });
                }
            }

            if (missingItems.length > 0) {
                await (supabase as any).from("u_sow_items").insert(missingItems);
            }
        }

        return NextResponse.json({ 
            success: true, 
            total_checked: sowItems.length, 
            updated_count: updates.length,
            inserted_count: missingItems.length
        });

    } catch (error: any) {
        console.error("[SOW Correction API] Error:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
