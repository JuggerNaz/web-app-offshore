const records = [
  { insp_id: 147, component_id: 3498, q_id: "RISG 2", metadata: { code: "RG" } },
  { insp_id: 148, component_id: 7804, q_id: "RISG 2-SUPP-A1", metadata: { associated_comp_id: 3498 } },
  { insp_id: 149, component_id: 7805, q_id: "RISG 2-SUPP-A2", metadata: { associated_comp_id: 3498 } }
];

const compRegistry = new Map();
records.forEach(r => compRegistry.set(r.component_id, { id: r.component_id, q_id: r.q_id, metadata: r.metadata }));

const getRGBranchInfo = (cid, depth = 0) => {
    if (!cid || depth > 5) return { top: null, hasRG: false };
    const c = compRegistry.get(cid);
    if (!c) return { top: null, hasRG: false };
    const qid = (c.q_id || "").toUpperCase().trim();
    const typeCode = (c.code || c.metadata?.code || "").toUpperCase();
    const isRG = qid.startsWith("RG") || qid.startsWith("RISG") || typeCode === "RG" || typeCode === "RISG";
    const meta = c.metadata || {};
    const pId = meta.associated_comp_id || meta.parent_id || meta.associated_id;
    if (!pId) return { top: c, hasRG: isRG };
    const result = getRGBranchInfo(Number(pId), depth + 1);
    return { top: result.top || c, hasRG: result.hasRG || isRG };
};

const topLevelRGs = [];
compRegistry.forEach(c => {
    const qid = (c.q_id || "").toUpperCase().trim();
    const typeCode = (c.code || c.metadata?.code || "").toUpperCase();
    const isRG = qid.startsWith("RG") || qid.startsWith("RISG") || typeCode === "RG";
    const pId = c.metadata?.associated_comp_id || c.metadata?.parent_id;
    if (isRG && !pId) topLevelRGs.push(c);
});

console.log("Top Level RGs:", topLevelRGs.map(t => t.q_id));

const rgGroups = {};
records.forEach(r => {
    const comp = r;
    const metadata = r.metadata || {};
    const qid = (r.q_id || "").toUpperCase().trim();
    let resolvedTop = null;
    let hasRG = false;
    let bestPrefixMatch = null;
    topLevelRGs.forEach(trg => {
        const trgQid = (trg.q_id || "").toUpperCase().trim();
        if (trgQid && qid.startsWith(trgQid)) {
            if (!bestPrefixMatch || trgQid.length > (bestPrefixMatch.q_id || "").length) bestPrefixMatch = trg;
        }
    });
    if (bestPrefixMatch) {
        resolvedTop = bestPrefixMatch;
        hasRG = true;
    } else {
        const startId = metadata.associated_comp_id || comp.component_id;
        const branch = getRGBranchInfo(Number(startId));
        resolvedTop = branch.top;
        hasRG = branch.hasRG;
    }
    if (hasRG && resolvedTop) {
        const key = String(resolvedTop.id);
        if (!rgGroups[key]) rgGroups[key] = [];
        rgGroups[key].push(r.q_id);
    }
});

console.log("Groups:", JSON.stringify(rgGroups, null, 2));
