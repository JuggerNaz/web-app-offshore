/**
 * Scour Report Sorting Utilities
 * 
 * Orders scour records for a single Face group according to physical/spatial order:
 * 1. Start Leg / Left Leg Pile (at first)
 * 2. Start Leg / Left Leg Member locations
 * 3. Midpoint Member location (always at the centre)
 * 4. End Leg / Right Leg Member locations
 * 5. End Leg / Right Leg Pile (at last)
 */

export const sortScourFaceRecords = (records: any[], faceName?: string): any[] => {
    if (!records || records.length <= 1) return records || [];

    // Helper to check if a record is a Pile
    const isPile = (r: any): boolean => {
        const comp = r.structure_components || r.component || {};
        const code = String(comp.code || comp.component_type || r.component_code || "").toUpperCase();
        const qid = String(comp.q_id || r.qid || "").toUpperCase();
        return code === "PL" || code === "PILE" || qid.startsWith("PL") || qid.startsWith("PILE");
    };

    // Extract all leg names mentioned across the records in this face
    const foundLegNames: string[] = [];
    records.forEach(r => {
        const d = r.inspection_data || r.inspection_dat || {};
        const comp = r.structure_components || r.component || {};
        const md = (typeof comp.metadata === "string" ? JSON.parse(comp.metadata) : comp.metadata) || {};

        // From component metadata
        const sL = comp.startLeg || md.start_leg || md.s_leg || md.leg_1 || "";
        const fL = comp.endLeg || md.end_leg || md.f_leg || md.leg_2 || "";
        const pL = comp.leg_no || comp.leg || md.leg_no || md.leg || "";

        [sL, fL, pL].forEach(l => {
            const clean = String(l).trim().replace(/^leg\s*[:\- ]*\s*/i, "").toUpperCase();
            if (clean && !foundLegNames.includes(clean)) foundLegNames.push(clean);
        });

        // From scour_location
        const loc = String(d.scour_location || "").toLowerCase();
        const legMatch = loc.match(/leg\s*[:\- ]*\s*([a-zA-Z0-9]+)/i);
        if (legMatch && legMatch[1]) {
            const clean = legMatch[1].trim().toUpperCase();
            if (clean && !foundLegNames.includes(clean)) foundLegNames.push(clean);
        }

        // From QID if pile
        const qid = String(comp.q_id || r.qid || "").toUpperCase();
        const pileQMatch = qid.match(/PILE\s*LEG\s*([a-zA-Z0-9]+)/i) || qid.match(/PL[-_ ]*([a-zA-Z0-9]+)/i);
        if (pileQMatch && pileQMatch[1]) {
            const clean = pileQMatch[1].trim().toUpperCase();
            if (clean && !foundLegNames.includes(clean)) foundLegNames.push(clean);
        }
    });

    // Check primary member's startLeg and endLeg to establish left (start) vs right (end)
    const nonPileRecords = records.filter(r => !isPile(r));
    const primMember = nonPileRecords[0]?.structure_components || nonPileRecords[0]?.component || records[0]?.structure_components || records[0]?.component || {};
    const primMd = (typeof primMember.metadata === "string" ? JSON.parse(primMember.metadata) : primMember.metadata) || {};

    let leg1 = String(primMember.startLeg || primMd.start_leg || primMd.s_leg || primMd.leg_1 || "").trim().replace(/^leg\s*[:\- ]*\s*/i, "").toUpperCase();
    let leg2 = String(primMember.endLeg || primMd.end_leg || primMd.f_leg || primMd.leg_2 || "").trim().replace(/^leg\s*[:\- ]*\s*/i, "").toUpperCase();

    // If not found in primary member metadata, check faceName (e.g. "Face B1-B2" or "Row B")
    if ((!leg1 || !leg2) && faceName && faceName.includes("-")) {
        const fMatch = faceName.match(/([a-zA-Z0-9]+)\s*-\s*([a-zA-Z0-9]+)/i);
        if (fMatch) {
            if (!leg1) leg1 = fMatch[1].replace(/^face\s*|^leg\s*/i, "").toUpperCase();
            if (!leg2) leg2 = fMatch[2].replace(/^face\s*|^leg\s*/i, "").toUpperCase();
        }
    }

    // If still missing, check if member locations mention legs
    if (!leg1 && foundLegNames.length > 0) {
        const memberLocLeg = nonPileRecords.map(r => {
            const loc = String(r.inspection_data?.scour_location || "");
            const m = loc.match(/leg\s*[:\- ]*\s*([a-zA-Z0-9]+)/i);
            return m ? m[1].toUpperCase() : null;
        }).filter(Boolean);

        if (memberLocLeg.length > 0) {
            leg1 = memberLocLeg[0]!;
            leg2 = foundLegNames.find(l => l !== leg1) || (foundLegNames[1] || "");
        } else {
            leg1 = foundLegNames[0] || "";
            leg2 = foundLegNames[1] || "";
        }
    }

    // Helper to test if a record is associated with a specific leg name
    const matchesLeg = (r: any, legName: string): boolean => {
        if (!legName) return false;
        const target = legName.toUpperCase().trim();
        const d = r.inspection_data || r.inspection_dat || {};
        const comp = r.structure_components || r.component || {};
        const qid = String(comp.q_id || r.qid || "").toUpperCase();
        const loc = String(d.scour_location || "").toUpperCase();
        const compLeg = String(comp.leg_no || comp.leg || "").toUpperCase();

        if (qid.includes(target) || compLeg.includes(target)) return true;
        if (loc.includes(`LEG : ${target}`) || loc.includes(`LEG:${target}`) || loc.includes(`LEG ${target}`) || loc.includes(target)) return true;
        return false;
    };

    const pileStart: any[] = [];
    const memberStart: any[] = [];
    const memberMid: any[] = [];
    const memberEnd: any[] = [];
    const pileEnd: any[] = [];
    const otherRecords: any[] = [];

    records.forEach(r => {
        const d = r.inspection_data || r.inspection_dat || {};
        const locTag = String(d.scour_location || "").toLowerCase();
        const isPl = isPile(r);

        const isMid = locTag.includes("mid") || locTag.includes("middle") || locTag.includes("center");
        const isStart = locTag.includes("start") || (leg1 && matchesLeg(r, leg1));
        const isEnd = locTag.includes("end") || (leg2 && matchesLeg(r, leg2));

        if (isPl) {
            if (isStart) {
                pileStart.push(r);
            } else if (isEnd) {
                pileEnd.push(r);
            } else {
                if (pileStart.length === 0) {
                    pileStart.push(r);
                } else {
                    pileEnd.push(r);
                }
            }
        } else {
            // Horizontal framing / structural member
            if (isMid) {
                memberMid.push(r);
            } else if (isStart) {
                memberStart.push(r);
            } else if (isEnd) {
                memberEnd.push(r);
            } else {
                // If it matches neither leg explicitly, determine if it has start or end affinity
                otherRecords.push(r);
            }
        }
    });

    return [
        ...pileStart,
        ...memberStart,
        ...memberMid,
        ...memberEnd,
        ...pileEnd,
        ...otherRecords
    ];
};
