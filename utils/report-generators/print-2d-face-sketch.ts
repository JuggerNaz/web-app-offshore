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
    const labelUpper = String(layout.q_id || compObj.q_id || layout.label || layout.id || "").toUpperCase();

    // 0. Purge Risers, Conductors, J-Tubes, Internal Appurtenances & Anodes
    const isInternalAppurtenance =
        code === "RS" || code === "CO" || code === "JT" || code === "AN" || code === "APP" ||
        labelUpper.includes("RISER") || labelUpper.includes("CONDUCTOR") || labelUpper.includes("JTUBE") || labelUpper.includes("ANODE");

    if (isInternalAppurtenance) {
        return false;
    }

    // 1. Explicit Component Specifications FACE Field Check (if specified)
    if (compFace) {
        if (compFace === "N/A" || compFace === "NA" || compFace === "NONE") {
            return fUpper === compFace;
        }

        const compFacesArray = compFace.split(',').map((f: string) => f.trim()).filter(Boolean);
        
        const isMatch = compFacesArray.some((cf: string) => {
            const cleanCompFace = cf.replace(/^ROW\s*|^FACE\s*/i, "").trim();
            return cf === fUpper || cleanCompFace === cleanFace || cf.includes(cleanFace) || fUpper.includes(cleanCompFace);
        });

        if (isMatch) {
            return true;
        } else {
            // Explicitly assigned to a different face -> hide component
            return false;
        }
    }

    // 2. Strict Row Letter match (e.g. "ROW A", "FACE A", "A") for unassigned components
    const rowMatch = fUpper.match(/^(?:ROW|FACE)\s*([A-Z]+)$/i) || fUpper.match(/^([A-Z]+)$/i);
    if (rowMatch) {
        const rowLetter = rowMatch[1].toUpperCase();

        if (sLeg && fLeg && sLeg !== fLeg) {
            if (sLeg.startsWith(rowLetter) && fLeg.startsWith(rowLetter)) return true;
            if (sLeg.startsWith(rowLetter) || fLeg.startsWith(rowLetter)) return false;
        } else if (sLeg || fLeg) {
            const singleLeg = sLeg || fLeg;
            if (singleLeg.startsWith(rowLetter)) return true;
        }
    }

    // 3. Strict Column Number match (e.g. "ROW 1", "FACE 1", "1") for unassigned components
    const colMatch = fUpper.match(/^(?:ROW|FACE)\s*(\d+)$/i) || fUpper.match(/^(\d+)$/i);
    if (colMatch) {
        const colNum = colMatch[1].toUpperCase();

        if (sLeg && fLeg && sLeg !== fLeg) {
            if (sLeg.endsWith(colNum) && fLeg.endsWith(colNum)) return true;
            if (sLeg.endsWith(colNum) || fLeg.endsWith(colNum)) return false;
        } else if (sLeg || fLeg) {
            const singleLeg = sLeg || fLeg;
            if (singleLeg.endsWith(colNum)) return true;
        }
    }

    // 4. Check str_faces object definition from DB
    const faceObj = faces.find(
        (f) => (f.face || "").toUpperCase().trim() === fUpper || (f.face || "").toUpperCase().trim() === cleanFace
    );
    if (faceObj) {
        const fromLeg = (faceObj.face_from || "").toUpperCase().trim();
        const toLeg = (faceObj.face_to || "").toUpperCase().trim();

        if (fromLeg && toLeg) {
            const sMatch = sLeg === fromLeg || sLeg === toLeg;
            const fMatch = fLeg === fromLeg || fLeg === toLeg;

            if (sLeg && fLeg && sLeg !== fLeg) {
                if (sMatch && fMatch) return true;
            } else {
                if (sMatch || fMatch) return true;
            }
        }
    }

    // 5. Composite leg pair face (e.g., "A1A3", "A1-A3", "A2B2")
    const pairTokens = fUpper.split(/[\s\-]/).filter(Boolean);
    if (pairTokens.length >= 2) {
        if (sLeg && fLeg && sLeg !== fLeg) {
            if (pairTokens.includes(sLeg) && pairTokens.includes(fLeg)) return true;
        } else {
            if (pairTokens.includes(sLeg) || pairTokens.includes(fLeg)) return true;
        }
    }

    // 6. Foundation member label check (e.g. leg-A1, face-ROW A-0)
    if (labelUpper.startsWith("LEG-")) {
        const legName = labelUpper.replace("LEG-", "");
        if (rowMatch && legName.startsWith(rowMatch[1].toUpperCase())) return true;
        if (colMatch && legName.endsWith(colMatch[1].toUpperCase())) return true;
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
        const parseVector = (v: any) => {
            if (Array.isArray(v) && v.length >= 3) return [Number(v[0]), Number(v[1]), Number(v[2])];
            if (v && v.x !== undefined && v.y !== undefined && v.z !== undefined) {
                return [Number(v.x), Number(v.y), Number(v.z)];
            }
            return null;
        };

        if (isEnd) {
            const end = parseVector(item.end);
            if (end) return end;
            
            if (item.end_x !== undefined && item.end_y !== undefined && item.end_z !== undefined) {
                return [Number(item.end_x), Number(item.end_y), Number(item.end_z)];
            }
            const endVec = parseVector(item.endVec);
            if (endVec) return endVec;
        } else {
            const start = parseVector(item.start);
            if (start) return start;
            
            if (item.start_x !== undefined && item.start_y !== undefined && item.start_z !== undefined) {
                return [Number(item.start_x), Number(item.start_y), Number(item.start_z)];
            }
            const startVec = parseVector(item.startVec);
            if (startVec) return startVec;
        }

        const pos = parseVector(item.position);
        if (pos) return pos;
        
        if (item.pos_x !== undefined && item.pos_y !== undefined && item.pos_z !== undefined) {
            return [Number(item.pos_x), Number(item.pos_y), Number(item.pos_z)];
        }
        return [0, 0, 0];
    };

    // 1. Identify Foundation Leg Members for the Selected Face
    const isColNumberSearch = /^(?:ROW|FACE)\s*\d+$/i.test(fUpper) || /^\d+$/i.test(fUpper);

    const faceFoundation = foundationMembers.filter((m) => checkComponentOnFace(m, faceName, faces));

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
        return checkComponentOnFace(item, faceName, faces);
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
        const compObj = l.component || l.originalComp || l.structure_components || {};
        const qId = l.q_id || compObj.q_id || l.label || "";
        const code = l.code || compObj.code || "";
        addLine(s, e, qId, code, l.thickness || 0.3, false, l);
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
        const m = clean.match(/WN\s*(.+)/i) || clean.match(/WP\s*(.+)/i) || clean.match(/^N\s*(.+)/i);
        if (m) return m[1].trim();
        return clean.replace(/^(?:WN|WP|N)-?/, "").trim();
    };

    const registerNode = (x: number, y: number, nodeLabel?: string) => {
        const cleanTag = parseNodeNumber(nodeLabel || "");

        // 1. Semantic clustering: if a node with this ID already exists nearby, merge it!
        // This prevents duplicate labels (like two "144"s) when multiple weld components are placed close together.
        if (cleanTag) {
            for (const existingNode of Array.from(nodeMap.values())) {
                if (existingNode.idNum === cleanTag) {
                    const dist = Math.hypot(existingNode.x - x, existingNode.y - y);
                    if (dist < 1.5) { // 1.5 meter tolerance for same node ID
                        existingNode.count += 1;
                        return existingNode;
                    }
                }
            }
        }

        // 2. Spatial clustering: fallback for unlabelled nodes (like member endpoints)
        const key = `${x.toFixed(1)}_${y.toFixed(1)}`;
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

    // 7. Render Node Welds & Joints (Draw indicator and place offset labels outside)
    nodeMap.forEach((node) => {
        if (node.count < 2 && !node.idNum) return;

        const nx = mapX(node.x);
        const ny = mapY(node.y);
        const numStr = node.idNum ? parseNodeNumber(node.idNum) : "";

        // Always draw the small node joint dot indicator
        svgContent += `
            <!-- Node Joint Indicator -->
            <circle cx="${nx}" cy="${ny}" r="4.5" fill="#000000" stroke="#ffffff" stroke-width="0.75" />
        `;

        if (numStr && numStr !== "LEG" && numStr !== "HM") {
            let offsetX = 0;
            let offsetY = 0;
            let anchor = "middle";

            const getXonLine = (y: number, x1: number, y1: number, x2: number, y2: number) => {
                if (Math.abs(y1 - y2) < 0.001) return (x1 + x2) / 2;
                return x1 + ((y - y1) / (y2 - y1)) * (x2 - x1);
            };

            let isLeftLeg = false;
            let isRightLeg = false;
            const midX_Boundary = (minX + maxX) / 2;

            if (legs.length > 0) {
                legs.forEach(leg => {
                    // Check if node is vertically within the leg's span (with some tolerance)
                    const minY_leg = Math.min(leg.y1, leg.y2);
                    const maxY_leg = Math.max(leg.y1, leg.y2);
                    if (node.y >= minY_leg - 5 && node.y <= maxY_leg + 5) {
                        const legX = getXonLine(node.y, leg.x1, leg.y1, leg.x2, leg.y2);
                        if (Math.abs(node.x - legX) < 2.0) { // 2 meter tolerance
                            if (legX < midX_Boundary) isLeftLeg = true;
                            else isRightLeg = true;
                        }
                    }
                });
            } else {
                const threshold = Math.max((maxX - minX) * 0.15, 2);
                if (node.x - minX <= threshold) isLeftLeg = true;
                else if (maxX - node.x <= threshold) isRightLeg = true;
            }

            if (isLeftLeg) {
                // On the left leg, position label to the left
                offsetX = -40;
                anchor = "end";
            } else if (isRightLeg) {
                // On the right leg, position label to the right
                offsetX = 40;
                anchor = "start";
            } else {
                // In the middle, position label above or below
                // If it is closer to the bottom (higher Y in svg space or lower Y in world space), place below
                if (node.y - minY <= (maxY - minY) * 0.15) {
                    offsetY = 25; // Place below
                } else {
                    offsetY = -25; // Place above
                }
            }

            svgContent += `
                <!-- Node Number Offset Label (Adjust font-size and fill color here) -->
                <text x="${nx + offsetX}" y="${ny + offsetY}" text-anchor="${anchor}" dominant-baseline="central" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="bold" fill="#000000" style="paint-order: stroke fill; stroke: #ffffff; stroke-width: 3px; stroke-linecap: round; stroke-linejoin: round;">${numStr}</text>
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
