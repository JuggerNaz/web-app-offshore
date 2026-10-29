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
 *  - Elevation view  : horizontal axis = x or z, vertical axis = y
 *  - Plan view       : horizontal axis = x, page-down axis = z (looking down)
 *  - Member detail   : the member "unrolled" along its own axis, plus a clock
 *                      cross-section showing the circumferential position
 */
import type { jsPDF } from "jspdf";

export type Vec3 = [number, number, number];
export type RGB = [number, number, number];

export interface SketchMember {
    qid: string;
    code?: string;
    start: Vec3;
    end: Vec3;
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
}

export interface Box {
    x: number;
    y: number;
    w: number;
    h: number;
}

export const FLAG_COLORS: Record<MaterialClass, RGB> = {
    metallic: [220, 38, 38],
    "non-metallic": [245, 158, 11],
    unknown: [100, 116, 139]
};

const BRAND: RGB = [7, 78, 136];
const GRID: RGB = [200, 200, 200];
const CONTEXT: RGB = [190, 196, 205];

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
const makeView = (box: Box, bounds: Bounds, flipV: boolean, padLeft = 0): View => {
    const pad = 4;
    const inner: Box = { x: box.x + pad + padLeft, y: box.y + pad, w: box.w - pad * 2 - padLeft, h: box.h - pad * 2 };
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

export const drawPanelTitle = (doc: jsPDF, box: Box, title: string, printFriendly: boolean) => {
    const h = 5;
    doc.setDrawColor(...GRID);
    doc.setLineWidth(0.1);
    if (printFriendly) {
        doc.setFillColor(240, 240, 240);
        doc.rect(box.x, box.y, box.w, h, "FD");
        doc.setTextColor(...BRAND);
    } else {
        doc.setFillColor(...BRAND);
        doc.rect(box.x, box.y, box.w, h, "FD");
        doc.setTextColor(255, 255, 255);
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(title, box.x + 2, box.y + 3.5);
    doc.setTextColor(0, 0, 0);
    // panel frame
    doc.setDrawColor(...GRID);
    doc.rect(box.x, box.y, box.w, box.h);
};

/** Draw a single numbered marker. Filled = touching, hollow = not touching, dashed = assumed position. */
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

const MARKER_OFFSET = 3.4; // mm, how far a 12/6 o'clock flag sits off the member line

/** Page-space unit direction and an "up-ish" perpendicular for an elevation line */
const dirAndPerp = (a: Pt2, b: Pt2): { dir: Pt2; perp: Pt2 } => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-6) return { dir: [1, 0], perp: [0, -1] };
    const dir: Pt2 = [dx / len, dy / len];
    let perp: Pt2 = [dir[1], -dir[0]];
    if (Math.abs(perp[1]) < 1e-3) perp = [perp[0] >= 0 ? 1 : -1, 0]; // vertical: use +x side
    else if (perp[1] > 0) perp = [-perp[0], -perp[1]]; // make it point page-up
    return { dir, perp };
};

const niceTicks = (min: number, max: number): number[] => {
    const step = niceStep(max - min, 6);
    const out: number[] = [];
    for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
    return out;
};

/** Elevation (side) view: whole structure in grey, target member highlighted, flags on it. */
export const drawElevationView = (
    doc: jsPDF,
    box: Box,
    context: SketchMember[],
    target: SketchMember,
    flags: DebrisFlag[],
    axis: "x" | "z"
) => {
    const pts: Pt2[] = [];
    [...context, target].forEach(m => {
        pts.push(projectElevation(m.start, axis), projectElevation(m.end, axis));
    });
    // always include MSL when the structure crosses or approaches it
    const b0 = boundsOf(pts);
    const bounds: Bounds = { ...b0, maxV: Math.max(b0.maxV, 2) };
    const view = makeView({ x: box.x, y: box.y + 5, w: box.w, h: box.h - 5 }, bounds, true, 8);

    // elevation scale (left) and light horizontal guide lines
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(110, 110, 110);
    doc.setLineWidth(0.05);
    doc.setDrawColor(228, 228, 228);
    niceTicks(bounds.minV, bounds.maxV).forEach(v => {
        const [, py] = view.toPage(bounds.minU, v);
        doc.line(view.inner.x, py, box.x + box.w - 3, py);
        doc.text(`${v}`, view.inner.x - 1, py + 0.8, { align: "right" });
    });
    doc.setTextColor(0, 0, 0);

    // waterline
    const [, wy] = view.toPage(bounds.minU, 0);
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.2);
    (doc as any).setLineDashPattern([1.2, 0.8], 0);
    doc.line(view.inner.x, wy, box.x + box.w - 3, wy);
    (doc as any).setLineDashPattern([], 0);
    doc.setFontSize(5.5);
    doc.setTextColor(59, 130, 246);
    doc.text("MSL", box.x + box.w - 4, wy - 0.8, { align: "right" });
    doc.setTextColor(0, 0, 0);

    // context members
    doc.setDrawColor(...CONTEXT);
    doc.setLineWidth(0.12);
    context.forEach(m => {
        if (isPointMember(m)) return;
        const a = view.toPage(...projectElevation(m.start, axis));
        const b = view.toPage(...projectElevation(m.end, axis));
        doc.line(a[0], a[1], b[0], b[1]);
    });

    drawTarget(doc, view, target, flags, (p) => projectElevation(p, axis), "elevation");
    doc.setFontSize(5.5);
    doc.setTextColor(110, 110, 110);
    doc.text(`View axis: ${axis.toUpperCase()}  |  Elevation in m`, box.x + 2, box.y + box.h - 1.5);
    doc.setTextColor(0, 0, 0);
};

/** Plan (top) view */
export const drawPlanView = (
    doc: jsPDF,
    box: Box,
    context: SketchMember[],
    target: SketchMember,
    flags: DebrisFlag[]
) => {
    const pts: Pt2[] = [];
    [...context, target].forEach(m => pts.push(projectPlan(m.start), projectPlan(m.end)));
    const bounds = boundsOf(pts);
    const view = makeView({ x: box.x, y: box.y + 5, w: box.w, h: box.h - 5 }, bounds, false);

    doc.setDrawColor(...CONTEXT);
    doc.setLineWidth(0.12);
    context.forEach(m => {
        if (isPointMember(m)) return;
        const a = view.toPage(...projectPlan(m.start));
        const b = view.toPage(...projectPlan(m.end));
        if (Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01) {
            doc.circle(a[0], a[1], 0.5, "S"); // vertical member seen end-on
        } else {
            doc.line(a[0], a[1], b[0], b[1]);
        }
    });

    drawTarget(doc, view, target, flags, projectPlan, "plan");

    // north-less orientation hint
    doc.setFontSize(5.5);
    doc.setTextColor(110, 110, 110);
    doc.text("Plan view (looking down)  |  +X -> right, +Z -> down", box.x + 2, box.y + box.h - 1.5);
    doc.setTextColor(0, 0, 0);
};

function drawTarget(
    doc: jsPDF,
    view: View,
    target: SketchMember,
    flags: DebrisFlag[],
    project: (p: Vec3) => Pt2,
    mode: "elevation" | "plan"
) {
    const a = view.toPage(...project(target.start));
    const b = view.toPage(...project(target.end));
    const pointLike = Math.abs(a[0] - b[0]) < 0.4 && Math.abs(a[1] - b[1]) < 0.4;

    doc.setDrawColor(...BRAND);
    doc.setLineWidth(0.9);
    if (pointLike) {
        doc.setFillColor(...BRAND);
        doc.circle((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 1.3, "FD");
    } else {
        doc.line(a[0], a[1], b[0], b[1]);
        doc.setFillColor(...BRAND);
        doc.circle(a[0], a[1], 0.7, "F");
        doc.circle(b[0], b[1], 0.7, "F");
    }

    // QID label next to the member
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(...BRAND);
    const label = target.qid;
    const tw = doc.getTextWidth(label);
    const lx = Math.min(Math.max(mx + 4, view.inner.x), view.inner.x + view.inner.w - tw);
    const ly = Math.min(Math.max(my - 6, view.inner.y + 2), view.inner.y + view.inner.h - 2);
    doc.text(label, lx, ly);
    doc.setTextColor(0, 0, 0);

    const { perp } = dirAndPerp(a, b);
    flags.forEach(f => {
        const p3 = lerp3(target.start, target.end, f.t);
        const [px, py] = view.toPage(...project(p3));
        const rad = (f.clockDeg * Math.PI) / 180;
        let ox = 0;
        let oy = 0;
        if (pointLike) {
            // member seen end-on: spread flags around a circle
            ox = Math.sin(rad) * MARKER_OFFSET;
            oy = -Math.cos(rad) * MARKER_OFFSET;
        } else if (mode === "elevation") {
            // top (12) / bottom (6) show as above/below the member line
            ox = perp[0] * Math.cos(rad) * MARKER_OFFSET;
            oy = perp[1] * Math.cos(rad) * MARKER_OFFSET;
        } else {
            // plan: 3/9 o'clock show as left/right of the member line
            ox = perp[0] * Math.sin(rad) * MARKER_OFFSET;
            oy = perp[1] * Math.sin(rad) * MARKER_OFFSET;
        }
        // leader from the member to the marker
        if (Math.abs(ox) + Math.abs(oy) > 0.1) {
            doc.setDrawColor(120, 120, 120);
            doc.setLineWidth(0.1);
            doc.line(px, py, px + ox, py + oy);
        } else {
            // marker sits on the line, nudge so number stays readable
            ox = 0;
            oy = -MARKER_OFFSET * 0.55;
        }
        drawFlagMarker(doc, px + ox, py + oy, f, 2.0);
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

    // member bar
    doc.setFillColor(226, 232, 240);
    doc.setDrawColor(...BRAND);
    doc.setLineWidth(0.4);
    doc.rect(barX0, barY - barH / 2, barX1 - barX0, barH, "FD");

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

/** One-line legend explaining marker styles */
export const drawFlagLegend = (doc: jsPDF, x: number, y: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(60, 60, 60);
    let cx = x;
    const sample = (material: MaterialClass, touching: boolean, approx: boolean): DebrisFlag => ({
        n: 0, t: 0, clockDeg: 0, material, touching, hazardous: false, approx
    });
    const item = (flag: DebrisFlag, text: string) => {
        drawFlagMarker(doc, cx + 1.6, y - 0.8, { ...flag, n: 0 }, 1.5);
        // remove the "0" glyph: overdraw with the marker interior
        const color = FLAG_COLORS[flag.material];
        doc.setFillColor(...(flag.touching ? color : ([255, 255, 255] as RGB)));
        doc.circle(cx + 1.6, y - 0.8, 1.0, "F");
        doc.text(text, cx + 4, y);
        cx += 4 + doc.getTextWidth(text) + 3.5;
    };
    item(sample("metallic", true, false), "Metallic");
    item(sample("non-metallic", true, false), "Non-metallic");
    item(sample("unknown", true, false), "Unclassified");
    item(sample("metallic", true, false), "Filled = touching / in contact");
    item(sample("metallic", false, false), "Hollow = not touching");
    item(sample("metallic", false, true), "Dashed = position assumed");
    doc.setTextColor(0, 0, 0);
};
