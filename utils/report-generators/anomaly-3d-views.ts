import { jsPDF } from "jspdf";
import {
    SketchHeaderMeta,
    SketchMember,
    chooseElevationAxis,
    drawElevationView,
    drawPanelTitle,
    drawPlanView,
    formatElev3D,
    isAnodeMember,
    isPointMember,
    isWeldMember,
    memberLength,
    resolveFaceSubtitle
} from "./member-sketch";
import { buildDebrisItems, fetchStructureMembers, resolveRelevantElevations } from "./debris-location-report";

/**
 * 3D Face View + 3D Framing Plan for the Defect / Anomaly report.
 * Re-uses exactly the same renderers as the Debris Location report so both reports look identical.
 */

type StructureMember = SketchMember & { compId: number | null; isFoundation?: boolean };

export interface Anomaly3DContext {
    members: StructureMember[];
}

export interface Anomaly3DPrepared {
    member: SketchMember;
    contextMembers: SketchMember[];
    allMembers: SketchMember[];
    flags: ReturnType<typeof buildDebrisItems>[number]["flag"][];
    relevantElevs: number[];
}

export interface Anomaly3DBox {
    x: number;
    y: number;
    w: number;
    h: number;
}

/** Height (mm) of the two side-by-side panels */
export const ANOMALY_3D_PANEL_H = 74;
const PANEL_GAP = 3;

/** Loads the 3D geometry of a structure (null when the structure has no 3D model) */
export const loadAnomaly3DContext = async (structureId: string | number | undefined | null): Promise<Anomaly3DContext | null> => {
    if (!structureId || String(structureId) === "0") return null;
    const members = await fetchStructureMembers(structureId);
    if (!members || members.length === 0) return null;
    return { members };
};

const normaliseElevation = (raw: any): number | null => {
    if (raw === null || raw === undefined || String(raw).trim() === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
};

const parseInspectionData = (record: any): any => {
    const raw = record?.inspection_data;
    if (!raw) return {};
    if (typeof raw === "string") {
        try { return JSON.parse(raw); } catch { return {}; }
    }
    return raw;
};

const firstFilled = (...vals: any[]) => vals.find(v => v !== undefined && v !== null && String(v).trim() !== "");

/**
 * Locates the anomaly's component in the 3D model and builds the (single) location flag.
 * Returns null when the component is not in the 3D model, in which case no 3D section is printed.
 * Members are cloned so highlighting never leaks from one anomaly page to the next.
 */
export const prepareAnomaly3D = (ctx: Anomaly3DContext | null, record: any): Anomaly3DPrepared | null => {
    if (!ctx || !record) return null;

    const clones: StructureMember[] = ctx.members.map(m => ({ ...m }));
    const byCompId = new Map<number, StructureMember>();
    const byQid = new Map<string, StructureMember>();
    clones.forEach(m => {
        if (m.compId && !byCompId.has(m.compId)) byCompId.set(m.compId, m);
        else if (m.compId && memberLength(byCompId.get(m.compId)!) < 0.05 && memberLength(m) >= 0.05) byCompId.set(m.compId, m);
        const key = m.qid.toUpperCase();
        if (key && !m.isFoundation && !byQid.has(key)) byQid.set(key, m);
    });

    const compId = Number(record.component_id);
    const qid = String(record.component_qid || "").trim();
    const member =
        (Number.isFinite(compId) && compId > 0 ? byCompId.get(compId) : undefined) ||
        (qid ? byQid.get(qid.toUpperCase()) : undefined) ||
        null;
    if (!member) return null;

    // The component carrying this anomaly is the red target of both views
    member.hasAnomaly = true;

    const d = parseInspectionData(record);
    const locationRecord = {
        elevation: normaliseElevation(record.elevation ?? d.elevation),
        clock_raw: firstFilled(d.clock_position, d.clock_pos, d.o_clock, d.clock, record.clock_position, record.clock_pos) ?? null,
        face: d.face || "",
        component_qid: member.qid || qid
    };
    const flags = buildDebrisItems([locationRecord], member).map(i => i.flag);
    const relevantElevs = resolveRelevantElevations([locationRecord], member, flags);

    const contextMembers: SketchMember[] = clones
        .filter(m => !isPointMember(m) || isAnodeMember(m) || isWeldMember(m))
        .slice(0, 5000);

    return { member, contextMembers, allMembers: clones, flags, relevantElevs };
};

/**
 * Draws the 3D Face View (left) and 3D Framing Plan (right) inside `box` (box.h should be ANOMALY_3D_PANEL_H).
 */
export const drawAnomaly3DViews = (
    doc: jsPDF,
    prepared: Anomaly3DPrepared,
    box: Anomaly3DBox,
    opts: {
        isPrintFriendly: boolean;
        isFindingsReport?: boolean;
        meta: SketchHeaderMeta;
    }
) => {
    const { member, contextMembers, allMembers, flags, relevantElevs } = prepared;
    const halfW = (box.w - PANEL_GAP) / 2;
    const elevBox = { x: box.x, y: box.y, w: halfW, h: box.h };
    const planBox = { x: box.x + halfW + PANEL_GAP, y: box.y, w: halfW, h: box.h };
    const label = opts.isFindingsReport ? "FINDINGS LOCATION" : "ANOMALY LOCATION";

    const axis = chooseElevationAxis(member);
    const faceSubtitle = resolveFaceSubtitle(member, contextMembers, axis);
    const planElevSubtitle = relevantElevs.length > 0
        ? `ELEVATION ${relevantElevs.map(e => formatElev3D(e)).join(", ")}`
        : `ELEVATION ${formatElev3D((member.start[1] + member.end[1]) / 2)}`;

    drawPanelTitle(doc, elevBox, `${label} - 3D FACE VIEW`, opts.isPrintFriendly, { ...opts.meta, subtitle: faceSubtitle });
    drawElevationView(doc, elevBox, contextMembers, member, flags, axis, relevantElevs, allMembers);

    drawPanelTitle(doc, planBox, `${label} - 3D FRAMING PLAN`, opts.isPrintFriendly, { ...opts.meta, subtitle: planElevSubtitle });
    drawPlanView(doc, planBox, contextMembers, member, flags, relevantElevs, allMembers);

    // Redraw outer panel borders so content never hides them
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.12);
    doc.rect(elevBox.x, elevBox.y, elevBox.w, elevBox.h);
    doc.rect(planBox.x, planBox.y, planBox.w, planBox.h);

    // Leave the document in a neutral state for whatever is drawn next
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.1);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
};

