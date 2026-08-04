import * as THREE from 'three';

interface FaceSketchOptions {
    platformTitle: string;
    faceName: string;
    layouts: any[];
    foundationMembers: any[];
    elevations: any[];
    faces: any[];
}

const sanitizeElevation = (elvVal: any): number => {
    if (elvVal === undefined || elvVal === null) return 0;
    let val = typeof elvVal === "number" ? elvVal : parseFloat(elvVal);
    if (isNaN(val)) return 0;
    if (val === 50.772) return -50.772; // Fix 50m spike typo
    if (val < -1000) return val / 1000;
    return val;
};

function getLegEndpoints(layout: any) {
    const compObj = layout.component || layout.originalComp || layout.structure_components || {};
    const md = compObj.metadata || layout.metadata || compObj || {};

    let sLeg = (md.s_leg || compObj.s_leg || layout.s_leg || md.leg || compObj.leg || "").toString().toUpperCase().trim();
    let fLeg = (md.f_leg || compObj.f_leg || layout.f_leg || "").toString().toUpperCase().trim();

    if (!sLeg) {
        const sNode = (md.s_node || compObj.s_node || layout.s_node || "").toString().toUpperCase().trim();
        const m = sNode.match(/([A-Z]+\d+)/);
        if (m) sLeg = m[1];
    }
    if (!fLeg) {
        const fNode = (md.f_node || compObj.f_node || layout.f_node || "").toString().toUpperCase().trim();
        const m = fNode.match(/([A-Z]+\d+)/);
        if (m) fLeg = m[1];
    }

    const qId = (layout.q_id || compObj.q_id || md.q_id || layout.id || "").toString().toUpperCase().trim();
    if (!sLeg || !fLeg) {
        const legsInQId = qId.match(/\b([A-Z]+\d+)\b/g);
        if (legsInQId && legsInQId.length >= 1) {
            if (!sLeg) sLeg = legsInQId[0];
            if (!fLeg && legsInQId.length >= 2) fLeg = legsInQId[1];
        }
    }

    const compFace = (md.face || compObj.face || layout.face || "").toString().toUpperCase().trim();

    return { sLeg, fLeg, compFace, qId, compObj, md };
}

function checkComponentOnFace(layout: any, faceName: string, faces: any[] = []): boolean {
    const fUpper = faceName.toUpperCase().trim();
    const cleanFace = fUpper.replace(/^ROW\s*|^FACE\s*/i, "").trim();

    const { sLeg, fLeg, compFace, compObj } = getLegEndpoints(layout);
    const code = (layout.code || compObj.code || "").toUpperCase().trim();
    const labelUpper = (layout.q_id || layout.label || layout.id || "").toString().toUpperCase();

    // 0. Purge Risers, Conductors, J-Tubes, Internal Appurtenances & Anodes
    const isInternalAppurtenance =
        code === "RS" || code === "CO" || code === "JT" || code === "AN" || code === "APP" ||
        labelUpper.includes("RISER") || labelUpper.includes("CONDUCTOR") || labelUpper.includes("JTUBE") || labelUpper.includes("ANODE");

    if (isInternalAppurtenance) {
        return false;
    }

    // 1. Explicit Component Specifications FACE Field Check
    if (compFace) {
        const cleanCompFace = compFace.replace(/^ROW\s*|^FACE\s*/i, "").trim();
        const isDirectMatch =
            compFace === fUpper ||
            cleanCompFace === cleanFace ||
            compFace.includes(cleanFace) ||
            fUpper.includes(cleanCompFace);

        if (isDirectMatch) return true;
    }

    // Determine if searching for a Column Number (e.g. ROW 2, FACE 2, 2) or Row Letter (e.g. ROW A, FACE A, A)
    const isColNumberSearch = /^(?:ROW|FACE)\s*\d+$/i.test(fUpper) || /^\d+$/i.test(fUpper);

    if (isColNumberSearch) {
        const colNum = cleanFace;
        // Matches if both legs belong to this column (e.g. A2 and B2 for ROW 2)
        if (sLeg && fLeg && sLeg !== fLeg) {
            if (sLeg.endsWith(colNum) && fLeg.endsWith(colNum)) return true;
            const sEnds = (sLeg.match(/\d+$/) || [])[0];
            const fEnds = (fLeg.match(/\d+$/) || [])[0];
            if (sEnds === colNum && fEnds === colNum) return true;
        } else if (sLeg || fLeg) {
            const singleLeg = sLeg || fLeg;
            if (singleLeg.endsWith(colNum) && !singleLeg.includes("-")) return true;
            const ends = (singleLeg.match(/\d+$/) || [])[0];
            if (ends === colNum) return true;
        }

        if (
            labelUpper.includes(`-${colNum}`) ||
            labelUpper.includes(`${colNum}-`) ||
            labelUpper.includes(`LEG-${colNum}`) ||
            labelUpper.includes(`ROW ${colNum}`) ||
            labelUpper.includes(`FACE ${colNum}`) ||
            labelUpper.includes(`A${colNum}`) ||
            labelUpper.includes(`B${colNum}`) ||
            labelUpper.includes(`C${colNum}`) ||
            labelUpper.includes(`D${colNum}`)
        ) {
            const legMatches = labelUpper.match(/[A-Z]+\d+/g);
            if (legMatches && legMatches.length >= 2) {
                if (legMatches.every((m: string) => m.endsWith(colNum))) return true;
            } else if (legMatches && legMatches.length === 1) {
                if (legMatches[0].endsWith(colNum)) return true;
            } else {
                return true;
            }
        }
    } else {
        const rowLetter = cleanFace;
        // Matches if both legs belong to this row letter (e.g. B1 and B2 for ROW B)
        if (sLeg && fLeg && sLeg !== fLeg) {
            if (sLeg.startsWith(rowLetter) && fLeg.startsWith(rowLetter)) return true;
        } else if (sLeg || fLeg) {
            const singleLeg = sLeg || fLeg;
            if (singleLeg.startsWith(rowLetter) && !singleLeg.includes("-")) return true;
        }

        if (
            labelUpper.includes(`LEG-${rowLetter}`) ||
            labelUpper.includes(`ROW ${rowLetter}`) ||
            labelUpper.includes(`FACE ${rowLetter}`) ||
            labelUpper.includes(`${rowLetter}1`) ||
            labelUpper.includes(`${rowLetter}2`) ||
            labelUpper.includes(`${rowLetter}3`) ||
            labelUpper.includes(`${rowLetter}4`)
        ) {
            const legMatches = labelUpper.match(/[A-Z]+\d+/g);
            if (legMatches && legMatches.length >= 2) {
                if (legMatches.every((m: string) => m.startsWith(rowLetter))) return true;
            } else if (legMatches && legMatches.length === 1) {
                if (legMatches[0].startsWith(rowLetter)) return true;
            } else {
                return true;
            }
        }
    }

    // Check Node Welds attached to target legs
    if (code === "WN" || code === "WP" || labelUpper.includes("WN")) {
        if (isColNumberSearch) {
            if ((sLeg && sLeg.endsWith(cleanFace)) || (fLeg && fLeg.endsWith(cleanFace))) return true;
            if (labelUpper.includes(`A${cleanFace}`) || labelUpper.includes(`B${cleanFace}`) || labelUpper.includes(`C${cleanFace}`)) return true;
        } else {
            if ((sLeg && sLeg.startsWith(cleanFace)) || (fLeg && fLeg.startsWith(cleanFace))) return true;
            if (labelUpper.includes(`${cleanFace}1`) || labelUpper.includes(`${cleanFace}2`) || labelUpper.includes(`${cleanFace}3`)) return true;
        }
    }

    // Check str_faces object definition from DB
    if (Array.isArray(faces)) {
        const faceObj = faces.find(
            (f) => (f.face || "").toUpperCase().trim() === fUpper || (f.face || "").toUpperCase().trim() === cleanFace
        );
        if (faceObj) {
            const fromLeg = (faceObj.face_from || "").toUpperCase().trim();
            const toLeg = (faceObj.face_to || "").toUpperCase().trim();

            if (fromLeg && toLeg) {
                if ((sLeg === fromLeg && fLeg === toLeg) || (sLeg === toLeg && fLeg === fromLeg)) {
                    return true;
                }
            }
        }
    }

    return false;
}

export function generate2DFaceSketchSVG({
    platformTitle,
    faceName,
    layouts = [],
    foundationMembers = [],
    elevations = [],
    faces = [],
}: FaceSketchOptions): string {
    const fUpper = (faceName || "FACE A").toUpperCase().trim();
    const cleanFace = fUpper.replace(/^ROW\s*|^FACE\s*/i, "").trim();

    const getVector3D = (item: any, isEnd: boolean = false): number[] => {
        if (isEnd) {
            if (Array.isArray(item.end) && item.end.length >= 3) return item.end;
            if (item.end_x !== undefined && item.end_y !== undefined && item.end_z !== undefined) {
                return [Number(item.end_x), Number(item.end_y), Number(item.end_z)];
            }
            if (Array.isArray(item.endVec) && item.endVec.length >= 3) return item.endVec;
        } else {
            if (Array.isArray(item.start) && item.start.length >= 3) return item.start;
            if (item.start_x !== undefined && item.start_y !== undefined && item.start_z !== undefined) {
                return [Number(item.start_x), Number(item.start_y), Number(item.start_z)];
            }
            if (Array.isArray(item.startVec) && item.startVec.length >= 3) return item.startVec;
        }

        if (Array.isArray(item.position) && item.position.length >= 3) return item.position;
        if (item.pos_x !== undefined && item.pos_y !== undefined && item.pos_z !== undefined) {
            return [Number(item.pos_x), Number(item.pos_y), Number(item.pos_z)];
        }
        return [0, 0, 0];
    };

    // 1. Identify Foundation Leg Members for the Selected Face
    const isColNumberSearch = /^(?:ROW|FACE)\s*\d+$/i.test(fUpper) || /^\d+$/i.test(fUpper);

    let faceFoundation = foundationMembers.filter((m) => {
        const labelUpper = (m.label || m.id || "").toString().toUpperCase();
        if (isColNumberSearch) {
            return labelUpper.endsWith(cleanFace) || labelUpper.includes(`-${cleanFace}`);
        } else {
            return labelUpper.startsWith(`LEG-${cleanFace}`) || labelUpper.includes(`ROW ${cleanFace}`) || labelUpper.includes(`FACE ${cleanFace}`);
        }
    });

    if (faceFoundation.length === 0) {
        faceFoundation = foundationMembers;
    }

    // 2. Determine Principal Face Plane 3D Geometry
    const foundationCoords = faceFoundation.flatMap((item) => [
        getVector3D(item, false),
        getVector3D(item, true),
    ]);

    let xSpan = 0, zSpan = 0;
    let avgX = 0, avgZ = 0;

    if (foundationCoords.length > 0) {
        const xVals = foundationCoords.map((c) => c[0]).filter(isFinite);
        const zVals = foundationCoords.map((c) => c[2]).filter(isFinite);
        if (xVals.length > 0 && zVals.length > 0) {
            xSpan = Math.max(...xVals) - Math.min(...xVals);
            zSpan = Math.max(...zVals) - Math.min(...zVals);
            avgX = xVals.reduce((a, b) => a + b, 0) / xVals.length;
            avgZ = zVals.reduce((a, b) => a + b, 0) / zVals.length;
        }
    }
    const runsAlongX = xSpan >= zSpan;
    const facePlanePos = runsAlongX ? avgZ : avgX;

    // 3. Filter Components That Belong To This Face
    const isComponentOnFacePlane = (item: any) => {
        const code = (item.code || item.component?.code || "").toUpperCase().trim();
        const labelUpper = (item.q_id || item.label || item.id || "").toString().toUpperCase();

        // Purge Risers, Conductors, J-Tubes, Internal Appurtenances & Anodes
        if (
            code === "RS" || code === "CO" || code === "JT" || code === "AN" || code === "APP" ||
            labelUpper.includes("RISER") || labelUpper.includes("CONDUCTOR") || labelUpper.includes("JTUBE") || labelUpper.includes("ANODE")
        ) {
            return false;
        }

        // Check if explicitly matching face endpoints / labels
        if (checkComponentOnFace(item, faceName, faces)) {
            return true;
        }

        // Fallback: 3D physical distance check
        const s = getVector3D(item, false);
        const e = getVector3D(item, true);
        const midPos = runsAlongX ? (s[2] + e[2]) / 2 : (s[0] + e[0]) / 2;

        const dist = Math.abs(midPos - facePlanePos);
        return dist <= 4.0;
    };

    const faceLayouts = layouts.filter(isComponentOnFacePlane);

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    const rawLines: Array<{
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        label: string;
        code: string;
        isLeg: boolean;
        isWeld: boolean;
        isAnode: boolean;
        thickness: number;
        od?: string;
        wt?: string;
    }> = [];

    const addLine = (start: number[], end: number[], label: string, code: string, thickness: number = 0.3, isLeg: boolean = false, itemObj?: any) => {
        if (!start || !end || start.length < 3 || end.length < 3) return;
        const [sx, sy, sz] = start;
        const [ex, ey, ez] = end;

        if ([sx, sy, sz, ex, ey, ez].some((v) => !isFinite(v))) return;

        const x1 = runsAlongX ? sx : sz;
        const x2 = runsAlongX ? ex : ez;
        const y1 = sy;
        const y2 = ey;

        minX = Math.min(minX, x1, x2);
        maxX = Math.max(maxX, x1, x2);
        minY = Math.min(minY, y1, y2);
        maxY = Math.max(maxY, y1, y2);

        const upperCode = (code || "").toUpperCase();
        const md = itemObj?.metadata || itemObj?.component?.metadata || {};
        
        const od = md.od || md.diameter || (thickness ? (thickness * 2000).toFixed(0) : undefined);
        const wt = md.wt || md.wall_thickness || "15";

        rawLines.push({
            x1, y1, x2, y2,
            label,
            code: upperCode,
            isLeg,
            isWeld: upperCode === "WN" || upperCode === "WP" || upperCode.includes("WELD"),
            isAnode: upperCode === "AN" || upperCode.includes("ANODE"),
            thickness,
            od,
            wt
        });
    };

    // Add foundation members (Legs / Rows)
    faceFoundation.forEach((m) => {
        const s = getVector3D(m, false);
        const e = getVector3D(m, true);
        addLine(s, e, m.label || "", "LEG", m.thickness || 0.8, true, m);
    });

    // Add component layouts belonging to selected face
    faceLayouts.forEach((l) => {
        const s = getVector3D(l, false);
        const e = getVector3D(l, true);
        addLine(s, e, l.q_id || l.code || "", l.code || "", l.thickness || 0.3, false, l);
    });

    if (!isFinite(minX)) { minX = -15; maxX = 15; }
    if (!isFinite(minY)) { minY = -50; maxY = 10; }

    const marginX = Math.max((maxX - minX) * 0.25, 6);
    const marginY = Math.max((maxY - minY) * 0.12, 6);

    const viewMinX = minX - marginX;
    const viewMaxX = maxX + marginX;
    const viewMinY = minY - marginY;
    const viewMaxY = maxY + marginY;

    const svgWidth = 900;
    const svgHeight = 1150;
    const leftPad = 250;  // Padding for left-side elevation labels (EL (-) XX.XXXM)
    const rightPad = 100;
    const topPad = 120;   // Padding for top leg column indicators (A) (B)
    const bottomPad = 120; // Padding for bottom title (ELEVATION ROW A-B)

    const mapX = (val: number) => leftPad + ((val - viewMinX) / (viewMaxX - viewMinX)) * (svgWidth - leftPad - rightPad);
    const mapY = (val: number) => (svgHeight - bottomPad) - ((val - viewMinY) / (viewMaxY - viewMinY)) * (svgHeight - topPad - bottomPad);

    // 3. Extract & Sort Selected Platform Elevations (Sanitized)
    const sortedElevations = Array.from(new Set(
        elevations
            .map((e) => typeof e === "number" ? sanitizeElevation(e) : sanitizeElevation(e?.elv))
            .filter((v) => isFinite(v))
    )).sort((a, b) => b - a);

    // Fallback if elevations array empty: extract from member height levels
    if (sortedElevations.length === 0) {
        const lineYVals = rawLines.flatMap((l) => [l.y1, l.y2]);
        const extracted = Array.from(new Set(lineYVals.map((y) => Number(y.toFixed(2)))));
        sortedElevations.push(...extracted);
    }
    sortedElevations.sort((a, b) => b - a);

    // Format CAD Elevation String (e.g. EL (+) 6.150M, MSL (+) 0.000M, EL (-) 24.870M)
    const formatElevString = (elv: number) => {
        const absVal = Math.abs(elv).toFixed(3);
        if (Math.abs(elv) < 0.01) {
            return "MSL  (+)  0.000M";
        }
        const sign = elv >= 0 ? "(+)" : "(-)";
        return `EL  ${sign}  ${absVal}M`;
    };

    let svgContent = "";

    // 4. Render Left-Side Selected Platform Elevation Datum Axis & Horizontal Lines
    sortedElevations.forEach((elv) => {
        if (elv >= viewMinY && elv <= viewMaxY) {
            const py = mapY(elv);
            const textStr = formatElevString(elv);
            const isMSL = Math.abs(elv) < 0.01;

            svgContent += `
                <!-- Elevation Datum Line -->
                <line x1="${leftPad - 180}" y1="${py}" x2="${leftPad - 20}" y2="${py}" stroke="#000000" stroke-width="1.5" />
                <text x="${leftPad - 180}" y="${py - 8}" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="bold" fill="#000000">${textStr}</text>
            `;

            if (isMSL) {
                // MSL Water Surface Hatched Symbol
                svgContent += `
                    <polygon points="${leftPad - 110},${py} ${leftPad - 100},${py + 10} ${leftPad - 90},${py}" fill="#000000" />
                    <line x1="${leftPad - 115}" y1="${py + 13}" x2="${leftPad - 85}" y2="${py + 13}" stroke="#000000" stroke-width="1.5" />
                    <line x1="${leftPad - 108}" y1="${py + 17}" x2="${leftPad - 92}" y2="${py + 17}" stroke="#000000" stroke-width="1.5" />
                `;
            }
        }
    });

    // 5. Cluster Node Joints for Selected Face Node Welds & Joint Intersections
    const nodeMap = new Map<string, { x: number; y: number; idNum: string; count: number }>();

    const parseNodeNumber = (labelStr: string) => {
        if (!labelStr) return "";
        const clean = labelStr.trim();
        // Extract numeric part (e.g. WN N27 -> 27, BEP-A WN N27 -> 27, N27 -> 27, WN27 -> 27)
        const m = clean.match(/(?:WN\s*|N)?(\d+)/i);
        if (m) return m[1];
        return clean.replace(/^[^\d]+/, "");
    };

    const registerNode = (x: number, y: number, nodeLabel?: string) => {
        const key = `${x.toFixed(1)}_${y.toFixed(1)}`;
        const cleanTag = parseNodeNumber(nodeLabel || "");

        if (nodeMap.has(key)) {
            const existing = nodeMap.get(key)!;
            existing.count += 1;
            if (cleanTag && !existing.idNum) {
                existing.idNum = cleanTag;
            }
            return existing;
        }

        const nodeObj = { x, y, idNum: cleanTag, count: 1 };
        nodeMap.set(key, nodeObj);
        return nodeObj;
    };

    // 6. Draw Structural Lines & Specifications
    const legs = rawLines.filter((l) => l.isLeg);
    const welds = rawLines.filter((l) => l.isWeld);
    const members = rawLines.filter((l) => !l.isLeg && !l.isWeld);

    // Register Node Welds belonging strictly to selected face
    welds.forEach((line) => {
        const nodeTag = line.label || line.code || "";
        registerNode(line.x1, line.y1, nodeTag);
        registerNode(line.x2, line.y2, nodeTag);
    });

    legs.forEach((line) => {
        const sx = mapX(line.x1);
        const sy = mapY(line.y1);
        const ex = mapX(line.x2);
        const ey = mapY(line.y2);

        registerNode(line.x1, line.y1);
        registerNode(line.x2, line.y2);

        const dx = ex - sx;
        const dy = ey - sy;
        const len = Math.hypot(dx, dy);
        const nx = len > 0.001 ? (-dy / len) * 4 : 4;
        const ny = len > 0.001 ? (dx / len) * 4 : 0;

        svgContent += `
            <!-- Double Tubular Leg Lines -->
            <line x1="${sx + nx}" y1="${sy + ny}" x2="${ex + nx}" y2="${ey + ny}" stroke="#000000" stroke-width="2.5" />
            <line x1="${sx - nx}" y1="${sy - ny}" x2="${ex - nx}" y2="${ey - ny}" stroke="#000000" stroke-width="2.5" />
        `;
    });

    // Render Members & Diagonal Braces for selected face
    members.forEach((line) => {
        const sx = mapX(line.x1);
        const sy = mapY(line.y1);
        const ex = mapX(line.x2);
        const ey = mapY(line.y2);

        registerNode(line.x1, line.y1);
        registerNode(line.x2, line.y2);

        // Solid structural line
        svgContent += `
            <line x1="${sx}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="#000000" stroke-width="2" />
        `;

        const specText = line.od ? `ø${line.od}x${line.wt} WT` : line.label;
        const isExcludedSpec = specText.includes("600x15") || specText.includes("600");

        if (specText && !isExcludedSpec && Math.hypot(ex - sx, ey - sy) > 35) {
            const mx = (sx + ex) / 2;
            const my = (sy + ey) / 2;

            let angleDeg = (Math.atan2(ey - sy, ex - sx) * 180) / Math.PI;
            if (angleDeg > 90 || angleDeg < -90) {
                angleDeg += 180;
            }

            svgContent += `
                <g transform="translate(${mx}, ${my}) rotate(${angleDeg})">
                    <text x="0" y="-6" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="bold" fill="#000000" stroke="#ffffff" stroke-width="2.5" paint-order="stroke fill">${specText}</text>
                </g>
            `;
        }
    });

    // 7. Render Node Welds & Joints (Always displaying extracted number inside black circle badge)
    nodeMap.forEach((node) => {
        if (node.count < 2 && !node.idNum) return;

        const nx = mapX(node.x);
        const ny = mapY(node.y);
        const numStr = node.idNum ? parseNodeNumber(node.idNum) : "";

        if (numStr) {
            const r = numStr.length >= 3 ? 10 : 8.5;
            svgContent += `
                <!-- Node Weld Black Circle Badge with White Centered Number -->
                <circle cx="${nx}" cy="${ny}" r="${r}" fill="#000000" stroke="#ffffff" stroke-width="1" />
                <text x="${nx}" y="${ny}" text-anchor="middle" dominant-baseline="central" font-family="Arial, Helvetica, sans-serif" font-size="${numStr.length >= 3 ? 8 : 9.5}" font-weight="bold" fill="#ffffff">${numStr}</text>
            `;
        } else {
            svgContent += `
                <!-- Node Joint Dark Circle Indicator -->
                <circle cx="${nx}" cy="${ny}" r="4.5" fill="#000000" stroke="#ffffff" stroke-width="0.75" />
            `;
        }
    });

    // 8. Top Column Leg Axis Callout Circles (Positioned DIRECTLY on top of left & right leg tops)
    const midX_Boundary = (minX + maxX) / 2;

    const leftLegEndpoints: Array<{ x: number; y: number }> = [];
    const rightLegEndpoints: Array<{ x: number; y: number }> = [];

    legs.forEach((l) => {
        if (l.x1 <= midX_Boundary) leftLegEndpoints.push({ x: l.x1, y: l.y1 });
        if (l.x2 <= midX_Boundary) leftLegEndpoints.push({ x: l.x2, y: l.y2 });
        if (l.x1 > midX_Boundary) rightLegEndpoints.push({ x: l.x1, y: l.y1 });
        if (l.x2 > midX_Boundary) rightLegEndpoints.push({ x: l.x2, y: l.y2 });
    });

    // Fallback to nodeMap if legs array empty
    if (leftLegEndpoints.length === 0 || rightLegEndpoints.length === 0) {
        nodeMap.forEach((node) => {
            if (node.x <= midX_Boundary) leftLegEndpoints.push({ x: node.x, y: node.y });
            else rightLegEndpoints.push({ x: node.x, y: node.y });
        });
    }

    // Pick top (highest y elevation) endpoint for left and right legs
    leftLegEndpoints.sort((a, b) => b.y - a.y);
    rightLegEndpoints.sort((a, b) => b.y - a.y);

    const topLeftLeg = leftLegEndpoints[0] || { x: minX, y: maxY };
    const topRightLeg = rightLegEndpoints[0] || { x: maxX, y: maxY };

    const topLegA_X = mapX(topLeftLeg.x);
    const topLegA_Y = mapY(topLeftLeg.y);
    const topLegB_X = mapX(topRightLeg.x);
    const topLegB_Y = mapY(topRightLeg.y);

    const circleY = topPad - 45;

    // Resolve clean column/row indicators (e.g. 1 & 2 for ROW B; A & B for ROW 2)
    const isRowLetter = /^(?:ROW|FACE)\s*[A-Z]+$/i.test(fUpper) || /^[A-Z]+$/i.test(fUpper);
    const cleanVal = fUpper.replace(/^ROW\s*|^FACE\s*/i, "").trim();

    const leftLabel = isRowLetter ? `${cleanVal}1` : `A${cleanVal}`;
    const rightLabel = isRowLetter ? `${cleanVal}2` : `B${cleanVal}`;

    svgContent += `
        <!-- Top Left Leg Column Axis Circle (Stops at Top of Left Leg) -->
        <line x1="${topLegA_X}" y1="${circleY + 16}" x2="${topLegA_X}" y2="${topLegA_Y}" stroke="#000000" stroke-width="1.5" stroke-dasharray="3,3" />
        <circle cx="${topLegA_X}" cy="${circleY}" r="16" fill="#ffffff" stroke="#000000" stroke-width="2" />
        <text x="${topLegA_X}" y="${circleY + 6}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="bold" fill="#000000">${leftLabel}</text>

        <!-- Top Right Leg Column Axis Circle (Stops at Top of Right Leg) -->
        <line x1="${topLegB_X}" y1="${circleY + 16}" x2="${topLegB_X}" y2="${topLegB_Y}" stroke="#000000" stroke-width="1.5" stroke-dasharray="3,3" />
        <circle cx="${topLegB_X}" cy="${circleY}" r="16" fill="#ffffff" stroke="#000000" stroke-width="2" />
        <text x="${topLegB_X}" y="${circleY + 6}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="bold" fill="#000000">${rightLabel}</text>
    `;

    // 9. Bottom Title (ELEVATION ROW A-B)
    const titleText = `ELEVATION ${fUpper.includes("ROW") || fUpper.includes("FACE") ? fUpper : `ROW ${fUpper}`}`;

    return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" height="100%" style="background-color: #ffffff;">
            <g id="cad-elevation-diagram">
                ${svgContent}
            </g>

            <!-- Centered Underlined Bottom Title -->
            <g transform="translate(${svgWidth / 2}, ${svgHeight - 40})">
                <text x="0" y="0" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="bold" fill="#000000" letter-spacing="1.5">${titleText.toUpperCase()}</text>
                <line x1="-120" y1="8" x2="120" y2="8" stroke="#000000" stroke-width="2" />
            </g>
        </svg>
    `;
}

export function generate2DFaceSketchHTML(options: FaceSketchOptions): string {
    const svgCode = generate2DFaceSketchSVG(options);

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${options.platformTitle} - ${options.faceName} Elevation Drawing</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 10mm;
        }
        body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            font-family: Arial, Helvetica, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
        }
        .sketch-container {
            width: 100%;
            max-width: 850px;
            height: auto;
            box-sizing: border-box;
        }
        @media print {
            body {
                background: none;
                display: block;
            }
            .sketch-container {
                width: 100vw;
                height: 98vh;
                max-width: none;
            }
        }
    </style>
</head>
<body>
    <div class="sketch-container">
        ${svgCode}
    </div>
</body>
</html>`;
}
