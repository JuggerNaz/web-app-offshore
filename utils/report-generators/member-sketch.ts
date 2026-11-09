/**
 * member-sketch.ts
 *
 * Reusable vector drawing helpers that plot a structural member (from webapp_3d
 * start/end coordinates) and flag inspection findings on it, using jsPDF only.
 *
 * Coordinate convention (matches the 3D viewer): x / z are horizontal, y is
 * vertical (y = elevation in metres, MSL = 0).
 *
 * Views:
 *  - Elevation view (3D Face View)   : horizontal axis = x or z, vertical axis = y
 *  - Plan view (3D Framing Plan)     : horizontal axis = x, page-down axis = z (looking down)
 *  - Member detail                   : the member "unrolled" along its own axis, plus a clock
 *                                      cross-section showing the circumferential position
 */
import type { jsPDF } from "jspdf";

export type Vec3 = [number, number, number];
export type RGB = [number, number, number];

export interface SketchMember {
    qid: string;
    code?: string;
    start: Vec3;
    end: Vec3;
    sNode?: string;
    fNode?: string;
    sLeg?: string;
    fLeg?: string;
    face?: string;
    isFoundation?: boolean;
    compId?: number | null;
    associatedCompId?: number | null;
    hasAnomaly?: boolean;
    anomalyLabel?: string;
    clkPos?: string | number | null;
    dist?: number | null;
    elv1?: number | null;
    elv2?: number | null;
    thickness?: number | null;
}

export type MaterialClass = "metallic" | "non-metallic" | "unknown";

export interface DebrisFlag {
    /** Number printed inside the marker (1-based) */
    n: number;
    /** Position along the member, 0 = start node, 1 = end node */
    t: number;
    /** Clock angle in degrees. 0 = 12 o'clock (top), 90 = 3 o'clock, 180 = 6 o'clock */
    clockDeg: number;
    material: MaterialClass;
    /** Filled marker = touching / in contact with the member */
    touching: boolean;
    hazardous: boolean;
    /** True when position along / around the member was assumed (dashed outline) */
    approx: boolean;
    /** Optional callout tag text for 3D Face / Framing Plan views */
    label?: string;
}

export interface Box {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface SketchHeaderMeta {
    region?: string;
    field?: string;
    structure?: string;
    subtitle?: string;
}

export const FLAG_COLORS: Record<MaterialClass, RGB> = {
    metallic: [220, 38, 38],
    "non-metallic": [245, 158, 11],
    unknown: [100, 116, 139]
};

const BRAND: RGB = [7, 78, 136];
const HEADER_NAVY: RGB = [10, 48, 108];
const HEADER_BLUE: RGB = [18, 74, 150];
const GRID: RGB = [200, 200, 200];
const NODE_BORDER_BLUE: RGB = [59, 115, 185];
const LEG_BADGE_GREY: RGB = [112, 116, 124];
const CALLOUT_RED: RGB = [225, 24, 24];

// ---------------------------------------------------------------- geometry --

export const toNum = (v: any, fallback = 0): number => {
    const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
    return Number.isFinite(n) ? n : fallback;
};

export const memberLength = (m: SketchMember): number =>
    Math.sqrt(
        (m.end[0] - m.start[0]) ** 2 +
        (m.end[1] - m.start[1]) ** 2 +
        (m.end[2] - m.start[2]) ** 2
    );

export const isPointMember = (m: SketchMember): boolean => memberLength(m) < 0.05;

/** A member is "horizontal" when its vertical change is small relative to its length */
export const isHorizontalMember = (m: SketchMember): boolean => {
    const len = memberLength(m);
    return len > 0 && Math.abs(m.end[1] - m.start[1]) < Math.max(0.05, len * 0.02);
};

export const isVerticalMember = (m: SketchMember): boolean => {
    const len = memberLength(m);
    if (len <= 0) return false;
    const horiz = Math.sqrt((m.end[0] - m.start[0]) ** 2 + (m.end[2] - m.start[2]) ** 2);
    return horiz < Math.max(0.05, len * 0.02);
};

/** True for vertical or battered columns/pipes (legs, piles, risers, conductors, caissons) */
export const isColumnOrPipeMember = (m: SketchMember): boolean => {
    const vert = Math.abs(m.end[1] - m.start[1]);
    if (vert < 1.0) return false;
    const horiz = Math.hypot(m.end[0] - m.start[0], m.end[2] - m.start[2]);
    const code = (m.code || "").toUpperCase();
    const qid = (m.qid || "").toUpperCase();
    if (["LG", "LEG", "PL", "PILE", "RS", "CS", "CA", "CD", "CON", "JT", "IT"].includes(code)) return true;
    if (/^(LG|LEG|PL|PILE|RS|RISER|CS|CAIS|CD|COND|JT|IT)\b/.test(qid)) return true;
    return horiz / vert < 0.3;
};

export const isLegMember = (m: SketchMember): boolean => {
    const code = (m.code || "").toUpperCase();
    const qid = (m.qid || "").toUpperCase();
    return code === "LG" || code === "LEG" || /^(LG|LEG)\b/.test(qid);
};

export const isAnodeMember = (m: SketchMember): boolean => {
    const code = (m.code || "").toUpperCase();
    const qid = (m.qid || "").trim().toUpperCase();
    return code === "AN" || code.includes("ANOD") || /^(AN|BAN|ANODE)\b/.test(qid);
};

export const isWeldMember = (m: SketchMember): boolean => {
    const code = (m.code || "").toUpperCase();
    const qid = (m.qid || "").trim().toUpperCase();
    return ["WN", "WP", "ND"].includes(code) || /^(WN|WP|ND|NODE)\b/.test(qid);
};

export const isHomMember = (m: SketchMember): boolean => {
    const code = (m.code || "").toUpperCase();
    const qid = (m.qid || "").trim().toUpperCase();
    return ["HM", "HOM"].includes(code) || /^(HM|HOM)\b/.test(qid);
};

/** True for non-structural internal appurtenances that shouldn't clutter the primary jacket framing sketch */
const isAppurtenanceMember = (m: SketchMember): boolean => {
    const code = (m.code || "").toUpperCase();
    const qid = (m.qid || "").toUpperCase();
    if (["RS", "CS", "CA", "CD", "CON", "JT", "IT", "AN", "CL", "WP", "WN", "ND"].includes(code)) return true;
    if (/^(RS|RISER|CS|CAIS|CD|COND|JT|IT|AN|BAN|ANODE|WN|WP|ND)\b/.test(qid)) return true;
    return false;
};

export const cleanNodeLabel = (raw?: string): string => {
    if (!raw) return "";
    let s = String(raw).trim();
    if (!s || /^(none|n\/a|na|null|-|leg|lg|hm|hom|vdm|hdm|fa|sd)$/i.test(s)) return "";
    s = s.replace(/^(?:WN|WP|NODE|ND)\s*[-_]?\s*/i, "").replace(/_[A-Z0-9]+$/i, "").trim();
    if (!s || /^(none|n\/a|na|null|-)$/i.test(s)) return "";
    return s.toUpperCase();
};

const normalizeNodeToken = (raw?: string): string => {
    const c = cleanNodeLabel(raw);
    if (!c) return "";
    return c.replace(/^N(?=\d)/i, "").toUpperCase();
};

export const formatWeldNodeLabel = (raw?: string): string => {
    // Node labels are shown as the bare node number, e.g. "378" (no "WN N" prefix)
    const cleaned = cleanNodeLabel(raw);
    if (!cleaned) return "";
    return cleaned.replace(/^N(?=\d)/i, "");
};

export const cleanLegLabel = (raw?: string): string => {
    if (!raw) return "";
    let s = String(raw).trim();
    if (!s || /^(none|n\/a|na|null|-)$/i.test(s)) return "";
    s = s.replace(/^(?:LEG|LG)[\s\-_]+/i, "").trim().toUpperCase();
    if (!/^[A-Z]{1,3}\d{0,2}$|^\d{1,2}[A-Z]{1,2}$/.test(s)) return "";
    return s;
};

/** Format elevation as e.g. "(+)3.000 m" or "(-)35.000 m" */
export const formatElev3D = (el: number): string => {
    const sign = el < -1e-4 ? "(-)" : "(+)";
    return `${sign}${Math.abs(el).toFixed(3)} m`;
};

const distPointToSegment3D = (p: Vec3, a: Vec3, b: Vec3): { dist: number; t: number; closest: Vec3 } => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    const lenSq = dx * dx + dy * dy + dz * dz;
    if (lenSq < 1e-8) {
        return { dist: Math.hypot(p[0] - a[0], p[1] - a[1], p[2] - a[2]), t: 0.5, closest: a };
    }
    const rawT = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy + (p[2] - a[2]) * dz) / lenSq;
    const t = Math.max(0, Math.min(1, rawT));
    const closest: Vec3 = [a[0] + dx * t, a[1] + dy * t, a[2] + dz * t];
    const dist = Math.hypot(p[0] - closest[0], p[1] - closest[1], p[2] - closest[2]);
    return { dist, t, closest };
};

/**
 * Finds the host/parent structural member for an anode (`AN`) or node weld (`WN`)
 * using `associatedCompId`, matching `(sNode, fNode)` span, single-node endpoint match,
 * or 3D proximity to a structural member segment.
 */
export const findHostStructuralMember = (
    comp: SketchMember,
    structuralMembers: SketchMember[],
    maxDist = 1.6
): SketchMember | null => {
    if (structuralMembers.length === 0) return null;

    // 1. Direct associatedCompId match
    if (comp.associatedCompId) {
        const byId = structuralMembers.find(m => m.compId && m.compId === comp.associatedCompId);
        if (byId) return byId;
    }

    // 2. Span node pair match (sNode + fNode)
    const cS = normalizeNodeToken(comp.sNode);
    const cF = normalizeNodeToken(comp.fNode);
    if (cS && cF && cS !== cF) {
        const bySpan = structuralMembers.find(m => {
            const mS = normalizeNodeToken(m.sNode);
            const mF = normalizeNodeToken(m.fNode);
            return (mS === cS && mF === cF) || (mS === cF && mF === cS);
        });
        if (bySpan) return bySpan;
    }

    // 3. Single node match for a weld (`WN N347`)
    if (isWeldMember(comp) && (cS || cF)) {
        const nodeTok = cS || cF;
        const candidates = structuralMembers.filter(m => {
            const mS = normalizeNodeToken(m.sNode);
            const mF = normalizeNodeToken(m.fNode);
            return mS === nodeTok || mF === nodeTok;
        });
        if (candidates.length > 0) {
            // Prefer non-leg framing member (e.g. HOM) at that node
            return candidates.find(m => !isLegMember(m)) || candidates[0];
        }
    }

    // 4. 3D geometric proximity to a structural segment
    const mid: Vec3 = [
        (comp.start[0] + comp.end[0]) / 2,
        (comp.start[1] + comp.end[1]) / 2,
        (comp.start[2] + comp.end[2]) / 2
    ];
    const isZero = Math.abs(mid[0]) < 1e-4 && Math.abs(mid[1]) < 1e-4 && Math.abs(mid[2]) < 1e-4;
    if (!isZero) {
        let best: SketchMember | null = null;
        let bestD = maxDist;
        for (const m of structuralMembers) {
            if (isPointMember(m)) continue;
            const { dist } = distPointToSegment3D(mid, m.start, m.end);
            if (dist <= bestD) {
                bestD = dist;
                best = m;
            }
        }
        if (best) return best;
    }

    return null;
};

/**
 * Resolves 3D start/end coordinates for attached anodes (`AN`) and node welds (`WN`)
 * along their host structural members and propagates anomaly flags to host members.
 */
const resolveAndAttachAnodesAndWelds = (
    structuralMembers: SketchMember[],
    candidates: SketchMember[],
    checkInView: (m: SketchMember, host: SketchMember | null) => boolean
): SketchMember[] => {
    const matchedByHost = new Map<SketchMember, SketchMember[]>();
    const standalone: { comp: SketchMember; host: SketchMember | null }[] = [];
    const seenQids = new Set<string>();

    for (const c of candidates) {
        if (!isAnodeMember(c) && !isWeldMember(c)) continue;
        const qKey = `${(c.code || "").toUpperCase()}:${(c.qid || "").toUpperCase()}`;
        if (qKey !== ":" && seenQids.has(qKey)) continue;

        const host = findHostStructuralMember(c, structuralMembers);
        if (!checkInView(c, host)) continue;

        if (qKey !== ":") seenQids.add(qKey);

        if (c.hasAnomaly && host) {
            host.hasAnomaly = true;
            if (!host.anomalyLabel && (c.anomalyLabel || c.qid)) {
                host.anomalyLabel = c.anomalyLabel || c.qid;
            }
        }

        const mid: Vec3 = [
            (c.start[0] + c.end[0]) / 2,
            (c.start[1] + c.end[1]) / 2,
            (c.start[2] + c.end[2]) / 2
        ];
        const isZero = Math.abs(mid[0]) < 1e-4 && Math.abs(mid[1]) < 1e-4 && Math.abs(mid[2]) < 1e-4;
        if (isAnodeMember(c) && host && (isZero || isPointMember(c))) {
            if (!matchedByHost.has(host)) matchedByHost.set(host, []);
            matchedByHost.get(host)!.push(c);
        } else {
            standalone.push({ comp: c, host });
        }
    }

    const resolved: SketchMember[] = [];

    // Space attached anodes along their host member and orient along host axis
    matchedByHost.forEach((anodes, host) => {
        anodes.sort((a, b) => (a.qid || "").localeCompare(b.qid || "", undefined, { numeric: true }));
        const dx = host.end[0] - host.start[0];
        const dy = host.end[1] - host.start[1];
        const dz = host.end[2] - host.start[2];
        const len = Math.hypot(dx, dy, dz) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const uz = dz / len;
        const count = anodes.length;

        anodes.forEach((an, idx) => {
            const mid: Vec3 = [
                (an.start[0] + an.end[0]) / 2,
                (an.start[1] + an.end[1]) / 2,
                (an.start[2] + an.end[2]) / 2
            ];
            const isZero = Math.abs(mid[0]) < 1e-4 && Math.abs(mid[1]) < 1e-4 && Math.abs(mid[2]) < 1e-4;
            const { dist, closest } = distPointToSegment3D(mid, host.start, host.end);
            const t = (idx + 1) / (count + 1);
            const center: Vec3 = !isZero && dist < 1.2 ? closest : lerp3(host.start, host.end, t);
            const halfSpan = Math.min(0.35, len * 0.15);
            resolved.push({
                ...an,
                start: [center[0] - ux * halfSpan, center[1] - uy * halfSpan, center[2] - uz * halfSpan],
                end: [center[0] + ux * halfSpan, center[1] + uy * halfSpan, center[2] + uz * halfSpan]
            });
        });
    });

    standalone.forEach(({ comp, host }) => {
        if (host && !isPointMember(host)) {
            const dx = host.end[0] - host.start[0];
            const dy = host.end[1] - host.start[1];
            const dz = host.end[2] - host.start[2];
            const len = Math.hypot(dx, dy, dz) || 1;
            const ux = dx / len;
            const uy = dy / len;
            const uz = dz / len;

            let center: Vec3 = [
                (comp.start[0] + comp.end[0]) / 2,
                (comp.start[1] + comp.end[1]) / 2,
                (comp.start[2] + comp.end[2]) / 2
            ];
            const isZero = Math.abs(center[0]) < 1e-4 && Math.abs(center[1]) < 1e-4 && Math.abs(center[2]) < 1e-4;
            if (isZero) {
                const cTok = normalizeNodeToken(comp.sNode || comp.fNode || comp.qid);
                if (cTok && normalizeNodeToken(host.sNode) === cTok) center = [...host.start] as Vec3;
                else if (cTok && normalizeNodeToken(host.fNode) === cTok) center = [...host.end] as Vec3;
                else center = lerp3(host.start, host.end, 0.5);
            } else if (isWeldMember(comp)) {
                const cTok = normalizeNodeToken(comp.sNode || comp.fNode || comp.qid);
                if (cTok && normalizeNodeToken(host.sNode) === cTok) {
                    // Offset slightly inward from node so weld collar on member is visible next to leg/joint
                    const inset = Math.min(0.65, len * 0.14);
                    center = [host.start[0] + ux * inset, host.start[1] + uy * inset, host.start[2] + uz * inset];
                } else if (cTok && normalizeNodeToken(host.fNode) === cTok) {
                    const inset = Math.min(0.65, len * 0.14);
                    center = [host.end[0] - ux * inset, host.end[1] - uy * inset, host.end[2] - uz * inset];
                }
            }

            const halfSpan = isAnodeMember(comp) ? 0.35 : 0.15;
            resolved.push({
                ...comp,
                start: [center[0] - ux * halfSpan, center[1] - uy * halfSpan, center[2] - uz * halfSpan],
                end: [center[0] + ux * halfSpan, center[1] + uy * halfSpan, center[2] + uz * halfSpan]
            });
        } else {
            resolved.push(comp);
        }
    });

    return resolved;
};

const extractDistinctFramingElevations = (horizontals: SketchMember[], clusterTol = 1.2): number[] => {
    const rawYs = horizontals
        .map(m => (m.start[1] + m.end[1]) / 2)
        .filter(y => Number.isFinite(y))
        .sort((a, b) => b - a); // descending (top to bottom)

    const clusters: { sum: number; count: number; avg: number }[] = [];
    for (const y of rawYs) {
        const found = clusters.find(c => Math.abs(c.avg - y) <= clusterTol);
        if (found) {
            found.sum += y;
            found.count += 1;
            found.avg = found.sum / found.count;
        } else {
            clusters.push({ sum: y, count: 1, avg: y });
        }
    }
    return clusters.map(c => Math.round(c.avg * 1000) / 1000).sort((a, b) => b - a);
};

const resolveActiveFramingElevs = (
    horizontals: SketchMember[],
    validElevs: number[],
    tolerance = 1.5
): number[] => {
    const activeFramingElevs: number[] = [];
    for (const elv of validElevs) {
        const directMatches = horizontals.filter(
            m => Math.abs(m.start[1] - elv) <= tolerance && Math.abs(m.end[1] - elv) <= tolerance
        );
        if (directMatches.length > 0) {
            const avgY = directMatches.reduce((acc, m) => acc + (m.start[1] + m.end[1]) / 2, 0) / directMatches.length;
            activeFramingElevs.push(Math.round(avgY * 100) / 100);
        } else if (horizontals.length > 0) {
            let bestY = (horizontals[0].start[1] + horizontals[0].end[1]) / 2;
            let bestDist = Math.abs(bestY - elv);
            for (const m of horizontals) {
                const y = (m.start[1] + m.end[1]) / 2;
                const d = Math.abs(y - elv);
                if (d < bestDist) {
                    bestDist = d;
                    bestY = y;
                }
            }
            activeFramingElevs.push(Math.round(bestY * 100) / 100);
        } else {
            activeFramingElevs.push(elv);
        }
    }
    return activeFramingElevs;
};

/**
 * Filters 3D structure context members down to the relevant elevation(s) for a Plan View:
 *  - Keeps only horizontal framing members & plan braces at the target elevation(s) (within tolerance).
 *    If no horizontal framing exists right at a mid-bay elevation, snaps to the nearest
 *    horizontal framing elevation so the plan view still shows a single relevant level.
 *  - Slices vertical/battered legs at the target elevation(s) so they render as
 *    3D corner leg cans at that elevation rather than full-height batter lines.
 *  - Includes anodes (`AN`) and node welds (`WN`) attached to the plan framing or at the active elevation.
 */
export const filterPlanContextForElevations = (
    context: SketchMember[],
    elevations: number[],
    tolerance = 1.5,
    extraComponents?: SketchMember[]
): SketchMember[] => {
    const validElevs = elevations.filter(e => Number.isFinite(e));
    if (validElevs.length === 0) return context;

    const structuralHorizontals = context.filter(
        m => !isPointMember(m) && !isAppurtenanceMember(m) && Math.abs(m.start[1] - m.end[1]) < 1.0
    );
    const fallbackHorizontals = structuralHorizontals.length > 0
        ? structuralHorizontals
        : context.filter(m => !isPointMember(m) && !isAnodeMember(m) && !isWeldMember(m) && Math.abs(m.start[1] - m.end[1]) < 1.0);

    const activeFramingElevs = resolveActiveFramingElevs(fallbackHorizontals, validElevs, tolerance);

    const out: SketchMember[] = [];

    // 1. Horizontal perimeter & plan X-brace members at the relevant elevation(s)
    for (const m of fallbackHorizontals) {
        const matches = activeFramingElevs.some(
            elv => Math.abs(m.start[1] - elv) <= tolerance && Math.abs(m.end[1] - elv) <= tolerance
        );
        if (matches) out.push({ ...m });
    }

    // 2. Cross-sections of vertical / battered legs at the relevant elevation(s)
    const columnCandidates = context.filter(m => isLegMember(m));
    const colsToUse = columnCandidates.length > 0 ? columnCandidates : context.filter(m => isColumnOrPipeMember(m));

    for (const m of colsToUse) {
        const minY = Math.min(m.start[1], m.end[1]);
        const maxY = Math.max(m.start[1], m.end[1]);
        const dy = m.end[1] - m.start[1];
        const legLbl = cleanLegLabel(m.sLeg || m.fLeg || (isLegMember(m) ? m.qid : ""));
        const sliceElevs = activeFramingElevs.length > 0 ? activeFramingElevs : validElevs;
        for (const elv of sliceElevs) {
            if (elv < minY - 2.0 || elv > maxY + 2.0) continue;
            const t = Math.abs(dy) > 1e-6 ? Math.min(1, Math.max(0, (elv - m.start[1]) / dy)) : 0.5;
            const pt = lerp3(m.start, m.end, t);
            out.push({
                ...m,
                qid: m.qid,
                code: m.code,
                start: [pt[0], elv - 0.1, pt[2]],
                end: [pt[0], elv + 0.1, pt[2]],
                sLeg: legLbl || m.sLeg,
                fLeg: legLbl || m.fLeg,
                isFoundation: m.isFoundation
            });
        }
    }

    // 3. Include Anodes (AN) and Node Welds (WN) on this framing level
    const allCandidates = extraComponents ? [...context, ...extraComponents] : context;
    const framingOnly = out.filter(m => !isLegMember(m) && !isColumnOrPipeMember(m));
    const attachedItems = resolveAndAttachAnodesAndWelds(
        framingOnly,
        allCandidates,
        (c, host) => {
            if (host) return true;
            const midY = (c.start[1] + c.end[1]) / 2;
            const isZero = Math.abs(c.start[0]) < 1e-4 && Math.abs(c.start[1]) < 1e-4 && Math.abs(c.start[2]) < 1e-4;
            if (!isZero && activeFramingElevs.some(elv => Math.abs(midY - elv) <= tolerance)) {
                return true;
            }
            if (c.elv1 !== undefined && c.elv1 !== null && activeFramingElevs.some(elv => Math.abs(Number(c.elv1) - elv) <= tolerance)) {
                return !isZero;
            }
            return false;
        }
    );
    out.push(...attachedItems);

    return out;
};

/**
 * Filters 3D structure context members to the target member's jacket face plane
 * and multi-bay elevation window for the 3D Face View (Elevation View):
 *  - Filters to the target member's row/face plane along the depth axis so front/back rows don't overlap.
 *  - Includes horizontal framing levels AND diagonal/K/X braces on that face so the truss bay structure
 *    matches the 3D Face View.
 *  - Clips vertical/battered legs to the displayed bay window.
 *  - Includes anodes (`AN`) and node welds (`WN`) on the active face & elevation window.
 */
export const filterElevationContextForElevations = (
    context: SketchMember[],
    target: SketchMember,
    elevations: number[],
    axis: "x" | "z",
    tolerance = 1.5,
    extraComponents?: SketchMember[]
): { members: SketchMember[]; activeElevs: number[]; clipMinY: number; clipMaxY: number } => {
    const validElevs = elevations.filter(e => Number.isFinite(e));
    const perpIdx = axis === "x" ? 2 : 0; // depth coordinate perpendicular to elevation view plane
    const targetDepthSpan = Math.abs(target.start[perpIdx] - target.end[perpIdx]);
    const targetDepth = (target.start[perpIdx] + target.end[perpIdx]) / 2;
    const depthTol = 4.2;
    let activePlaneDepth = targetDepth;

    // Prefer members on the same face/row depth plane as the target member
    let planeContext = context.filter(m => !isPointMember(m));
    if (targetDepthSpan < depthTol) {
        const onPlane = planeContext.filter(
            m => Math.abs(m.start[perpIdx] - targetDepth) <= depthTol && Math.abs(m.end[perpIdx] - targetDepth) <= depthTol
        );
        const hasLegsOnPlane = onPlane.some(m => isLegMember(m));
        if (onPlane.length > 0 && hasLegsOnPlane) {
            planeContext = onPlane;
        }
    } else {
        // Target spans across depth (e.g. a plan diagonal or side member): pick the nearest leg face plane
        const legs = planeContext.filter(m => isLegMember(m));
        if (legs.length > 0) {
            const legDepths = legs.map(l => (l.start[perpIdx] + l.end[perpIdx]) / 2);
            const nearestDepth = legDepths.reduce((best, d) =>
                Math.abs(d - target.start[perpIdx]) < Math.abs(best - target.start[perpIdx]) ? d : best
            , legDepths[0]);
            activePlaneDepth = nearestDepth;
            const onNearestPlane = planeContext.filter(
                m => Math.abs(m.start[perpIdx] - nearestDepth) <= depthTol && Math.abs(m.end[perpIdx] - nearestDepth) <= depthTol
            );
            if (onNearestPlane.length > 0) planeContext = onNearestPlane;
        }
    }

    const structuralPlane = planeContext.filter(m => !isAppurtenanceMember(m));
    const workingPlane = structuralPlane.length > 0 ? structuralPlane : planeContext.filter(m => !isAnodeMember(m) && !isWeldMember(m));

    const horizontals = workingPlane.filter(m => Math.abs(m.start[1] - m.end[1]) < 1.0);
    const allFaceElevs = extractDistinctFramingElevations(horizontals);

    const primaryElevs = validElevs.length > 0
        ? resolveActiveFramingElevs(horizontals, validElevs, tolerance)
        : [Math.round(((target.start[1] + target.end[1]) / 2) * 100) / 100];

    const targetMinY = Math.min(target.start[1], target.end[1], ...primaryElevs);
    const targetMaxY = Math.max(target.start[1], target.end[1], ...primaryElevs);

    // Select a multi-bay window of framing elevations around the target so the face truss looks complete
    let displayElevs: number[] = [];
    if (allFaceElevs.length > 0) {
        if (allFaceElevs.length <= 6) {
            displayElevs = [...allFaceElevs];
        } else {
            // Find indices covering [targetMinY, targetMaxY] and include neighbor framing levels above & below
            let firstIdx = allFaceElevs.findIndex(e => e <= targetMaxY + 1.5);
            if (firstIdx < 0) firstIdx = 0;
            let lastIdx = firstIdx;
            for (let i = firstIdx; i < allFaceElevs.length; i++) {
                if (allFaceElevs[i] >= targetMinY - 1.5) lastIdx = i;
            }
            const startIdx = Math.max(0, firstIdx - 2);
            const endIdx = Math.min(allFaceElevs.length - 1, Math.max(lastIdx + 1, startIdx + 4));
            displayElevs = allFaceElevs.slice(startIdx, endIdx + 1);
        }
    } else {
        displayElevs = primaryElevs;
    }

    const minE = Math.min(...displayElevs, targetMinY);
    const maxE = Math.max(...displayElevs, targetMaxY);
    const bayPad = 2.8;
    const clipMinY = minE - bayPad;
    const clipMaxY = maxE + bayPad;

    const out: SketchMember[] = [];

    // 1. Horizontal & diagonal framing braces within [clipMinY, clipMaxY]
    for (const m of workingPlane) {
        if (isColumnOrPipeMember(m)) continue;
        const mMinY = Math.min(m.start[1], m.end[1]);
        const mMaxY = Math.max(m.start[1], m.end[1]);
        if (mMinY >= clipMinY - tolerance && mMaxY <= clipMaxY + tolerance) {
            out.push({ ...m });
        }
    }

    // 2. Vertical / battered legs clipped to [clipMinY, clipMaxY]
    for (const m of workingPlane) {
        if (!isColumnOrPipeMember(m)) continue;
        const mMinY = Math.min(m.start[1], m.end[1]);
        const mMaxY = Math.max(m.start[1], m.end[1]);
        if (mMaxY < clipMinY || mMinY > clipMaxY) continue;
        const y0 = Math.max(mMinY, clipMinY);
        const y1 = Math.min(mMaxY, clipMaxY);
        if (y1 - y0 < 0.2) continue;
        const dy = m.end[1] - m.start[1];
        const t0 = Math.abs(dy) > 1e-6 ? Math.min(1, Math.max(0, (y0 - m.start[1]) / dy)) : 0;
        const t1 = Math.abs(dy) > 1e-6 ? Math.min(1, Math.max(0, (y1 - m.start[1]) / dy)) : 1;
        const legLbl = cleanLegLabel(m.sLeg || m.fLeg || (isLegMember(m) ? m.qid : ""));
        out.push({
            ...m,
            qid: m.qid,
            code: m.code,
            start: lerp3(m.start, m.end, t0),
            end: lerp3(m.start, m.end, t1),
            sLeg: legLbl || m.sLeg,
            fLeg: legLbl || m.fLeg,
            isFoundation: m.isFoundation
        });
    }

    // 3. Include Anodes (AN) and Node Welds (WN) on this face & elevation window
    const allCandidates = extraComponents ? [...context, ...extraComponents] : context;
    const attachedItems = resolveAndAttachAnodesAndWelds(
        out,
        allCandidates,
        (c, host) => {
            if (host) {
                const hMinY = Math.min(host.start[1], host.end[1]);
                const hMaxY = Math.max(host.start[1], host.end[1]);
                return hMaxY >= clipMinY - tolerance && hMinY <= clipMaxY + tolerance;
            }
            const midY = (c.start[1] + c.end[1]) / 2;
            const midDepth = (c.start[perpIdx] + c.end[perpIdx]) / 2;
            const isZero = Math.abs(c.start[0]) < 1e-4 && Math.abs(c.start[1]) < 1e-4 && Math.abs(c.start[2]) < 1e-4;
            if (!isZero && Math.abs(midDepth - activePlaneDepth) <= depthTol && midY >= clipMinY - tolerance && midY <= clipMaxY + tolerance) {
                return true;
            }
            return false;
        }
    );
    out.push(...attachedItems);

    return { members: out, activeElevs: displayElevs, clipMinY, clipMaxY };
};

export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
];

/** Pick the horizontal axis that shows the target member best in elevation */
export const chooseElevationAxis = (m: SketchMember): "x" | "z" => {
    const dx = Math.abs(m.end[0] - m.start[0]);
    const dz = Math.abs(m.end[2] - m.start[2]);
    return dz > dx ? "z" : "x";
};

type Pt2 = [number, number];

const projectElevation = (p: Vec3, axis: "x" | "z"): Pt2 => [axis === "x" ? p[0] : p[2], p[1]];
const projectPlan = (p: Vec3): Pt2 => [p[0], p[2]];

interface Bounds {
    minU: number;
    maxU: number;
    minV: number;
    maxV: number;
}

const boundsOf = (pts: Pt2[]): Bounds => {
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const [u, v] of pts) {
        if (u < minU) minU = u;
        if (u > maxU) maxU = u;
        if (v < minV) minV = v;
        if (v > maxV) maxV = v;
    }
    if (!Number.isFinite(minU)) return { minU: 0, maxU: 1, minV: 0, maxV: 1 };
    if (maxU - minU < 1) { minU -= 0.5; maxU += 0.5; }
    if (maxV - minV < 1) { minV -= 0.5; maxV += 0.5; }
    return { minU, maxU, minV, maxV };
};

interface View {
    toPage: (u: number, v: number) => Pt2;
    scale: number;
    bounds: Bounds;
    inner: Box;
}

/** Fit bounds into a box with uniform scale, centred. flipV = true for elevation (v up). */
const makeView = (
    box: Box,
    bounds: Bounds,
    flipV: boolean,
    padLeft = 0,
    padRight = 0,
    padTop = 0,
    padBottom = 0
): View => {
    const pad = 3.5;
    const inner: Box = {
        x: box.x + pad + padLeft,
        y: box.y + pad + padTop,
        w: Math.max(10, box.w - pad * 2 - padLeft - padRight),
        h: Math.max(10, box.h - pad * 2 - padTop - padBottom)
    };
    const du = bounds.maxU - bounds.minU;
    const dv = bounds.maxV - bounds.minV;
    const scale = Math.min(inner.w / du, inner.h / dv);
    const offX = inner.x + (inner.w - du * scale) / 2;
    const offY = inner.y + (inner.h - dv * scale) / 2;
    const toPage = (u: number, v: number): Pt2 => {
        const px = offX + (u - bounds.minU) * scale;
        const py = flipV
            ? offY + (bounds.maxV - v) * scale
            : offY + (v - bounds.minV) * scale;
        return [px, py];
    };
    return { toPage, scale, bounds, inner };
};

const niceStep = (range: number, targetTicks = 6): number => {
    const raw = range / targetTicks;
    const pow = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    const f = raw / pow;
    const nice = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10;
    return nice * pow;
};

// ----------------------------------------------------------------- drawing --

/**
 * Draws the panel header bar.
 * When `meta` is provided (for 3D Face View / 3D Framing Plan), renders the two-line dark-blue
 * banner with title + subtitle on the left and Region / Field / Structure metadata on the right.
 */
export const drawPanelTitle = (
    doc: jsPDF,
    box: Box,
    title: string,
    printFriendly: boolean,
    meta?: SketchHeaderMeta
) => {
    const hasTwoLines = Boolean(meta?.subtitle || meta?.region || meta?.field || meta?.structure);
    const h = hasTwoLines ? 8.2 : 5.2;

    doc.setDrawColor(...GRID);
    doc.setLineWidth(0.1);
    if (printFriendly) {
        doc.setFillColor(238, 242, 247);
        doc.rect(box.x, box.y, box.w, h, "FD");
    } else {
        doc.setFillColor(...HEADER_NAVY);
        doc.rect(box.x, box.y, box.w, h, "F");
        // Subtle lighter blue top accent band for the 3D banner look
        doc.setFillColor(...HEADER_BLUE);
        doc.rect(box.x, box.y, box.w, h * 0.48, "F");
    }

    const primaryTextColor: RGB = printFriendly ? BRAND : [255, 255, 255];
    const secondaryTextColor: RGB = printFriendly ? [51, 65, 85] : [224, 238, 255];

    if (hasTwoLines) {
        // Main Title (Top-Left)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.2);
        doc.setTextColor(...primaryTextColor);
        doc.text(title, box.x + 2.2, box.y + 3.4);

        // Subtitle (Bottom-Left: e.g. "FACE A1-B1" or "ELEVATION (-)35.000 m")
        if (meta?.subtitle) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(4.9);
            doc.setTextColor(...secondaryTextColor);
            doc.text(meta.subtitle, box.x + 2.2, box.y + 6.7);
        }

        // Metadata (Right-aligned: Region / Field / Structure)
        const metaParts: string[] = [];
        if (meta?.region) metaParts.push(`Region : ${meta.region}`);
        if (meta?.field) metaParts.push(`Field : ${meta.field}`);
        if (meta?.structure) metaParts.push(`Structure : ${meta.structure}`);
        if (metaParts.length > 0) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(4.5);
            doc.setTextColor(...primaryTextColor);
            doc.text(metaParts.join("   "), box.x + box.w - 2.2, box.y + 6.6, { align: "right" });
        }
    } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.8);
        doc.setTextColor(...primaryTextColor);
        doc.text(title, box.x + 2.2, box.y + 3.6);
    }

    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(...GRID);
    doc.setLineWidth(0.12);
    doc.rect(box.x, box.y, box.w, box.h);
};

/**
 * Renders a 3D-shaded cylindrical tube between (x1, y1) and (x2, y2) using layered strokes
 * to simulate metallic silver, anomaly-highlighted amber-orange, or target bright red 3D tubular pipes.
 */
const drawShadedTube = (
    doc: jsPDF,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    radiusMm: number,
    variant: "silver" | "red" | "amber"
) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 0.05) return;

    // Perpendicular unit vector oriented toward upper-left light source
    let nx = -dy / len;
    let ny = dx / len;
    if (nx + ny > 0) {
        nx = -nx;
        ny = -ny;
    }

    const w = radiusMm * 2;
    // Use butt caps so members terminate crisply at nodes and never balloon into oval blobs
    (doc as any).setLineCap("butt");

    if (variant === "silver") {
        // 1. Dark outer shadow edge
        doc.setDrawColor(82, 92, 106);
        doc.setLineWidth(w);
        doc.line(x1, y1, x2, y2);

        // 2. Base metallic grey cylinder
        doc.setDrawColor(138, 148, 160);
        doc.setLineWidth(w * 0.80);
        doc.line(x1, y1, x2, y2);

        // 3. Mid silver body
        const off1 = radiusMm * 0.12;
        doc.setDrawColor(184, 192, 204);
        doc.setLineWidth(w * 0.56);
        doc.line(x1 + nx * off1, y1 + ny * off1, x2 + nx * off1, y2 + ny * off1);

        // 4. Soft sheen band
        const off2 = radiusMm * 0.22;
        doc.setDrawColor(222, 228, 236);
        doc.setLineWidth(w * 0.34);
        doc.line(x1 + nx * off2, y1 + ny * off2, x2 + nx * off2, y2 + ny * off2);

        // 5. Specular highlight core
        const off3 = radiusMm * 0.26;
        doc.setDrawColor(248, 250, 253);
        doc.setLineWidth(w * 0.14);
        doc.line(x1 + nx * off3, y1 + ny * off3, x2 + nx * off3, y2 + ny * off3);
    } else if (variant === "amber") {
        // 1. Dark burnt-orange outer edge
        doc.setDrawColor(164, 58, 8);
        doc.setLineWidth(w);
        doc.line(x1, y1, x2, y2);

        // 2. Rich amber-orange body
        doc.setDrawColor(234, 88, 12);
        doc.setLineWidth(w * 0.82);
        doc.line(x1, y1, x2, y2);

        // 3. Bright orange-amber mid-core
        const off1 = radiusMm * 0.12;
        doc.setDrawColor(249, 115, 22);
        doc.setLineWidth(w * 0.56);
        doc.line(x1 + nx * off1, y1 + ny * off1, x2 + nx * off1, y2 + ny * off1);

        // 4. Warm gold highlight
        const off2 = radiusMm * 0.22;
        doc.setDrawColor(253, 186, 116);
        doc.setLineWidth(w * 0.32);
        doc.line(x1 + nx * off2, y1 + ny * off2, x2 + nx * off2, y2 + ny * off2);

        // 5. Specular pale-gold streak
        const off3 = radiusMm * 0.26;
        doc.setDrawColor(255, 237, 213);
        doc.setLineWidth(w * 0.13);
        doc.line(x1 + nx * off3, y1 + ny * off3, x2 + nx * off3, y2 + ny * off3);
    } else {
        // 1. Dark crimson outer edge
        doc.setDrawColor(148, 14, 14);
        doc.setLineWidth(w);
        doc.line(x1, y1, x2, y2);

        // 2. Rich red body
        doc.setDrawColor(212, 22, 22);
        doc.setLineWidth(w * 0.82);
        doc.line(x1, y1, x2, y2);

        // 3. Bright red mid-core
        const off1 = radiusMm * 0.12;
        doc.setDrawColor(242, 46, 46);
        doc.setLineWidth(w * 0.56);
        doc.line(x1 + nx * off1, y1 + ny * off1, x2 + nx * off1, y2 + ny * off1);

        // 4. Soft coral highlight
        const off2 = radiusMm * 0.22;
        doc.setDrawColor(254, 118, 118);
        doc.setLineWidth(w * 0.32);
        doc.line(x1 + nx * off2, y1 + ny * off2, x2 + nx * off2, y2 + ny * off2);

        // 5. Specular pink-white streak
        const off3 = radiusMm * 0.26;
        doc.setDrawColor(255, 195, 195);
        doc.setLineWidth(w * 0.13);
        doc.line(x1 + nx * off3, y1 + ny * off3, x2 + nx * off3, y2 + ny * off3);
    }

    (doc as any).setLineCap("butt");
};

/**
 * Draws a compact, stepped coaxial Node Weld (`WN` / `WP`) collar ring at (cx, cy) along (ux, uy).
 * Sized with a short axial band (`halfLenMm` ~ 0.55mm) and distinctly wider diameter (`1.68x` pipe radius)
 * plus end-flange rings and a center circumferential weld seam so it is visually distinct from HOM tubes and Anodes.
 */
const drawJointCollar = (
    doc: jsPDF,
    cx: number,
    cy: number,
    ux: number,
    uy: number,
    radiusMm: number,
    halfLenMm = 0.55,
    variant: "silver" | "red" | "amber" = "silver"
) => {
    const collarR = Math.max(radiusMm * 1.65, radiusMm + 0.26);
    const x1 = cx - ux * halfLenMm;
    const y1 = cy - uy * halfLenMm;
    const x2 = cx + ux * halfLenMm;
    const y2 = cy + uy * halfLenMm;

    (doc as any).setLineCap("butt");
    if (variant === "silver") {
        // Distinct dark blue-slate steel collar sleeve
        doc.setDrawColor(45, 62, 88);
        doc.setLineWidth(collarR * 2);
        doc.line(x1, y1, x2, y2);

        doc.setDrawColor(118, 136, 162);
        doc.setLineWidth(collarR * 1.56);
        doc.line(x1, y1, x2, y2);

        doc.setDrawColor(198, 210, 226);
        doc.setLineWidth(collarR * 0.85);
        doc.line(x1, y1, x2, y2);
    } else {
        drawShadedTube(doc, x1, y1, x2, y2, collarR, variant);
    }

    // Perpendicular end-ring flanges + center weld bead seam
    const nx = -uy * collarR;
    const ny = ux * collarR;
    const ringColor: RGB = variant === "red"
        ? [125, 10, 10]
        : variant === "amber"
            ? [146, 48, 6]
            : [35, 50, 74];
    doc.setDrawColor(...ringColor);
    doc.setLineWidth(0.16);
    doc.line(x1 - nx, y1 - ny, x1 + nx, y1 + ny);
    doc.line(x2 - nx, y2 - ny, x2 + nx, y2 + ny);

    // Center circumferential weld bead line
    doc.setDrawColor(...(variant === "silver" ? ([59, 115, 185] as RGB) : ringColor));
    doc.setLineWidth(0.14);
    doc.line(cx - nx * 0.95, cy - ny * 0.95, cx + nx * 0.95, cy + ny * 0.95);
};

/**
 * Draws a sacrificial Standoff Anode (`AN` / `BAN...`) attached to a member at (cx, cy) along (ux, uy).
 * Renders two perpendicular standoff brackets offsetting a rectangular sacrificial anode bar from the pipe wall
 * in bright cyan-zinc (or amber/red when anomalous or targeted) so it is clearly distinguishable from HOM members and node welds.
 */
const drawAnodeSymbol = (
    doc: jsPDF,
    cx: number,
    cy: number,
    ux: number,
    uy: number,
    hostRadiusMm = 0.44,
    variant: "cyan" | "amber" | "red" = "cyan",
    label?: string
) => {
    // Normal pointing toward upper-left / outward from the host member
    let nx = -uy;
    let ny = ux;
    if (nx + ny > 0) {
        nx = -nx;
        ny = -ny;
    }

    const barHalfLen = 1.12;
    const barRadius = 0.30;
    const standoffDist = hostRadiusMm + 0.68;

    // 1. Two perpendicular standoff legs/straps connecting pipe wall to anode bar
    const legOffsets = [-barHalfLen * 0.58, barHalfLen * 0.58];
    const strapColor: RGB = variant === "red"
        ? [153, 27, 27]
        : variant === "amber"
            ? [164, 58, 8]
            : [14, 116, 144];
    doc.setDrawColor(...strapColor);
    doc.setLineWidth(0.22);
    (doc as any).setLineCap("butt");
    legOffsets.forEach(s => {
        const bx = cx + ux * s;
        const by = cy + uy * s;
        doc.line(
            bx + nx * (hostRadiusMm * 0.65),
            by + ny * (hostRadiusMm * 0.65),
            bx + nx * standoffDist,
            by + ny * standoffDist
        );
    });

    // 2. Parallel sacrificial anode bar at standoffDist
    const barCx = cx + nx * standoffDist;
    const barCy = cy + ny * standoffDist;
    const ax1 = barCx - ux * barHalfLen;
    const ay1 = barCy - uy * barHalfLen;
    const ax2 = barCx + ux * barHalfLen;
    const ay2 = barCy + uy * barHalfLen;

    const outerColor: RGB = variant === "red"
        ? [153, 27, 27]
        : variant === "amber"
            ? [164, 58, 8]
            : [3, 105, 161];
    const bodyColor: RGB = variant === "red"
        ? [225, 24, 24]
        : variant === "amber"
            ? [249, 115, 22]
            : [14, 165, 233];
    const coreColor: RGB = variant === "red"
        ? [254, 202, 202]
        : variant === "amber"
            ? [254, 215, 170]
            : [186, 230, 253];

    // Outer border of anode bar
    doc.setDrawColor(...outerColor);
    doc.setLineWidth(barRadius * 2);
    doc.line(ax1, ay1, ax2, ay2);

    // Metallic sacrificial body
    doc.setDrawColor(...bodyColor);
    doc.setLineWidth(barRadius * 1.52);
    doc.line(ax1, ay1, ax2, ay2);

    // Specular core highlight
    doc.setDrawColor(...coreColor);
    doc.setLineWidth(barRadius * 0.72);
    doc.line(ax1, ay1, ax2, ay2);
    // Anode names are not printed on the symbol (keeps the drawing clean);
    // anomalous anodes get a placed callout instead.
};

/**
 * Draws a 3D vertical cylindrical leg can at (cx, cy) for the 3D Framing Plan view.
 */
const drawPlanLegCan = (
    doc: jsPDF,
    cx: number,
    cy: number,
    rMm: number,
    variant: "silver" | "red" | "amber" = "silver"
) => {
    const dropH = rMm * 1.25;
    const ry = rMm * 0.62; // foreshortened ellipse vertical radius

    // 1. Bottom rounded cap of vertical cylinder
    if (variant === "silver") {
        doc.setFillColor(115, 123, 135);
        doc.setDrawColor(80, 88, 100);
    } else if (variant === "amber") {
        doc.setFillColor(194, 65, 12);
        doc.setDrawColor(146, 48, 6);
    } else {
        doc.setFillColor(175, 20, 20);
        doc.setDrawColor(135, 12, 12);
    }
    doc.setLineWidth(0.16);
    doc.ellipse(cx, cy + dropH, rMm, ry, "FD");

    // 2. Vertical cylinder wall with horizontal left-to-right metallic shading bands
    const strips = 9;
    for (let i = 0; i < strips; i++) {
        const f0 = i / strips;
        const f1 = (i + 1) / strips;
        const sx = cx - rMm + f0 * (2 * rMm);
        const sw = (f1 - f0) * (2 * rMm) + 0.08;
        // Highlight peaks around 32% from the left
        const distFromHighlight = Math.abs((f0 + f1) / 2 - 0.32);
        const shade = Math.max(0, 1 - distFromHighlight * 1.75);
        if (variant === "silver") {
            const c = Math.round(108 + shade * 128);
            doc.setFillColor(c, Math.min(255, c + 5), Math.min(255, c + 12));
        } else if (variant === "amber") {
            const r = Math.round(190 + shade * 64);
            const g = Math.round(72 + shade * 115);
            const b = Math.round(12 + shade * 85);
            doc.setFillColor(r, g, b);
        } else {
            const r = Math.round(160 + shade * 92);
            const gb = Math.round(18 + shade * 95);
            doc.setFillColor(r, gb, gb);
        }
        doc.rect(sx, cy, sw, dropH, "F");
    }

    // Side edges of cylinder wall
    const edgeColor: RGB = variant === "silver"
        ? [80, 88, 100]
        : variant === "amber"
            ? [146, 48, 6]
            : [135, 12, 12];
    doc.setDrawColor(...edgeColor);
    doc.setLineWidth(0.16);
    doc.line(cx - rMm, cy, cx - rMm, cy + dropH);
    doc.line(cx + rMm, cy, cx + rMm, cy + dropH);

    // 3. Top circular/elliptical cap
    if (variant === "silver") {
        doc.setFillColor(204, 210, 220);
        doc.setDrawColor(90, 98, 112);
    } else if (variant === "amber") {
        doc.setFillColor(249, 115, 22);
        doc.setDrawColor(154, 52, 18);
    } else {
        doc.setFillColor(242, 65, 65);
        doc.setDrawColor(140, 14, 14);
    }
    doc.setLineWidth(0.18);
    doc.ellipse(cx, cy, rMm, ry, "FD");

    // Subtle inner specular highlight on top cap
    if (variant === "silver") {
        doc.setFillColor(232, 237, 244);
    } else if (variant === "amber") {
        doc.setFillColor(254, 215, 170);
    } else {
        doc.setFillColor(255, 145, 145);
    }
    doc.ellipse(cx - rMm * 0.18, cy - ry * 0.15, rMm * 0.55, ry * 0.50, "F");
};

/**
 * Draws a two-tier Leg + Weld Node callout badge (grey Leg header box on top, white WN box below)
 * with a leader line and anchor dot, matching the 3D Framing Plan & 3D Face View style.
 */
const drawLegAndNodeBadge = (
    doc: jsPDF,
    anchorX: number,
    anchorY: number,
    badgeCenterX: number,
    badgeCenterY: number,
    legText: string,
    nodeText?: string
) => {
    const cleanLeg = legText.trim();
    const cleanNode = (nodeText || "").trim();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(4.8);
    const legW = cleanLeg ? doc.getTextWidth(cleanLeg) + 3.2 : 0;
    doc.setFontSize(4.4);
    const nodeW = cleanNode ? doc.getTextWidth(cleanNode) + 3.0 : 0;
    const boxW = Math.max(cleanLeg ? 9.5 : 6.6, legW, nodeW);
    const rowH = 2.85;
    const gap = 0.35;
    const totalH = cleanLeg && cleanNode ? rowH * 2 + gap : rowH;

    const x0 = badgeCenterX - boxW / 2;
    const y0 = badgeCenterY - totalH / 2;

    // Leader line from badge edge nearest to anchor point
    const nearX = anchorX < x0 ? x0 : anchorX > x0 + boxW ? x0 + boxW : badgeCenterX;
    const nearY = badgeCenterY;
    doc.setDrawColor(30, 64, 120);
    doc.setLineWidth(0.22);
    doc.line(nearX, nearY, anchorX, anchorY);

    // Anchor dot on the leg / joint
    doc.setFillColor(20, 30, 48);
    doc.circle(anchorX, anchorY, 0.42, "F");

    let curY = y0;
    if (cleanLeg) {
        doc.setFillColor(...LEG_BADGE_GREY);
        doc.setDrawColor(85, 90, 98);
        doc.setLineWidth(0.14);
        doc.roundedRect(x0, curY, boxW, rowH, 0.45, 0.45, "FD");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(4.8);
        doc.setTextColor(255, 255, 255);
        doc.text(cleanLeg, badgeCenterX, curY + 2.0, { align: "center" });
        curY += rowH + gap;
    }

    if (cleanNode) {
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(...NODE_BORDER_BLUE);
        doc.setLineWidth(0.18);
        doc.roundedRect(x0, curY, boxW, rowH, 0.35, 0.35, "FD");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(4.3);
        doc.setTextColor(22, 48, 96);
        doc.text(cleanNode, badgeCenterX, curY + 1.95, { align: "center" });
    }
    doc.setTextColor(0, 0, 0);
};

/**
 * Draws a standalone Weld Node (`WN N5`) white callout box with blue outline and leader line.
 */
const drawWeldNodeCallout = (
    doc: jsPDF,
    anchorX: number,
    anchorY: number,
    boxCenterX: number,
    boxCenterY: number,
    nodeText: string
) => {
    const txt = nodeText.trim();
    if (!txt) return;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(4.3);
    const boxW = Math.max(6.2, doc.getTextWidth(txt) + 2.8);
    const boxH = 2.75;
    const x0 = boxCenterX - boxW / 2;
    const y0 = boxCenterY - boxH / 2;

    // Leader line
    doc.setDrawColor(...NODE_BORDER_BLUE);
    doc.setLineWidth(0.22);
    doc.line(boxCenterX, y0 < anchorY ? y0 + boxH : y0, anchorX, anchorY);

    // Small joint dot
    doc.setFillColor(20, 30, 48);
    doc.circle(anchorX, anchorY, 0.42, "F");

    // White box with blue border
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...NODE_BORDER_BLUE);
    doc.setLineWidth(0.18);
    doc.roundedRect(x0, y0, boxW, boxH, 0.35, 0.35, "FD");
    doc.setTextColor(22, 48, 96);
    doc.text(txt, boxCenterX, y0 + 1.9, { align: "center" });
    doc.setTextColor(0, 0, 0);
};

/**
 * Draws a red anomaly/debris callout tag pointing to a white-ringed circle on the highlighted red member.
 */
const drawRedMemberCallout = (
    doc: jsPDF,
    px: number,
    py: number,
    tagCenterX: number,
    tagCenterY: number,
    labelText: string,
    inner: Box
) => {
    const txt = cleanMemberLabel(labelText);
    if (!txt) return;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(4.6);
    const boxW = Math.max(9.2, doc.getTextWidth(txt) + 3.2);
    const boxH = 3.0;

    const cx = Math.min(Math.max(tagCenterX, inner.x + boxW / 2 + 0.5), inner.x + inner.w - boxW / 2 - 0.5);
    const cy = Math.min(Math.max(tagCenterY, inner.y + boxH / 2 + 0.5), inner.y + inner.h - boxH / 2 - 0.5);
    const x0 = cx - boxW / 2;
    const y0 = cy - boxH / 2;

    // Red leader line from point on member to red tag
    doc.setDrawColor(...CALLOUT_RED);
    doc.setLineWidth(0.28);
    doc.line(px, py, cx, cy);

    // White-outlined circle marker on the red member
    doc.setFillColor(...CALLOUT_RED);
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.32);
    doc.circle(px, py, 0.85, "FD");

    // Red rectangular callout badge with bold white text
    doc.setFillColor(...CALLOUT_RED);
    doc.setDrawColor(165, 14, 14);
    doc.setLineWidth(0.15);
    doc.roundedRect(x0, y0, boxW, boxH, 0.4, 0.4, "FD");
    doc.setTextColor(255, 255, 255);
    doc.text(txt, cx, y0 + 2.1, { align: "center" });
    doc.setTextColor(0, 0, 0);
};

/** Strip the "N" prefix from node numbers in member names: "HOM N449-N450" -> "HOM 449-450" */
export const cleanMemberLabel = (raw?: string): string =>
    String(raw ?? "").replace(/\bN(?=\d)/gi, "").replace(/\s+/g, " ").trim();

const redTagSize = (doc: jsPDF, txt: string): { w: number; h: number } => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(4.6);
    return { w: Math.max(9.2, doc.getTextWidth(cleanMemberLabel(txt)) + 3.2), h: 3.0 };
};

const anomalyTagSize = (doc: jsPDF, lines: string[]): { w: number; h: number } => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(4.0);
    const maxW = Math.max(...lines.map(l => doc.getTextWidth(l)));
    return { w: Math.max(8.0, maxW + 2.6), h: 1.0 + lines.length * 2.0 };
};

interface LabelPlacer {
    reserve: (r: Box) => void;
    place: (ax: number, ay: number, w: number, h: number, prefAngle?: number) => Pt2;
}

/**
 * Greedy label layout: tries positions on growing rings around the anchor (starting at the preferred
 * direction) and picks the first one that stays inside the drawing area and overlaps no other label.
 */
const createLabelPlacer = (inner: Box): LabelPlacer => {
    const rects: Box[] = [];
    const gap = 0.5;
    const hit = (r: Box) =>
        rects.some(o => r.x < o.x + o.w + gap && r.x + r.w + gap > o.x && r.y < o.y + o.h + gap && r.y + r.h + gap > o.y);
    return {
        reserve: r => { rects.push(r); },
        place: (ax, ay, w, h, prefAngle = -Math.PI / 2) => {
            const clampC = (cx: number, cy: number): Pt2 => [
                Math.min(Math.max(cx, inner.x + w / 2 + 0.5), inner.x + inner.w - w / 2 - 0.5),
                Math.min(Math.max(cy, inner.y + h / 2 + 0.5), inner.y + inner.h - h / 2 - 0.5)
            ];
            let first: Pt2 | null = null;
            for (const rad of [4.5, 7, 9.5, 12.5, 16, 21]) {
                for (let k = 0; k < 12; k++) {
                    const off = k === 0 ? 0 : (k % 2 === 1 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 6);
                    const a = prefAngle + off;
                    const [cx, cy] = clampC(
                        ax + Math.cos(a) * (rad + (w / 2) * Math.abs(Math.cos(a))),
                        ay + Math.sin(a) * (rad + (h / 2) * Math.abs(Math.sin(a)))
                    );
                    if (!first) first = [cx, cy];
                    const rect: Box = { x: cx - w / 2, y: cy - h / 2, w, h };
                    if (!hit(rect)) {
                        rects.push(rect);
                        return [cx, cy];
                    }
                }
            }
            const [fx, fy] = first || [ax, ay];
            rects.push({ x: fx - w / 2, y: fy - h / 2, w, h });
            return [fx, fy];
        }
    };
};

/**
 * Draws an amber anomaly callout (1-2 lines: member name + anomaly ref) centred at (cx, cy)
 * with a leader line to the anomalous member at (px, py).
 */
const drawAnomalyMemberCallout = (
    doc: jsPDF,
    px: number,
    py: number,
    cx: number,
    cy: number,
    lines: string[],
    inner: Box
) => {
    if (lines.length === 0) return;
    const { w, h } = anomalyTagSize(doc, lines);
    const x0 = Math.min(Math.max(cx - w / 2, inner.x + 0.3), inner.x + inner.w - w - 0.3);
    const y0 = Math.min(Math.max(cy - h / 2, inner.y + 0.3), inner.y + inner.h - h - 0.3);

    // Amber-orange leader line (to nearest edge centre of the tag)
    doc.setDrawColor(217, 119, 6);
    doc.setLineWidth(0.2);
    doc.line(px, py, x0 + w / 2, y0 + h / 2);

    // White-outlined amber dot on the anomalous member
    doc.setFillColor(234, 88, 12);
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.26);
    doc.circle(px, py, 0.68, "FD");

    // Amber badge (drawn after the leader so the line tucks under it)
    doc.setFillColor(254, 243, 199);
    doc.setDrawColor(217, 119, 6);
    doc.setLineWidth(0.18);
    doc.roundedRect(x0, y0, w, h, 0.35, 0.35, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(4.0);
    lines.forEach((ln, i) => {
        doc.setTextColor(i === 0 ? 120 : 180, i === 0 ? 53 : 83, i === 0 ? 15 : 9);
        doc.text(ln, x0 + w / 2, y0 + 1.9 + i * 2.0, { align: "center" });
    });
    doc.setTextColor(0, 0, 0);
};

/** Places and draws amber callouts for every anomaly-highlighted member / weld / anode in the view */
const drawAnomalyCallouts = (
    doc: jsPDF,
    items: SketchMember[],
    project: (p: Vec3) => Pt2,
    view: View,
    placer: LabelPlacer
) => {
    const seen = new Set<string>();
    items.forEach(m => {
        const key = (m.qid || "").toUpperCase();
        if (!key || seen.has(key) || seen.size >= 8) return;
        seen.add(key);
        const [px, py] = view.toPage(...project(lerp3(m.start, m.end, 0.5)));
        const a = view.toPage(...project(m.start));
        const b = view.toPage(...project(m.end));
        const { perp } = dirAndPerp(a, b);
        const name = cleanMemberLabel(m.qid);
        const ref = cleanMemberLabel(m.anomalyLabel);
        const lines = ref && ref !== name ? [name, ref] : [name];
        const { w, h } = anomalyTagSize(doc, lines);
        const [cx, cy] = placer.place(px, py, w, h, Math.atan2(perp[1], perp[0]));
        drawAnomalyMemberCallout(doc, px, py, cx, cy, lines, view.inner);
    });
};

/**
 * Draws a 4-point compass rose in the bottom-left corner of the Plan View.
 */
const drawCompassRose = (doc: jsPDF, cx: number, cy: number, r = 2.6) => {
    const ri = r * 0.34;
    // Outer ring
    doc.setDrawColor(180, 190, 205);
    doc.setLineWidth(0.12);
    doc.circle(cx, cy, r * 0.82, "S");

    // North & South triangles
    doc.setFillColor(...HEADER_BLUE);
    doc.triangle(cx, cy - r, cx - ri, cy, cx + ri, cy, "F");
    doc.setFillColor(180, 192, 208);
    doc.triangle(cx, cy + r, cx - ri, cy, cx + ri, cy, "F");

    // East & West triangles
    doc.setFillColor(...HEADER_NAVY);
    doc.triangle(cx + r, cy, cx, cy - ri, cx, cy + ri, "F");
    doc.setFillColor(205, 214, 226);
    doc.triangle(cx - r, cy, cx, cy - ri, cx, cy + ri, "F");

    // N / S / E / W labels
    doc.setFont("helvetica", "bold");
    doc.setFontSize(3.6);
    doc.setTextColor(30, 41, 59);
    doc.text("N", cx, cy - r - 0.5, { align: "center" });
    doc.text("S", cx, cy + r + 1.5, { align: "center" });
    doc.text("W", cx - r - 1.1, cy + 0.45, { align: "center" });
    doc.text("E", cx + r + 1.1, cy + 0.45, { align: "center" });
    doc.setTextColor(0, 0, 0);
};

/** Draw a single numbered marker (used in Member Detail & Flag Legend). */
export const drawFlagMarker = (doc: jsPDF, x: number, y: number, flag: DebrisFlag, r = 2.1) => {
    const color = FLAG_COLORS[flag.material];
    doc.setDrawColor(...color);
    doc.setLineWidth(flag.hazardous ? 0.55 : 0.3);
    if (flag.approx) (doc as any).setLineDashPattern([0.6, 0.45], 0);
    if (flag.touching) {
        doc.setFillColor(...color);
        doc.circle(x, y, r, "FD");
    } else {
        doc.setFillColor(255, 255, 255);
        doc.circle(x, y, r, "FD");
    }
    (doc as any).setLineDashPattern([], 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(r > 2 ? 5.5 : 5);
    if (flag.touching) doc.setTextColor(255, 255, 255);
    else doc.setTextColor(...color);
    doc.text(String(flag.n), x, y + 0.75, { align: "center" });
    doc.setTextColor(0, 0, 0);
};

/** Page-space unit direction and an "up-ish" perpendicular for a member line */
const dirAndPerp = (a: Pt2, b: Pt2): { dir: Pt2; perp: Pt2 } => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-6) return { dir: [1, 0], perp: [0, -1] };
    const dir: Pt2 = [dx / len, dy / len];
    let perp: Pt2 = [dir[1], -dir[0]];
    if (Math.abs(perp[1]) < 1e-3) perp = [perp[0] >= 0 ? 1 : -1, 0];
    else if (perp[1] > 0) perp = [-perp[0], -perp[1]];
    return { dir, perp };
};

const deriveElevs = (target: SketchMember, flags: DebrisFlag[], relevantElevations?: number[]): number[] => {
    const rawElevs = (relevantElevations && relevantElevations.length > 0)
        ? relevantElevations.filter(e => Number.isFinite(e))
        : (flags.length > 0
            ? flags.map(f => lerp3(target.start, target.end, f.t)[1])
            : [(target.start[1] + target.end[1]) / 2]);
    const elevs: number[] = [];
    for (const e of rawElevs) {
        if (!elevs.some(existing => Math.abs(existing - e) < 0.5)) {
            elevs.push(e);
        }
    }
    return elevs;
};

/** Resolve a clean Face subtitle (e.g. "FACE A1-B1") for a member in the 3D Face View */
export const resolveFaceSubtitle = (
    target: SketchMember,
    context: SketchMember[],
    axis: "x" | "z"
): string => {
    const sLeg = cleanLegLabel(target.sLeg);
    const fLeg = cleanLegLabel(target.fLeg);
    if (sLeg && fLeg && sLeg !== fLeg) return `FACE ${sLeg}-${fLeg}`;

    // Check legs on the same elevation face plane
    const perpIdx = axis === "x" ? 2 : 0;
    const horizIdx = axis === "x" ? 0 : 2;
    const targetDepth = (target.start[perpIdx] + target.end[perpIdx]) / 2;
    const planeLegs = context
        .filter(m => isLegMember(m) && Math.abs((m.start[perpIdx] + m.end[perpIdx]) / 2 - targetDepth) <= 4.5)
        .map(m => ({
            leg: cleanLegLabel(m.sLeg || m.fLeg || m.qid),
            u: (m.start[horizIdx] + m.end[horizIdx]) / 2
        }))
        .filter(x => Boolean(x.leg))
        .sort((a, b) => a.u - b.u);

    const uniquePlaneLegs: string[] = [];
    for (const pl of planeLegs) {
        if (!uniquePlaneLegs.includes(pl.leg)) uniquePlaneLegs.push(pl.leg);
    }
    if (uniquePlaneLegs.length >= 2) {
        return `FACE ${uniquePlaneLegs[0]}-${uniquePlaneLegs[uniquePlaneLegs.length - 1]}`;
    }
    if (target.face) {
        const f = target.face.trim().toUpperCase();
        return f.startsWith("FACE") || f.startsWith("ROW") ? f : `FACE ${f}`;
    }
    if (sLeg) return `LEG ${sLeg}`;
    return `AXIS ${axis.toUpperCase()}`;
};

/** Find a weld node label near a 3D point (within tolerance) */
const findWeldNodeNearPoint = (
    pt: Vec3,
    members: SketchMember[],
    tol = 2.2
): string => {
    for (const m of members) {
        const dStart = Math.hypot(m.start[0] - pt[0], m.start[1] - pt[1], m.start[2] - pt[2]);
        if (dStart <= tol) {
            const lbl = formatWeldNodeLabel(m.sNode || (/^(WN|WP|ND)\b/i.test(m.qid) ? m.qid : ""));
            if (lbl) return lbl;
        }
        const dEnd = Math.hypot(m.end[0] - pt[0], m.end[1] - pt[1], m.end[2] - pt[2]);
        if (dEnd <= tol) {
            const lbl = formatWeldNodeLabel(m.fNode);
            if (lbl) return lbl;
        }
    }
    return "";
};

/**
 * 3D Face View (Elevation View):
 *  - Shows the multi-bay jacket truss face with resized 3D-shaded silver tubular members (`HOM`, diagonals, legs)
 *  - Clearly distinguishes Node Welds (`WN` stepped weld collar rings), `HOM` members, and Anodes (`AN` cyan standoff bars)
 *  - Highlights members where anomalies have been identified in vibrant AMBER-ORANGE and the target member in bright RED
 *  - Shows elevation datum lines on the left with `EL (+)3.000 m` and downward black triangles
 *  - Shows `Leg A1` / `Leg B1` badges at the top of each leg and `WN N1..N10` node badges along both legs
 */
export const drawElevationView = (
    doc: jsPDF,
    box: Box,
    context: SketchMember[],
    target: SketchMember,
    flags: DebrisFlag[],
    axis: "x" | "z",
    relevantElevations?: number[],
    allMembers?: SketchMember[]
) => {
    const elevs = deriveElevs(target, flags, relevantElevations);
    const { members: elevContext, activeElevs, clipMinY, clipMaxY } = filterElevationContextForElevations(
        context,
        target,
        elevs,
        axis,
        1.5,
        allMembers
    );

    const structuralInView = elevContext.filter(m => !isAnodeMember(m) && !isWeldMember(m));

    // If the target itself is an Anode (AN) or Node Weld (WN), highlight its host structural member too
    if (isAnodeMember(target) || isWeldMember(target)) {
        const host = findHostStructuralMember(target, structuralInView);
        if (host) {
            host.hasAnomaly = true;
            if (!host.anomalyLabel) host.anomalyLabel = target.qid;
        }
    }

    // Slice vertical / battered column or pipe target to the local elevation window
    let drawnTarget: SketchMember = target;
    if (isColumnOrPipeMember(target) && !isAnodeMember(target) && !isWeldMember(target)) {
        const mMinY = Math.min(target.start[1], target.end[1]);
        const mMaxY = Math.max(target.start[1], target.end[1]);
        const y0 = Math.max(mMinY, clipMinY);
        const y1 = Math.min(mMaxY, clipMaxY);
        const dy = target.end[1] - target.start[1];
        const t0 = Math.abs(dy) > 1e-6 ? Math.min(1, Math.max(0, (y0 - target.start[1]) / dy)) : 0;
        const t1 = Math.abs(dy) > 1e-6 ? Math.min(1, Math.max(0, (y1 - target.start[1]) / dy)) : 1;
        drawnTarget = {
            ...target,
            start: lerp3(target.start, target.end, t0),
            end: lerp3(target.start, target.end, t1)
        };
    } else if (isAnodeMember(target) || isWeldMember(target)) {
        const matchingResolved = elevContext.find(
            m => m.qid && target.qid && m.qid.toUpperCase() === target.qid.toUpperCase()
        );
        if (matchingResolved) drawnTarget = matchingResolved;
    }

    const pts: Pt2[] = [];
    [...structuralInView, drawnTarget].forEach(m => {
        pts.push(projectElevation(m.start, axis), projectElevation(m.end, axis));
    });
    const bounds = boundsOf(pts);

    // Reserve left space for "EL (-)25.000 m" + "WN N1" badges, right space for "WN N2" badges, top for "Leg A1"
    const headerH = 8.2;
    const contentBox: Box = { x: box.x, y: box.y + headerH, w: box.w, h: box.h - headerH };
    const view = makeView(contentBox, bounds, true, 24.5, 13.5, 4.5, 1.5);

    const displayElevs = (activeElevs.length > 0 ? activeElevs : elevs)
        .filter(v => v >= bounds.minV - 1.5 && v <= bounds.maxV + 1.5)
        .sort((a, b) => b - a);

    // Identify left and right leg columns in page space
    const legMembers = structuralInView.filter(m => isLegMember(m));
    const legColsRaw: { label: string; member: SketchMember; topPx: number; topPy: number }[] = [];
    legMembers.forEach(m => {
        const lbl = cleanLegLabel(m.sLeg || m.fLeg || m.qid);
        const topPt = m.start[1] >= m.end[1] ? m.start : m.end;
        const [px, py] = view.toPage(...projectElevation(topPt, axis));
        const existing = legColsRaw.find(c => Math.abs(c.topPx - px) < 5.0);
        if (!existing) {
            legColsRaw.push({ label: lbl, member: m, topPx: px, topPy: py });
        } else if (lbl && !existing.label) {
            existing.label = lbl;
        }
    });
    legColsRaw.sort((a, b) => a.topPx - b.topPx);

    // Helper to interpolate X of a leg at elevation v
    const getLegPageXAtElev = (legMem: SketchMember, v: number): Pt2 => {
        const dy = legMem.end[1] - legMem.start[1];
        const t = Math.abs(dy) > 1e-6 ? Math.min(1, Math.max(0, (v - legMem.start[1]) / dy)) : 0.5;
        const p3 = lerp3(legMem.start, legMem.end, t);
        return view.toPage(...projectElevation(p3, axis));
    };

    const leftLegCol = legColsRaw[0] || null;
    const rightLegCol = legColsRaw.length > 1 ? legColsRaw[legColsRaw.length - 1] : null;

    // 1. Draw left-side Elevation Datum Lines + black downward triangle + "EL (-)25.000 m"
    const datumStartX = box.x + 2.2;
    displayElevs.forEach(v => {
        const [minPageX, py] = view.toPage(bounds.minU, v);
        const stopX = leftLegCol ? getLegPageXAtElev(leftLegCol.member, v)[0] : minPageX;

        // Dashed horizontal datum line from left margin to left leg
        doc.setDrawColor(145, 160, 180);
        doc.setLineWidth(0.14);
        (doc as any).setLineDashPattern([0.8, 0.6], 0);
        doc.line(datumStartX, py, stopX, py);
        (doc as any).setLineDashPattern([], 0);

        // Downward black triangle marker sitting on the datum line
        const triX = datumStartX + 1.6;
        doc.setFillColor(20, 24, 32);
        doc.triangle(triX - 0.85, py - 1.15, triX + 0.85, py - 1.15, triX, py - 0.05, "F");

        // Elevation text above datum line
        doc.setFont("helvetica", "bold");
        doc.setFontSize(4.4);
        doc.setTextColor(20, 24, 32);
        doc.text(`EL ${formatElev3D(v)}`, datumStartX, py - 1.55);
    });

    // 2. Draw 3D-shaded framing braces (resized so HOM members, diagonals, node welds, and anodes are clearly distinct)
    const isSameAsTarget = (m: SketchMember) =>
        Boolean(target.qid && m.qid && m.qid.toUpperCase() === target.qid.toUpperCase());

    const braces = structuralInView.filter(m => !isPointMember(m) && !isLegMember(m) && !isSameAsTarget(m));
    const diagonals = braces.filter(m => !isHorizontalMember(m));
    const horizontals = braces.filter(m => isHorizontalMember(m));

    // Normal silver diagonals & horizontals first
    diagonals.filter(m => !m.hasAnomaly).forEach(m => {
        const a = view.toPage(...projectElevation(m.start, axis));
        const b = view.toPage(...projectElevation(m.end, axis));
        drawShadedTube(doc, a[0], a[1], b[0], b[1], 0.36, "silver");
    });

    horizontals.filter(m => !m.hasAnomaly).forEach(m => {
        const a = view.toPage(...projectElevation(m.start, axis));
        const b = view.toPage(...projectElevation(m.end, axis));
        const rMm = memberLength(m) < 4.0 ? 0.38 : 0.44;
        drawShadedTube(doc, a[0], a[1], b[0], b[1], rMm, "silver");
    });

    // Anomaly-highlighted diagonals & horizontals in vibrant amber-orange on top of normal silver braces
    diagonals.filter(m => m.hasAnomaly).forEach(m => {
        const a = view.toPage(...projectElevation(m.start, axis));
        const b = view.toPage(...projectElevation(m.end, axis));
        drawShadedTube(doc, a[0], a[1], b[0], b[1], 0.48, "amber");
    });

    horizontals.filter(m => m.hasAnomaly).forEach(m => {
        const a = view.toPage(...projectElevation(m.start, axis));
        const b = view.toPage(...projectElevation(m.end, axis));
        drawShadedTube(doc, a[0], a[1], b[0], b[1], 0.54, "amber");
    });

    // Draw main vertical/battered legs as resized 3D-shaded cylinders (0.76mm radius)
    legMembers.forEach(m => {
        if (isSameAsTarget(m)) return;
        const a = view.toPage(...projectElevation(m.start, axis));
        const b = view.toPage(...projectElevation(m.end, axis));
        drawShadedTube(doc, a[0], a[1], b[0], b[1], m.hasAnomaly ? 0.84 : 0.76, m.hasAnomaly ? "amber" : "silver");

        // Compact stepped joint collars at each horizontal framing elevation along the leg
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        displayElevs.forEach(v => {
            const [jx, jy] = getLegPageXAtElev(m, v);
            drawJointCollar(doc, jx, jy, ux, uy, 0.76, 0.58, "silver");
        });
    });

    // 2b. Draw Node Weld (`WN` / `WP`) components on the face
    const weldComps = elevContext.filter(m => isWeldMember(m) && !isSameAsTarget(m));
    weldComps.forEach(w => {
        const a = view.toPage(...projectElevation(w.start, axis));
        const b = view.toPage(...projectElevation(w.end, axis));
        const cx = (a[0] + b[0]) / 2;
        const cy = (a[1] + b[1]) / 2;
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const len = Math.hypot(dx, dy);
        const ux = len > 1e-4 ? dx / len : 1;
        const uy = len > 1e-4 ? dy / len : 0;
        drawJointCollar(doc, cx, cy, ux, uy, 0.44, 0.52, w.hasAnomaly ? "amber" : "silver");
    });

    // 2c. Draw Sacrificial Standoff Anodes (`AN` / `BAN...`) on the face
    const anodeComps = elevContext.filter(m => isAnodeMember(m) && !isSameAsTarget(m));
    const placedAnodeLabels: Pt2[] = [];
    anodeComps.forEach(an => {
        const a = view.toPage(...projectElevation(an.start, axis));
        const b = view.toPage(...projectElevation(an.end, axis));
        const cx = (a[0] + b[0]) / 2;
        const cy = (a[1] + b[1]) / 2;
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const len = Math.hypot(dx, dy);
        const ux = len > 1e-4 ? dx / len : 1;
        const uy = len > 1e-4 ? dy / len : 0;
        const canLabel = placedAnodeLabels.every(p => Math.hypot(p[0] - cx, p[1] - cy) > 5.0);
        if (canLabel && an.qid) placedAnodeLabels.push([cx, cy]);
        drawAnodeSymbol(
            doc,
            cx,
            cy,
            ux,
            uy,
            0.44,
            an.hasAnomaly ? "amber" : "cyan",
            canLabel ? an.qid : undefined
        );
    });

    // Layout pass: reserve the fixed badges first so callouts are placed around them, never on top
    const placer = createLabelPlacer(view.inner);
    const nodeSource = allMembers || context;
    const nodeBadges: { jx: number; jy: number; side: -1 | 1; text: string }[] = [];
    displayElevs.forEach(v => {
        ([[leftLegCol, -1], [rightLegCol, 1]] as [typeof leftLegCol, -1 | 1][]).forEach(([col, side]) => {
            if (!col) return;
            const dyL = col.member.end[1] - col.member.start[1];
            const t = Math.abs(dyL) > 1e-6 ? Math.min(1, Math.max(0, (v - col.member.start[1]) / dyL)) : 0.5;
            const p3 = lerp3(col.member.start, col.member.end, t);
            const [jx, jy] = view.toPage(...projectElevation(p3, axis));
            const text = findWeldNodeNearPoint(p3, nodeSource);
            if (!text) return;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(4.4);
            const bw = Math.max(6.6, doc.getTextWidth(text) + 3.0);
            placer.reserve({ x: jx + side * 6.8 - bw / 2, y: jy - 1.43, w: bw, h: 2.85 });
            nodeBadges.push({ jx, jy, side, text });
        });
    });
    legColsRaw.forEach(col => {
        if (col.label) placer.reserve({ x: col.topPx - 6, y: contentBox.y + 1.0, w: 12, h: 2.8 });
    });

    // 3. Draw Target Member / Component in 3D-shaded bright RED on top of context
    drawTarget3D(doc, view, target, flags, (p) => projectElevation(p, axis), "elevation", drawnTarget, false, placer);

    // 3b. Amber callouts for other anomaly-highlighted members/components (auto-placed, no overlaps)
    drawAnomalyCallouts(
        doc,
        [
            ...braces.filter(m => m.hasAnomaly),
            ...anodeComps.filter(m => m.hasAnomaly),
            ...weldComps.filter(m => m.hasAnomaly)
        ],
        p => projectElevation(p, axis),
        view,
        placer
    );

    // 4. Draw Top Leg Badges ("Leg A1", "Leg B1") and Side Node Badges (node numbers only, e.g. "378")
    legColsRaw.forEach((col) => {
        if (!col.label) return;
        const topBadgeY = contentBox.y + 2.4;
        const legTitle = `Leg ${col.label}`;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(4.5);
        const bw = Math.max(9.5, doc.getTextWidth(legTitle) + 2.8);
        const bh = 2.7;
        doc.setFillColor(...LEG_BADGE_GREY);
        doc.setDrawColor(85, 90, 98);
        doc.setLineWidth(0.14);
        doc.roundedRect(col.topPx - bw / 2, topBadgeY - bh / 2, bw, bh, 0.4, 0.4, "FD");
        doc.setTextColor(255, 255, 255);
        doc.text(legTitle, col.topPx, topBadgeY + 0.65, { align: "center" });
    });
    doc.setTextColor(0, 0, 0);

    // Side node badges (node number only) at each framing elevation along the left / right legs
    nodeBadges.forEach(b => {
        drawLegAndNodeBadge(doc, b.jx + b.side * 0.8, b.jy, b.jx + b.side * 6.8, b.jy, "", b.text);
    });
};

/**
 * 3D Framing Plan (Plan View):
 *  - Shows horizontal perimeter & X-brace framing at the relevant elevation as resized 3D-shaded tubes
 *  - Clearly distinguishes Node Welds (`WN` stepped collar rings), `HOM` members, and Anodes (`AN` cyan standoff bars)
 *  - Highlights members where anomalies have been identified in vibrant AMBER-ORANGE and the target member in bright RED
 *  - Renders 3D cylindrical leg cans at each corner leg with two-tier Leg + WN callout badges (`A2 / WN N2`)
 *  - Includes a 4-point compass rose in the bottom-left corner
 */
export const drawPlanView = (
    doc: jsPDF,
    box: Box,
    context: SketchMember[],
    target: SketchMember,
    flags: DebrisFlag[],
    relevantElevations?: number[],
    allMembers?: SketchMember[]
) => {
    const elevs = deriveElevs(target, flags, relevantElevations);
    const planContext = filterPlanContextForElevations(context, elevs, 1.5, allMembers);

    const structuralInPlan = planContext.filter(m => !isAnodeMember(m) && !isWeldMember(m));

    // If the target itself is an Anode (AN) or Node Weld (WN), highlight its host structural member too
    if (isAnodeMember(target) || isWeldMember(target)) {
        const host = findHostStructuralMember(target, structuralInPlan);
        if (host) {
            host.hasAnomaly = true;
            if (!host.anomalyLabel) host.anomalyLabel = target.qid;
        }
    }

    // Slice vertical / battered column or pipe target to the relevant elevation range for Plan View
    let drawnTarget: SketchMember = target;
    if (isColumnOrPipeMember(target) && !isAnodeMember(target) && !isWeldMember(target) && elevs.length > 0) {
        const dy = target.end[1] - target.start[1];
        const minE = Math.min(...elevs);
        const maxE = Math.max(...elevs);
        const t0 = Math.abs(dy) > 1e-6 ? Math.min(1, Math.max(0, (minE - target.start[1]) / dy)) : 0.5;
        const t1 = Math.abs(dy) > 1e-6 ? Math.min(1, Math.max(0, (maxE - target.start[1]) / dy)) : 0.5;
        drawnTarget = {
            ...target,
            start: lerp3(target.start, target.end, t0),
            end: lerp3(target.start, target.end, t1)
        };
    } else if (isAnodeMember(target) || isWeldMember(target)) {
        const matchingResolved = planContext.find(
            m => m.qid && target.qid && m.qid.toUpperCase() === target.qid.toUpperCase()
        );
        if (matchingResolved) drawnTarget = matchingResolved;
    }

    const pts: Pt2[] = [];
    [...structuralInPlan, drawnTarget].forEach(m => pts.push(projectPlan(m.start), projectPlan(m.end)));
    const bounds = boundsOf(pts);

    const headerH = 8.2;
    const contentBox: Box = { x: box.x, y: box.y + headerH, w: box.w, h: box.h - headerH };
    // Reserve horizontal & vertical margin around the framing rectangle for the corner leg badges
    const view = makeView(contentBox, bounds, false, 13.5, 13.5, 4.5, 5.5);

    const isSameAsTarget = (m: SketchMember) =>
        Boolean(target.qid && m.qid && m.qid.toUpperCase() === target.qid.toUpperCase());

    const legCans: { label: string; pos3: Vec3; px: number; py: number; isTarget: boolean; hasAnomaly: boolean }[] = [];
    const framingLines: { m: SketchMember; a: Pt2; b: Pt2 }[] = [];

    structuralInPlan.forEach(m => {
        if (isPointMember(m)) return;
        const a = view.toPage(...projectPlan(m.start));
        const b = view.toPage(...projectPlan(m.end));
        if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.35) {
            const lbl = cleanLegLabel(m.sLeg || m.fLeg || m.qid);
            const existing = legCans.find(c => Math.hypot(c.px - a[0], c.py - a[1]) < 3.5);
            if (!existing) {
                legCans.push({
                    label: lbl,
                    pos3: m.start,
                    px: a[0],
                    py: a[1],
                    isTarget: isSameAsTarget(m),
                    hasAnomaly: Boolean(m.hasAnomaly)
                });
            } else {
                if (lbl && !existing.label) existing.label = lbl;
                if (m.hasAnomaly) existing.hasAnomaly = true;
            }
        } else if (!isSameAsTarget(m)) {
            framingLines.push({ m, a, b });
        }
    });

    // Also infer corner legs from framing member leg metadata if foundation leg stubs weren't present
    if (legCans.length === 0) {
        structuralInPlan.forEach(m => {
            const sLbl = cleanLegLabel(m.sLeg);
            if (sLbl) {
                const [px, py] = view.toPage(...projectPlan(m.start));
                if (!legCans.some(c => Math.hypot(c.px - px, c.py - py) < 3.5)) {
                    legCans.push({ label: sLbl, pos3: m.start, px, py, isTarget: false, hasAnomaly: false });
                }
            }
            const fLbl = cleanLegLabel(m.fLeg);
            if (fLbl) {
                const [px, py] = view.toPage(...projectPlan(m.end));
                if (!legCans.some(c => Math.hypot(c.px - px, c.py - py) < 3.5)) {
                    legCans.push({ label: fLbl, pos3: m.end, px, py, isTarget: false, hasAnomaly: false });
                }
            }
        });
    }

    // 1. Draw resized 3D-shaded framing members (normal silver first, then anomaly-highlighted amber on top)
    framingLines.filter(f => !f.m.hasAnomaly).forEach(({ m, a, b }) => {
        const rMm = memberLength(m) < 4.0 ? 0.38 : 0.46;
        drawShadedTube(doc, a[0], a[1], b[0], b[1], rMm, "silver");
    });

    framingLines.filter(f => f.m.hasAnomaly).forEach(({ a, b }) => {
        drawShadedTube(doc, a[0], a[1], b[0], b[1], 0.56, "amber");
    });

    // Detect interior X-brace / K-brace center node intersection (away from corner legs)
    const centerX = view.inner.x + view.inner.w / 2;
    const centerY = view.inner.y + view.inner.h / 2;
    const interiorJoints: { pos3: Vec3; px: number; py: number; dirX: number; dirY: number }[] = [];

    // Check midpoints of diagonal framing braces that cross near the center of the plan bay
    const allFramingWithTarget = [
        ...framingLines.map(f => f.m),
        ...(isColumnOrPipeMember(target) || isAnodeMember(target) || isWeldMember(target) ? [] : [drawnTarget])
    ];
    for (let i = 0; i < allFramingWithTarget.length; i++) {
        for (let j = i + 1; j < allFramingWithTarget.length; j++) {
            const m1 = allFramingWithTarget[i];
            const m2 = allFramingWithTarget[j];
            const mid1: Vec3 = lerp3(m1.start, m1.end, 0.5);
            const mid2: Vec3 = lerp3(m2.start, m2.end, 0.5);
            if (Math.hypot(mid1[0] - mid2[0], mid1[2] - mid2[2]) < 2.2) {
                const [px, py] = view.toPage(...projectPlan(mid1));
                const nearCorner = legCans.some(c => Math.hypot(c.px - px, c.py - py) < 5.0);
                if (!nearCorner && !interiorJoints.some(ij => Math.hypot(ij.px - px, ij.py - py) < 4.0)) {
                    const a1 = view.toPage(...projectPlan(m1.start));
                    const b1 = view.toPage(...projectPlan(m1.end));
                    const len1 = Math.hypot(b1[0] - a1[0], b1[1] - a1[1]) || 1;
                    interiorJoints.push({
                        pos3: mid1,
                        px,
                        py,
                        dirX: (b1[0] - a1[0]) / len1,
                        dirY: (b1[1] - a1[1]) / len1
                    });
                }
            }
        }
    }

    // Draw compact stepped joint collar at interior X-brace intersection
    interiorJoints.forEach(ij => {
        drawJointCollar(doc, ij.px, ij.py, ij.dirX, ij.dirY, 0.48, 0.58, "silver");
    });

    // 1b. Draw Node Weld (`WN` / `WP`) components on this plan level
    const weldComps = planContext.filter(m => isWeldMember(m) && !isSameAsTarget(m));
    weldComps.forEach(w => {
        const a = view.toPage(...projectPlan(w.start));
        const b = view.toPage(...projectPlan(w.end));
        const cx = (a[0] + b[0]) / 2;
        const cy = (a[1] + b[1]) / 2;
        // Skip if right on top of a corner leg can center (already labeled by leg badge unless anomalous)
        if (!w.hasAnomaly && legCans.some(c => Math.hypot(c.px - cx, c.py - cy) < 2.2)) return;
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const len = Math.hypot(dx, dy);
        const ux = len > 1e-4 ? dx / len : 1;
        const uy = len > 1e-4 ? dy / len : 0;
        drawJointCollar(doc, cx, cy, ux, uy, 0.46, 0.54, w.hasAnomaly ? "amber" : "silver");
    });

    // 1c. Draw Sacrificial Standoff Anodes (`AN` / `BAN...`) on this plan level
    const anodeComps = planContext.filter(m => isAnodeMember(m) && !isSameAsTarget(m));
    const placedAnodeLabels: Pt2[] = [];
    anodeComps.forEach(an => {
        const a = view.toPage(...projectPlan(an.start));
        const b = view.toPage(...projectPlan(an.end));
        const cx = (a[0] + b[0]) / 2;
        const cy = (a[1] + b[1]) / 2;
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const len = Math.hypot(dx, dy);
        const ux = len > 1e-4 ? dx / len : 1;
        const uy = len > 1e-4 ? dy / len : 0;
        const canLabel = placedAnodeLabels.every(p => Math.hypot(p[0] - cx, p[1] - cy) > 5.0);
        if (canLabel && an.qid) placedAnodeLabels.push([cx, cy]);
        drawAnodeSymbol(
            doc,
            cx,
            cy,
            ux,
            uy,
            0.46,
            an.hasAnomaly ? "amber" : "cyan",
            canLabel ? an.qid : undefined
        );
    });

    // Layout pass: reserve the corner Leg / node badges first so callouts are placed around them
    const allSource = allMembers || context;
    const placer = createLabelPlacer(view.inner);
    const sortedCans = [...legCans].sort((a, b) => (Math.abs(a.py - b.py) > 4 ? a.py - b.py : a.px - b.px));
    const legBadges = sortedCans.map((can, idx) => {
        const isLeft = can.px <= centerX;
        const isTop = can.py <= centerY;
        const nodeText = findWeldNodeNearPoint(can.pos3, allSource);
        const legText = can.label || `L${idx + 1}`;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(4.8);
        const w = Math.max(9.5, doc.getTextWidth(legText) + 3.2);
        const h = nodeText ? 2.85 * 2 + 0.35 : 2.85;
        const badgeX = can.px + (isLeft ? -8.6 : 8.6);
        const badgeY = can.py + (isTop ? -1.2 : 1.2);
        placer.reserve({ x: badgeX - w / 2, y: badgeY - h / 2, w, h });
        return {
            anchorX: can.px + (isLeft ? -1.4 : 1.4),
            anchorY: can.py + (isTop ? -0.3 : 0.3),
            badgeX,
            badgeY,
            legText,
            nodeText
        };
    });

    // 2. Draw Target Member in 3D-shaded bright RED (before corner leg cans so cans cap the ends cleanly)
    const targetIsLegCan = legCans.some(c => c.isTarget);
    if (!targetIsLegCan) {
        drawTarget3D(doc, view, target, flags, projectPlan, "plan", drawnTarget, false);
    }

    // 3. Draw resized 3D cylindrical corner leg cans (1.65mm radius) on top of framing ends
    legCans.forEach(can => {
        const variant = can.isTarget ? "red" : can.hasAnomaly ? "amber" : "silver";
        drawPlanLegCan(doc, can.px, can.py, can.isTarget || can.hasAnomaly ? 1.75 : 1.65, variant);
    });

    // 4. Draw Red Callout Tag(s) on the target member on top of everything
    drawTarget3D(doc, view, target, flags, projectPlan, "plan", drawnTarget, true, placer);

    // 4b. Amber callouts for other anomaly-highlighted members/components (auto-placed, no overlaps)
    drawAnomalyCallouts(
        doc,
        [
            ...framingLines.filter(f => f.m.hasAnomaly).map(f => f.m),
            ...anodeComps.filter(m => m.hasAnomaly),
            ...weldComps.filter(m => m.hasAnomaly)
        ],
        projectPlan,
        view,
        placer
    );

    // 5. Corner Leg badges with node number (e.g. "A2" over "378")
    legBadges.forEach(b => {
        drawLegAndNodeBadge(doc, b.anchorX, b.anchorY, b.badgeX, b.badgeY, b.legText, b.nodeText);
    });

    // 6. Interior node callouts (node number only), only where a real node number is known
    let interiorShown = 0;
    interiorJoints.forEach(ij => {
        if (interiorShown >= 6) return;
        const nodeText = findWeldNodeNearPoint(ij.pos3, allSource);
        if (!nodeText) return;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(4.3);
        const w = Math.max(6.2, doc.getTextWidth(nodeText) + 2.8);
        const [cx, cy] = placer.place(ij.px, ij.py, w, 2.75, Math.PI / 2);
        drawWeldNodeCallout(doc, ij.px, ij.py, cx, cy, nodeText);
        interiorShown++;
    });

    // 7. Draw 4-point Compass Rose in the bottom-left corner
    drawCompassRose(doc, box.x + 5.2, box.y + box.h - 4.8, 2.3);
};

function drawTarget3D(
    doc: jsPDF,
    view: View,
    target: SketchMember,
    flags: DebrisFlag[],
    project: (p: Vec3) => Pt2,
    mode: "elevation" | "plan",
    drawnTarget: SketchMember = target,
    calloutsOnly = false,
    placer?: LabelPlacer
) {
    const a = view.toPage(...project(drawnTarget.start));
    const b = view.toPage(...project(drawnTarget.end));
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    const pointLike = len < 0.5;
    const cx = (a[0] + b[0]) / 2;
    const cy = (a[1] + b[1]) / 2;
    const ux = len > 1e-4 ? dx / len : 1;
    const uy = len > 1e-4 ? dy / len : 0;

    if (!calloutsOnly) {
        if (isAnodeMember(target)) {
            drawAnodeSymbol(doc, cx, cy, ux, uy, 0.46, "red");
        } else if (isWeldMember(target)) {
            drawJointCollar(doc, cx, cy, ux, uy, 0.50, 0.62, "red");
        } else if (pointLike) {
            drawPlanLegCan(doc, cx, cy, 1.75, "red");
        } else {
            const targetR = isLegMember(target) ? 0.86 : mode === "plan" ? 0.66 : 0.62;
            drawShadedTube(doc, a[0], a[1], b[0], b[1], targetR, "red");
        }
    }

    if (mode === "plan" && !calloutsOnly) return;

    const { perp } = dirAndPerp(a, b);
    const calloutItems = flags.length > 0
        ? flags
        : [{ n: 1, t: 0.5, clockDeg: 0, material: "metallic" as MaterialClass, touching: true, hazardous: false, approx: false, label: target.qid }];

    calloutItems.forEach((f, idx) => {
        const p3 = lerp3(drawnTarget.start, drawnTarget.end, f.t);
        const [px, py] = view.toPage(...project(p3));
        const stagger = idx % 2 === 0 ? 1 : -1;
        const dist = 5.2 + (idx % 3) * 1.4;
        const ox = pointLike ? (idx % 2 === 0 ? 6.5 : -6.5) : perp[0] * dist * stagger + (perp[1] !== 0 ? 2.2 : 0);
        const oy = pointLike ? -5.0 - idx * 3.5 : perp[1] * dist * stagger;

        const tagText = f.label
            ? f.label
            : calloutItems.length === 1
                ? (target.qid || `#${f.n}`)
                : `#${f.n} ${target.qid || ""}`.trim();

        let tcx = px + ox;
        let tcy = py + oy;
        if (placer) {
            const { w, h } = redTagSize(doc, tagText);
            [tcx, tcy] = placer.place(px, py, w, h, Math.atan2(oy, ox));
        }
        drawRedMemberCallout(doc, px, py, tcx, tcy, tagText, view.inner);
    });
}

const fmtM = (v: number) => `${Math.round(v * 100) / 100}`;

/**
 * Member detail: the member unrolled along its own axis (start -> end) with a
 * length scale and numbered flags, plus a clock cross-section on the right.
 */
export const drawMemberDetail = (doc: jsPDF, box: Box, target: SketchMember, flags: DebrisFlag[]) => {
    const len = memberLength(target);
    const crossW = 46;
    const stripBox: Box = { x: box.x, y: box.y + 5, w: box.w - crossW, h: box.h - 5 };

    // Show the higher end on the left so "top" reads left to right
    const swap = target.end[1] > target.start[1] + 0.05;
    const left = swap ? target.end : target.start;
    const right = swap ? target.start : target.end;
    const dispT = (t: number) => (swap ? 1 - t : t);

    const barX0 = stripBox.x + 14;
    const barX1 = stripBox.x + stripBox.w - 14;
    const barY = stripBox.y + stripBox.h * 0.55;
    const barH = 5;

    // 3D-shaded member bar
    drawShadedTube(doc, barX0, barY, barX1, barY, barH / 2, "silver");
    doc.setDrawColor(...BRAND);
    doc.setLineWidth(0.25);
    doc.rect(barX0, barY - barH / 2, barX1 - barX0, barH, "S");

    // scale ticks along the member
    if (len > 0.05) {
        const step = niceStep(len, 6);
        doc.setFontSize(5.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(90, 90, 90);
        doc.setDrawColor(130, 130, 130);
        doc.setLineWidth(0.1);
        for (let d = 0; d <= len + 1e-9; d += step) {
            const x = barX0 + (d / len) * (barX1 - barX0);
            doc.line(x, barY + barH / 2, x, barY + barH / 2 + 1.2);
            doc.text(`${fmtM(d)}m`, x, barY + barH / 2 + 4, { align: "center" });
        }
        doc.setTextColor(0, 0, 0);
    }

    // end labels
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.8);
    doc.setTextColor(...BRAND);
    doc.text(`EL ${fmtM(left[1])}`, barX0 - 1.5, barY - barH / 2 - 1.5, { align: "left" });
    doc.text(`EL ${fmtM(right[1])}`, barX1 + 1.5, barY - barH / 2 - 1.5, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(90, 90, 90);
    doc.text(`Length ${fmtM(len)} m`, (barX0 + barX1) / 2, stripBox.y + stripBox.h - 2, { align: "center" });
    doc.setTextColor(0, 0, 0);

    // flags above the bar, staggered when close together
    const sorted = [...flags].sort((p, q) => dispT(p.t) - dispT(q.t));
    let lastX = -999;
    let lastLevel = 1;
    sorted.forEach(f => {
        const x = barX0 + dispT(f.t) * (barX1 - barX0);
        const level = x - lastX < 6 ? (lastLevel + 1) % 3 : 0;
        lastX = x;
        lastLevel = level;
        const fy = barY - barH / 2 - 5.5 - level * 4.8;
        doc.setDrawColor(120, 120, 120);
        doc.setLineWidth(0.1);
        doc.line(x, barY - barH / 2, x, fy + 2);
        drawFlagMarker(doc, x, fy, f, 2.0);
    });

    // clock cross-section
    const cx = box.x + box.w - crossW / 2;
    const cy = box.y + 5 + (box.h - 5) / 2 - 1;
    const R = 10.5;
    doc.setDrawColor(...BRAND);
    doc.setLineWidth(0.5);
    doc.setFillColor(226, 232, 240);
    doc.circle(cx, cy, R * 0.55, "FD");
    doc.setLineWidth(0.15);
    doc.setDrawColor(140, 140, 140);
    doc.circle(cx, cy, R, "S");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(90, 90, 90);
    ([["12", 0], ["3", 90], ["6", 180], ["9", 270]] as [string, number][]).forEach(([lbl, deg]) => {
        const rad = (deg * Math.PI) / 180;
        const tx = cx + Math.sin(rad) * (R + 4.8);
        const ty = cy - Math.cos(rad) * (R + 4.8) + (deg === 0 ? -0.2 : deg === 180 ? 2.0 : 0.8);
        doc.line(cx + Math.sin(rad) * (R - 1.0), cy - Math.cos(rad) * (R - 1.0), cx + Math.sin(rad) * (R + 1.0), cy - Math.cos(rad) * (R + 1.0));
        doc.text(lbl, tx, ty, { align: "center" });
    });
    doc.setFontSize(5.3);
    doc.text("Clock position", cx, box.y + box.h - 2, { align: "center" });
    doc.setTextColor(0, 0, 0);
    flags.forEach(f => {
        const rad = (f.clockDeg * Math.PI) / 180;
        drawFlagMarker(doc, cx + Math.sin(rad) * R, cy - Math.cos(rad) * R, f, 2.0);
    });
};

/** Legend explaining marker styles and 3D component symbols (HOM, Node Weld, Anode, Anomaly Highlight) */
export const drawFlagLegend = (doc: jsPDF, x: number, y: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.4);
    doc.setTextColor(60, 60, 60);
    let cx = x;
    const sample = (material: MaterialClass, touching: boolean, approx: boolean): DebrisFlag => ({
        n: 0, t: 0, clockDeg: 0, material, touching, hazardous: false, approx
    });
    const item = (flag: DebrisFlag, text: string) => {
        drawFlagMarker(doc, cx + 1.4, y - 0.8, { ...flag, n: 0 }, 1.35);
        // remove the "0" glyph: overdraw with the marker interior
        const color = FLAG_COLORS[flag.material];
        doc.setFillColor(...(flag.touching ? color : ([255, 255, 255] as RGB)));
        doc.circle(cx + 1.4, y - 0.8, 0.9, "F");
        doc.text(text, cx + 3.4, y);
        cx += 3.4 + doc.getTextWidth(text) + 2.4;
    };
    item(sample("metallic", true, false), "Metallic");
    item(sample("non-metallic", true, false), "Non-metallic");
    item(sample("unknown", true, false), "Unclassified");
    item(sample("metallic", true, false), "Filled = touching");
    item(sample("metallic", false, false), "Hollow = not touching");
    item(sample("metallic", false, true), "Dashed = assumed");

    // Component & Anomaly symbol key
    cx += 1.5;
    // HOM Member sample
    drawShadedTube(doc, cx, y - 0.8, cx + 3.6, y - 0.8, 0.42, "silver");
    doc.text("HOM / Brace", cx + 4.4, y);
    cx += 4.4 + doc.getTextWidth("HOM / Brace") + 2.4;

    // Node Weld (WN) sample
    drawShadedTube(doc, cx, y - 0.8, cx + 3.4, y - 0.8, 0.36, "silver");
    drawJointCollar(doc, cx + 1.7, y - 0.8, 1, 0, 0.36, 0.48, "silver");
    doc.text("Node Weld (WN)", cx + 4.2, y);
    cx += 4.2 + doc.getTextWidth("Node Weld (WN)") + 2.4;

    // Anode (AN) sample
    drawShadedTube(doc, cx, y - 0.4, cx + 3.4, y - 0.4, 0.32, "silver");
    drawAnodeSymbol(doc, cx + 1.7, y - 0.4, 1, 0, 0.32, "cyan");
    doc.text("Anode (AN)", cx + 4.2, y);
    cx += 4.2 + doc.getTextWidth("Anode (AN)") + 2.4;

    // Anomaly highlight sample
    drawShadedTube(doc, cx, y - 0.8, cx + 3.4, y - 0.8, 0.48, "amber");
    doc.text("Anomaly Member", cx + 4.2, y);

    doc.setTextColor(0, 0, 0);
};
