/**
 * Scour Report Sorting & Topology Utilities
 * 
 * Supports dynamic multi-leg and multi-member jacket faces:
 * - 1 HM / HD member -> 2 legs, 2 nodes (1 span)
 * - 2 HM / HD members -> 3 legs, 3 nodes (2 spans)
 * - 3 HM / HD members -> 4 legs, 4 nodes (3 spans)
 * - N HM / HD members -> N+1 legs, N+1 nodes (N spans)
 *
 * Orders scour records for a single Face group according to physical/spatial order:
 * From leftmost leg/pile, through member midpoint, to next leg, ... to rightmost leg/pile.
 */

export interface ScourLegInfo {
    name: string;        // e.g. "A1"
    node: string;        // e.g. "N456"
    pileRec?: any;       // PILE record at this leg if present
    index: number;
}

export interface ScourSpanInfo {
    index: number;
    memberQid: string;   // e.g. "HOM N455-N456"
    memberComp?: any;
    fromLeg: string;     // e.g. "A1"
    toLeg: string;       // e.g. "A2"
    startNode: string;   // e.g. "N456"
    endNode: string;     // e.g. "N455"
}

export interface ScourFaceTopology {
    legs: ScourLegInfo[];
    spans: ScourSpanInfo[];
}

export const cleanLegName = (val: any): string => {
    if (!val) return "";
    let s = String(val).trim().toUpperCase();
    s = s.replace(/^LEG\s*[:\- ]*\s*/i, "");
    s = s.replace(/[:\- ]/g, "");
    return s;
};

export const cleanNodeName = (val: any): string => {
    if (!val) return "";
    let s = String(val).trim().toUpperCase();
    s = s.replace(/^NODE\s*[:\- ]*\s*/i, "");
    if (/^[0-9]+$/.test(s)) {
        s = "N" + s;
    }
    return s;
};

export const isPile = (r: any): boolean => {
    const comp = r.structure_components || r.component || {};
    const code = String(comp.code || comp.component_type || r.component_code || "").toUpperCase();
    const qid = String(comp.q_id || r.qid || "").toUpperCase();
    return code === "PL" || code === "PILE" || qid.startsWith("PL") || qid.startsWith("PILE");
};

/**
 * Checks if a record is associated with a specific leg name.
 * For inspection records, scour_location takes precedence.
 */
export const matchesLeg = (r: any, legName: string): boolean => {
    if (!legName) return false;
    const target = cleanLegName(legName);
    if (!target) return false;

    const d = r.inspection_data || r.inspection_dat || {};
    const comp = r.structure_components || r.component || {};
    const md = (typeof comp.metadata === "string" ? JSON.parse(comp.metadata) : comp.metadata) || {};

    const qid = String(comp.q_id || r.qid || "").toUpperCase();
    const loc = String(d.scour_location || "").toUpperCase();

    // 1. Check scour_location first (e.g. "Leg : A1")
    const locMatch = loc.match(/LEG\s*[:\- ]*\s*([A-Z0-9]+)/i);
    if (locMatch && cleanLegName(locMatch[1]) === target) return true;

    // 2. For Pile records, check QID and metadata
    if (isPile(r)) {
        const qidMatch = qid.match(/LEG\s*[:\- ]*\s*([A-Z0-9]+)/i) || qid.match(/PL[-_ ]*([A-Z0-9]+)/i);
        if (qidMatch && cleanLegName(qidMatch[1]) === target) return true;
        if (qid.includes(target)) return true;

        const compLeg = cleanLegName(comp.leg_no || comp.leg || md.leg_no || md.leg || md.s_leg || md.leg_1 || "");
        if (compLeg === target) return true;
    }

    return false;
};

/**
 * Builds the physical topology (legs, nodes, and spans in topological order)
 * for all members and piles within a single Face.
 */
export const buildScourFaceTopology = (records: any[], faceName?: string): ScourFaceTopology => {
    if (!records || records.length === 0) {
        return {
            legs: [
                { name: "A1", node: "N1", index: 0 },
                { name: "A2", node: "N2", index: 1 }
            ],
            spans: [
                { index: 0, memberQid: "HOM", fromLeg: "A1", toLeg: "A2", startNode: "N1", endNode: "N2" }
            ]
        };
    }

    const pileRecords = records.filter(isPile);
    const nonPileRecords = records.filter(r => !isPile(r));

    // Group non-pile records by unique member QID
    interface RawMember {
        qid: string;
        comp: any;
        legA: string;
        legB: string;
        nodeA: string;
        nodeB: string;
        records: any[];
    }

    const memberMap = new Map<string, RawMember>();

    nonPileRecords.forEach(r => {
        const comp = r.structure_components || r.component || {};
        const qid = String(comp.q_id || r.qid || "").trim();
        if (!qid) return;

        if (!memberMap.has(qid)) {
            const md = (typeof comp.metadata === "string" ? JSON.parse(comp.metadata) : comp.metadata) || {};
            let legA = cleanLegName(md.s_leg || md.start_leg || md.leg_1 || comp.startLeg);
            let legB = cleanLegName(md.f_leg || md.end_leg || md.leg_2 || comp.endLeg);
            let nodeA = cleanNodeName(md.s_node || md.start_node || md.node_1);
            let nodeB = cleanNodeName(md.f_node || md.end_node || md.node_2);

            // Attempt node extraction from QID e.g. HOM N455-N456 or 455-456
            if (!nodeA || !nodeB) {
                const nodeMatch = qid.match(/([A-Z]*[0-9]+)[-_ ]+([A-Z]*[0-9]+)/i);
                if (nodeMatch) {
                    if (!nodeA) nodeA = cleanNodeName(nodeMatch[1]);
                    if (!nodeB) nodeB = cleanNodeName(nodeMatch[2]);
                }
            }

            memberMap.set(qid, {
                qid,
                comp,
                legA,
                legB,
                nodeA,
                nodeB,
                records: []
            });
        }
        memberMap.get(qid)!.records.push(r);
    });

    // For any member missing legA or legB, deduce from inspection scour_location
    memberMap.forEach(m => {
        const foundLocLegs: string[] = [];
        m.records.forEach(r => {
            const loc = String(r.inspection_data?.scour_location || "");
            const match = loc.match(/LEG\s*[:\- ]*\s*([A-Z0-9]+)/i);
            if (match) {
                const l = cleanLegName(match[1]);
                if (l && !foundLocLegs.includes(l)) foundLocLegs.push(l);
            }
        });

        if (!m.legA && foundLocLegs.length > 0) m.legA = foundLocLegs[0];
        if (!m.legB && foundLocLegs.length > 1) m.legB = foundLocLegs[1];
    });

    const rawMembers = Array.from(memberMap.values());

    // If no horizontal members exist, check if legs can be extracted from piles/records
    if (rawMembers.length === 0) {
        const foundLegs: string[] = [];
        records.forEach(r => {
            const d = r.inspection_data || {};
            const comp = r.structure_components || r.component || {};
            const md = (typeof comp.metadata === "string" ? JSON.parse(comp.metadata) : comp.metadata) || {};
            const legCandidates = [
                comp.startLeg, comp.endLeg, comp.leg_no, comp.leg,
                md.start_leg, md.end_leg, md.s_leg, md.f_leg, md.leg_no, md.leg,
                d.scour_location
            ];
            legCandidates.forEach(cand => {
                if (!cand) return;
                const m = String(cand).match(/([A-Z0-9]+)/i);
                if (m) {
                    const l = cleanLegName(m[1]);
                    if (l && !foundLegs.includes(l)) foundLegs.push(l);
                }
            });
        });

        if (foundLegs.length === 0 && faceName && faceName.includes("-")) {
            const fm = faceName.match(/([A-Z0-9]+)\s*-\s*([A-Z0-9]+)/i);
            if (fm) {
                foundLegs.push(cleanLegName(fm[1]), cleanLegName(fm[2]));
            }
        }

        foundLegs.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

        const leg1 = foundLegs[0] || "A1";
        const leg2 = foundLegs[1] || (leg1 !== "B1" ? "B1" : "A2");

        const legs: ScourLegInfo[] = [
            { name: leg1, node: `N-${leg1}`, index: 0 },
            { name: leg2, node: `N-${leg2}`, index: 1 }
        ];

        legs.forEach(l => {
            const p = pileRecords.find(pr => matchesLeg(pr, l.name));
            if (p) l.pileRec = p;
        });

        return {
            legs,
            spans: [
                { index: 0, memberQid: "HOM", fromLeg: leg1, toLeg: leg2, startNode: `N-${leg1}`, endNode: `N-${leg2}` }
            ]
        };
    }

    // Build adjacency graph of legs connected by horizontal members
    interface Edge {
        member: RawMember;
        otherLeg: string;
        nodeAtThisLeg: string;
        nodeAtOtherLeg: string;
    }

    const adj = new Map<string, Edge[]>();

    const addEdge = (fromLeg: string, toLeg: string, nodeFrom: string, nodeTo: string, member: RawMember) => {
        if (!adj.has(fromLeg)) adj.set(fromLeg, []);
        adj.get(fromLeg)!.push({
            member,
            otherLeg: toLeg,
            nodeAtThisLeg: nodeFrom,
            nodeAtOtherLeg: nodeTo
        });
    };

    rawMembers.forEach(m => {
        let lA = m.legA;
        let lB = m.legB;
        if (!lA && !lB) {
            lA = "A1";
            lB = "A2";
        } else if (!lA) {
            lA = "A1";
        } else if (!lB) {
            lB = "A2";
        }

        let nA = m.nodeA || `N-${lA}`;
        let nB = m.nodeB || `N-${lB}`;

        addEdge(lA, lB, nA, nB, m);
        addEdge(lB, lA, nB, nA, m);
    });

    // Find all candidate start legs (endpoints with degree 1)
    const allLegs = Array.from(adj.keys()).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );

    const degree1Legs = allLegs.filter(l => adj.get(l)!.length === 1);
    const startLeg = degree1Legs.length > 0 ? degree1Legs[0] : allLegs[0];

    // Traverse the chain from startLeg
    const visitedMembers = new Set<string>();
    const legs: ScourLegInfo[] = [];
    const spans: ScourSpanInfo[] = [];

    let currLeg = startLeg;
    const initialEdges = adj.get(currLeg) || [];
    const initialNode = initialEdges.length > 0 ? initialEdges[0].nodeAtThisLeg : `N-${currLeg}`;

    legs.push({
        name: currLeg,
        node: cleanNodeName(initialNode),
        index: 0
    });

    while (visitedMembers.size < rawMembers.length) {
        const edges = adj.get(currLeg) || [];
        const nextEdge = edges.find(e => !visitedMembers.has(e.member.qid));

        if (!nextEdge) {
            const unvisited = rawMembers.find(m => !visitedMembers.has(m.qid));
            if (!unvisited) break;

            visitedMembers.add(unvisited.qid);
            const nextL = unvisited.legB || `L${legs.length + 1}`;
            spans.push({
                index: spans.length,
                memberQid: unvisited.qid,
                memberComp: unvisited.comp,
                fromLeg: currLeg,
                toLeg: nextL,
                startNode: cleanNodeName(unvisited.nodeA || `N-${currLeg}`),
                endNode: cleanNodeName(unvisited.nodeB || `N-${nextL}`)
            });
            currLeg = nextL;
            legs.push({
                name: currLeg,
                node: cleanNodeName(unvisited.nodeB || `N-${currLeg}`),
                index: legs.length
            });
            continue;
        }

        visitedMembers.add(nextEdge.member.qid);
        const nextLeg = nextEdge.otherLeg;

        spans.push({
            index: spans.length,
            memberQid: nextEdge.member.qid,
            memberComp: nextEdge.member.comp,
            fromLeg: currLeg,
            toLeg: nextLeg,
            startNode: cleanNodeName(nextEdge.nodeAtThisLeg),
            endNode: cleanNodeName(nextEdge.nodeAtOtherLeg)
        });

        legs.push({
            name: nextLeg,
            node: cleanNodeName(nextEdge.nodeAtOtherLeg),
            index: legs.length
        });

        currLeg = nextLeg;
    }

    // Ensure at least 2 legs exist
    if (legs.length === 1) {
        const l2 = legs[0].name !== "A2" ? "A2" : "B1";
        legs.push({ name: l2, node: `N-${l2}`, index: 1 });
        if (spans.length === 0) {
            spans.push({
                index: 0,
                memberQid: rawMembers[0]?.qid || "HOM",
                memberComp: rawMembers[0]?.comp,
                fromLeg: legs[0].name,
                toLeg: l2,
                startNode: legs[0].node,
                endNode: `N-${l2}`
            });
        }
    }

    // Assign piles to corresponding legs
    legs.forEach(l => {
        const p = pileRecords.find(pr => matchesLeg(pr, l.name));
        if (p) l.pileRec = p;
    });

    return { legs, spans };
};

/**
 * Sorts scour records for a single Face group according to physical left-to-right order:
 * Pile(L0) -> Member0(L0 -> Mid -> L1) -> Pile(L1) -> Member1(L1 -> Mid -> L2) -> Pile(L2) -> ... -> Pile(Ln)
 */
export const sortScourFaceRecords = (records: any[], faceName?: string): any[] => {
    if (!records || records.length <= 1) return records || [];

    const topology = buildScourFaceTopology(records, faceName);
    const { legs, spans } = topology;
    const numLegs = legs.length;
    const numSpans = spans.length;

    // Helper to calculate exact physical score
    const getScore = (r: any): number => {
        const comp = r.structure_components || r.component || {};
        const qid = String(comp.q_id || r.qid || "").trim().toUpperCase();
        const d = r.inspection_data || r.inspection_dat || {};
        const loc = String(d.scour_location || "").trim();
        const locUpper = loc.toUpperCase();
        const isPl = isPile(r);

        const locMatch = locUpper.match(/LEG\s*[:\- ]*\s*([A-Z0-9]+)/i);
        const locLeg = locMatch ? cleanLegName(locMatch[1]) : "";

        if (isPl) {
            // Find which leg this pile belongs to
            let legIdx = legs.findIndex(l => matchesLeg(r, l.name));
            if (legIdx === -1) {
                legIdx = legs.findIndex(l => qid.includes(l.name) || (locLeg && l.name === locLeg));
            }

            if (legIdx === 0) {
                // First leg pile: at the very beginning of the face
                return 0;
            } else if (legIdx === numLegs - 1) {
                // Last leg pile: at the very end of the face
                return (2 * numLegs) * 100 + 90;
            } else if (legIdx > 0) {
                // Intermediate leg pile at Leg k:
                // Grouped cleanly between member (k - 1) ending at Leg k, and member k starting at Leg k!
                return (2 * legIdx) * 100 + 50;
            } else {
                return 9999;
            }
        }

        // Structural framing member
        const spanIdx = spans.findIndex(s => s.memberQid.toUpperCase() === qid);
        const isMid = locUpper.includes("MID") || locUpper.includes("MIDDLE") || locUpper.includes("CENTER");

        if (spanIdx !== -1) {
            const span = spans[spanIdx];
            // Span j occupies block: (2 * spanIdx + 1) * 100
            // All records of Member j remain strictly grouped together:
            // Start Leg (10) -> Midpoint (20) -> End Leg (30)
            const spanBase = (2 * spanIdx + 1) * 100;

            if (isMid) {
                return spanBase + 20;
            } else if (locLeg === span.fromLeg || locUpper.includes(span.fromLeg)) {
                return spanBase + 10;
            } else if (locLeg === span.toLeg || locUpper.includes(span.toLeg)) {
                return spanBase + 30;
            } else {
                return spanBase + 25;
            }
        }

        // Record for member not in spans - try matching location to any known leg
        if (locLeg) {
            const legIdx = legs.findIndex(l => l.name === locLeg);
            if (legIdx !== -1) {
                return (2 * legIdx + 1) * 100 + 40;
            }
        }

        return 9999;
    };

    return records.slice().sort((a, b) => getScore(a) - getScore(b));
};
