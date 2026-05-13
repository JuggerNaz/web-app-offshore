
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const ATTACHMENT_GROUPS = {
    "Riser":        ["RS", "RIS", "RISER"],
    "Conductor":    ["CD", "COND", "CONDUCTOR"],
    "Caisson":      ["CA", "CAIS", "CAISSON"],
    "Riser Guard":  ["RG", "RGUARD", "RISER_GUARD", "RISERGUARD"],
    "Boat Landing": ["BL", "BLTG", "BOAT_LANDING", "BOATLANDING", "BLD"],
};

async function checkCounts(jobpackId, structureId, sowReportNo) {
    console.log(`Checking counts for JP=${jobpackId}, STR=${structureId}, Report=${sowReportNo}`);

    // Resolve SOW ID
    const { data: sowRec } = await supabase
        .from("u_sow")
        .select("id")
        .eq("jobpack_id", jobpackId)
        .eq("structure_id", structureId)
        .limit(1)
        .maybeSingle();
    
    if (!sowRec) {
        console.log("No SOW found");
        return;
    }
    const resolvedSowId = sowRec.id;

    // Fetch SOW items
    const { data: allSowItems } = await supabase
        .from("u_sow_items")
        .select("status, component_id, component_type, component_qid, report_number, structure_components:component_id(id, q_id, code)")
        .eq("sow_id", resolvedSowId);

    // Fetch Records
    const { data: rawRecords } = await supabase
        .from("insp_records")
        .select(`
            insp_id,
            status,
            component_type,
            component_id,
            structure_components:component_id(id, q_id, code)
        `)
        .eq("jobpack_id", jobpackId)
        .eq("structure_id", structureId);

    const sowCompIds = { "Riser": new Set(), "Conductor": new Set(), "Caisson": new Set(), "Riser Guard": new Set(), "Boat Landing": new Set() };
    const recordCompIds = { "Riser": new Set(), "Conductor": new Set(), "Caisson": new Set(), "Riser Guard": new Set(), "Boat Landing": new Set() };

    allSowItems.forEach((item) => {
        const comp = item.structure_components;
        const componentId = item.component_id || comp?.id;
        if (!componentId) return;

        const qid = (item.component_qid || comp?.q_id || "").toUpperCase();
        const code = (item.component_type || comp?.code || qid.split("-")[0] || "").toUpperCase();

        for (const [group, aliases] of Object.entries(ATTACHMENT_GROUPS)) {
            if (aliases.some(a => code.startsWith(a) || qid.startsWith(a)) || qid.includes(group.toUpperCase().replace(" ", ""))) {
                sowCompIds[group].add(componentId);
                break;
            }
        }
    });

    rawRecords.forEach((r) => {
        const componentId = r.component_id;
        if (!componentId) return;

        const qid = (r.structure_components?.q_id || "").toUpperCase();
        const code = (r.component_type || r.structure_components?.code || qid.split("-")[0] || "").toUpperCase();

        for (const [group, aliases] of Object.entries(ATTACHMENT_GROUPS)) {
            if (aliases.some(a => code.startsWith(a) || qid.startsWith(a)) || qid.includes(group.toUpperCase().replace(" ", ""))) {
                recordCompIds[group].add(componentId);
                break;
            }
        }
    });

    console.log("Attachment Group Summary:");
    Object.keys(ATTACHMENT_GROUPS).forEach(group => {
        console.log(`${group}: ${recordCompIds[group].size} / ${sowCompIds[group].size}`);
    });
}

// I need to find a valid JP and STR.
// I'll check the most recent records.
async function findContext() {
    const { data } = await supabase.from('insp_records').select('jobpack_id, structure_id, sow_report_no').order('cr_date', { ascending: false }).limit(1);
    if (data && data.length > 0) {
        await checkCounts(data[0].jobpack_id, data[0].structure_id, data[0].sow_report_no);
    } else {
        console.log("No records found to test with");
    }
}

findContext();
