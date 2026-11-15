import { describe, it, expect } from "vitest";
import { jsPDF } from "jspdf";
import {
    SketchMember,
    chooseElevationAxis,
    drawElevationView,
    drawFlagLegend,
    drawMemberDetail,
    drawPanelTitle,
    drawPlanView,
    filterElevationContextForElevations,
    filterPlanContextForElevations,
    isAnodeMember,
    isWeldMember,
    resolveFaceSubtitle
} from "./member-sketch";
import { buildDebrisItems, resolveRelevantElevations } from "./debris-location-report";

describe("Debris Location Report 3D Face View & 3D Framing Plan", () => {
    const contextMembers: SketchMember[] = [
        // 4 corner legs
        { qid: "A1", code: "LG", start: [15, 3, -10], end: [15, -35, -10], sLeg: "A1", fLeg: "A1", isFoundation: true },
        { qid: "B1", code: "LG", start: [15, 3, 10], end: [15, -35, 10], sLeg: "B1", fLeg: "B1", isFoundation: true },
        { qid: "A2", code: "LG", start: [-15, 3, -10], end: [-15, -35, -10], sLeg: "A2", fLeg: "A2", isFoundation: true },
        { qid: "B2", code: "LG", start: [-15, 3, 10], end: [-15, -35, 10], sLeg: "B2", fLeg: "B2", isFoundation: true },
        // Horizontal levels on Face A1-B1 (x = 15)
        { qid: "HM-A1-B1-3", code: "HM", start: [15, 3, -10], end: [15, 3, 10], sLeg: "A1", fLeg: "B1", sNode: "N1", fNode: "N2" },
        { qid: "HM-A1-B1-5", code: "HM", start: [15, -5, -10], end: [15, -5, 10], sLeg: "A1", fLeg: "B1", sNode: "N3", fNode: "N4" },
        { qid: "HM-A1-B1-15", code: "HM", start: [15, -15, -10], end: [15, -15, 10], sLeg: "A1", fLeg: "B1", sNode: "N5", fNode: "N6", hasAnomaly: true, anomalyLabel: "A-015" },
        { qid: "HM-A1-B1-25", code: "HM", start: [15, -25, -10], end: [15, -25, 10], sLeg: "A1", fLeg: "B1", sNode: "N7", fNode: "N8", compId: 1001 },
        { qid: "HM-A1-B1-35", code: "HM", start: [15, -35, -10], end: [15, -35, 10], sLeg: "A1", fLeg: "B1", sNode: "N9", fNode: "N10", compId: 1002 },
        // Diagonal braces on Face A1-B1
        { qid: "VDM-1", code: "VDM", start: [15, -5, -10], end: [15, 3, 10], sLeg: "A1", fLeg: "B1" },
        { qid: "VDM-2", code: "VDM", start: [15, -5, -10], end: [15, -15, 10], sLeg: "A1", fLeg: "B1" },
        { qid: "VDM-3", code: "VDM", start: [15, -25, -10], end: [15, -15, 10], sLeg: "A1", fLeg: "B1" },
        { qid: "A-002", code: "VDM", start: [15, -35, -10], end: [15, -25, 10], sLeg: "A1", fLeg: "B1" },
        // Anodes (AN) and Node Welds (WN) on Face A1-B1 and EL -35m
        { qid: "BAN102", code: "AN", start: [15, -25, 0], end: [15, -25, 0.8], sNode: "N7", fNode: "N8", associatedCompId: 1001 },
        { qid: "BAN169", code: "AN", start: [15, -35, -2], end: [15, -35, -1.2], sNode: "N9", fNode: "N10", associatedCompId: 1002, hasAnomaly: true, anomalyLabel: "A-006" },
        { qid: "WN N7", code: "WN", start: [15, -25, -9.9], end: [15, -25, -9.8], sNode: "N7", fNode: "N7", associatedCompId: 1001 },
        // Plan framing at EL -35m
        { qid: "HM-A2-A1-35", code: "HM", start: [-15, -35, -10], end: [15, -35, -10], sLeg: "A2", fLeg: "A1", sNode: "N2", fNode: "N1" },
        { qid: "A-027", code: "HM", start: [-15, -35, 10], end: [15, -35, 10], sLeg: "B2", fLeg: "B1", sNode: "N4", fNode: "N3", hasAnomaly: true },
        { qid: "HM-A2-B2-35", code: "HM", start: [-15, -35, -10], end: [-15, -35, 10], sLeg: "A2", fLeg: "B2", sNode: "N2", fNode: "N4" },
        { qid: "A-018", code: "HDM", start: [-15, -35, -10], end: [15, -35, 10], sLeg: "A2", fLeg: "B1", sNode: "N2", fNode: "N3" },
        { qid: "A-033", code: "HDM", start: [-15, -35, 10], end: [15, -35, -10], sLeg: "B2", fLeg: "A1", sNode: "N4", fNode: "N1" }
    ];

    it("includes horizontal levels, diagonal braces, anodes (AN), node welds (WN), and anomaly highlights in 3D Face View", () => {
        const target = contextMembers.find(m => m.qid === "HM-A1-B1-25")!;
        const axis = chooseElevationAxis(target);
        expect(axis).toBe("z");
        expect(resolveFaceSubtitle(target, contextMembers, axis)).toBe("FACE A1-B1");

        const { members, activeElevs } = filterElevationContextForElevations(contextMembers, target, [-25], axis);
        expect(activeElevs).toEqual([3, -5, -15, -25, -35]);
        // Should include diagonal braces as well as horizontals and legs
        expect(members.some(m => m.qid === "A-002")).toBe(true);
        expect(members.some(m => m.qid === "VDM-3")).toBe(true);
        // Should include anodes (AN) and node welds (WN) on this face
        expect(members.some(m => isAnodeMember(m) && m.qid === "BAN102")).toBe(true);
        expect(members.some(m => isAnodeMember(m) && m.qid === "BAN169")).toBe(true);
        expect(members.some(m => isWeldMember(m) && m.qid === "WN N7")).toBe(true);
        // Host member HM-A1-B1-35 should inherit hasAnomaly from its anomalous anode BAN169
        const host35 = members.find(m => m.qid === "HM-A1-B1-35");
        expect(host35?.hasAnomaly).toBe(true);
    });

    it("includes anodes (AN), node welds (WN), and anomaly highlights in 3D Framing Plan", () => {
        const planFiltered = filterPlanContextForElevations(contextMembers, [-35]);
        expect(planFiltered.length).toBeGreaterThanOrEqual(8);
        expect(planFiltered.some(m => isAnodeMember(m) && m.qid === "BAN169")).toBe(true);
        const host35 = planFiltered.find(m => m.qid === "HM-A1-B1-35");
        expect(host35?.hasAnomaly).toBe(true);
    });

    it("renders 3D Face View, 3D Framing Plan, Member Detail, and Legend with anodes, node welds, and anomaly highlights", () => {
        const doc = new jsPDF();
        const target = contextMembers.find(m => m.qid === "A-018")!;
        const items = buildDebrisItems(
            [{ insp_id: 1, debris_type: "Scaffold Pipe", debris_material: "Metallic", debris_desc: "Resting on member", elevation: -35, clock_raw: "12" }],
            target
        );
        const flags = items.map(i => i.flag);
        const relevantElevs = resolveRelevantElevations(items.map(i => i.record), target, flags);
        const axis = chooseElevationAxis(target);

        const elevBox = { x: 10, y: 80, w: 93.5, h: 74 };
        const planBox = { x: 106.5, y: 80, w: 93.5, h: 74 };
        const detailBox = { x: 10, y: 157, w: 190, h: 38 };

        drawPanelTitle(doc, elevBox, "DEBRIS LOCATION - 3D FACE VIEW", false, {
            region: "SKA",
            field: "Betty",
            structure: "BEP-A",
            subtitle: resolveFaceSubtitle(target, contextMembers, axis)
        });
        drawElevationView(doc, elevBox, contextMembers, target, flags, axis, relevantElevs, contextMembers);

        drawPanelTitle(doc, planBox, "DEBRIS LOCATION - 3D FRAMING PLAN", false, {
            region: "SKA",
            field: "Betty",
            structure: "BEP-A",
            subtitle: "ELEVATION (-)35.000 m"
        });
        drawPlanView(doc, planBox, contextMembers, target, flags, relevantElevs, contextMembers);

        drawPanelTitle(doc, detailBox, "MEMBER DETAIL - FLAG LOCATIONS ALONG MEMBER AND AROUND ITS CIRCUMFERENCE", false);
        drawMemberDetail(doc, detailBox, target, flags);
        drawFlagLegend(doc, 10, 199.5);

        expect(doc.getNumberOfPages()).toBe(1);
    });
});

