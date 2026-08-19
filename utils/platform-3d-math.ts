import * as THREE from 'three';

export type PlatformGeometryType = "MONOPOD" | "TRIPOD" | "TETRAPOD" | "HEXAPOD" | "OCTAPOD" | "RECTANGULAR" | "MULTI_LEG";

export function determineGeometryType(platformDetails: any, legNames: string[]): PlatformGeometryType {
    const plegs = Number(platformDetails?.plegs || legNames.length);
    if (plegs === 1 || legNames.length === 1) return "MONOPOD";
    if (plegs === 3 || legNames.length === 3) return "TRIPOD";
    if (plegs === 4 || legNames.length === 4) return "TETRAPOD";
    if (plegs === 6 || legNames.length === 6) return "HEXAPOD";
    if (plegs === 8 || legNames.length === 8) return "OCTAPOD";
    const hasGridPattern = legNames.length > 0 && legNames.every((n) => /^[A-Z]+\d+$/i.test(n));
    if (hasGridPattern) return "RECTANGULAR";
    if (plegs > 4 || legNames.length > 4) return "MULTI_LEG";
    return "RECTANGULAR";
}

export function getEffectiveClockAngle(clockPos: number): number {
    return (clockPos / 12) * Math.PI * 2;
}

export function computeRiserOffsetEndpoints(
    startVec: THREE.Vector3,
    endVec: THREE.Vector3,
    standoff: number = 0.75,
    batterSlope: number = 0.08,
    metadata?: any
): { offsetStart: THREE.Vector3; offsetEnd: THREE.Vector3; outwardDir: THREE.Vector3 } {
    const isStartTop = startVec.y >= endVec.y;
    const topVec = isStartTop ? startVec.clone() : endVec.clone();
    const bottomVec = isStartTop ? endVec.clone() : startVec.clone();

    const md = metadata || {};
    const faceStr = (md.face || md.face_name || md.face_code || "").toString().toUpperCase();
    const sLegStr = (md.s_leg || md.leg || "").toString().toUpperCase();
    const fLegStr = (md.f_leg || md.leg || "").toString().toUpperCase();

    let isNormalZ = true;

    // 1. Determine normal direction from leg metadata
    if (sLegStr && fLegStr) {
        const sRow = sLegStr.charAt(0);
        const fRow = fLegStr.charAt(0);
        if ((sRow === 'A' || sRow === 'B') && sRow === fRow) {
            // Row A or Row B face (runs horizontally in X, face normal in Z)
            isNormalZ = true;
        } else if (sLegStr !== fLegStr && sLegStr.replace(/[AB]/, '') === fLegStr.replace(/[AB]/, '')) {
            // Cross end column face (runs horizontally in Z, face normal in X)
            isNormalZ = false;
        }
    } else if (sLegStr || fLegStr) {
        const leg = sLegStr || fLegStr;
        if (leg.startsWith('A') || leg.startsWith('B')) {
            isNormalZ = true;
        }
    }

    // 2. Explicit face string overrides
    if (faceStr.includes("ROW A") || faceStr.includes("ROW B") || faceStr.includes("FACE A") || faceStr.includes("FACE B")) {
        isNormalZ = true;
    } else if (faceStr.includes("ROW 1") || faceStr.includes("ROW 3") || faceStr.includes("SIDE")) {
        isNormalZ = false;
    } else if (!sLegStr && !fLegStr && !faceStr) {
        // Fallback: If Z offset from center is significant, treat as Row face (normal in Z)
        const absX = Math.abs(topVec.x);
        const absZ = Math.abs(topVec.z);
        isNormalZ = absZ >= absX * 0.35 || absZ > 2.0;
    }

    const deltaY = Math.max(0, topVec.y - bottomVec.y);
    const deltaR = deltaY * batterSlope;

    let offsetStart: THREE.Vector3;
    let offsetEnd: THREE.Vector3;
    let outwardDir: THREE.Vector3;

    if (isNormalZ) {
        // Row A / Row B Face - Outward direction is strictly along Z plane (+Z or -Z)
        const signZ = Math.sign(topVec.z) || 1;
        outwardDir = new THREE.Vector3(0, 0, signZ);

        // Keep X strictly aligned with topVec.x (no rightward/leftward drift along the face)
        offsetStart = new THREE.Vector3(
            topVec.x,
            topVec.y,
            topVec.z + signZ * standoff
        );

        // Calculate bottom Z leaning forward outward
        const existingZLean = Math.abs(bottomVec.z - topVec.z);
        const actualZLean = existingZLean >= deltaR * 0.4 ? existingZLean : deltaR;
        const targetBotZ = topVec.z + signZ * actualZLean;

        offsetEnd = new THREE.Vector3(
            topVec.x, // No sideways drift in X
            bottomVec.y,
            targetBotZ + signZ * standoff
        );
    } else {
        // Side/End Column Face - Outward direction is strictly along X plane (+X or -X)
        const signX = Math.sign(topVec.x) || 1;
        outwardDir = new THREE.Vector3(signX, 0, 0);

        // Keep Z strictly aligned with topVec.z (no sideways drift)
        offsetStart = new THREE.Vector3(
            topVec.x + signX * standoff,
            topVec.y,
            topVec.z
        );

        // Calculate bottom X leaning forward outward
        const existingXLean = Math.abs(bottomVec.x - topVec.x);
        const actualXLean = existingXLean >= deltaR * 0.4 ? existingXLean : deltaR;
        const targetBotX = topVec.x + signX * actualXLean;

        offsetEnd = new THREE.Vector3(
            targetBotX + signX * standoff,
            bottomVec.y,
            topVec.z // No sideways drift in Z
        );
    }

    return { offsetStart, offsetEnd, outwardDir };
}


export function isDegenerateFootprint(legCoords: Array<{ x: number; z: number }>): boolean {
    if (!legCoords || legCoords.length < 2) return true;
    for (let i = 0; i < legCoords.length; i++) {
        for (let j = i + 1; j < legCoords.length; j++) {
            const dx = legCoords[i].x - legCoords[j].x;
            const dz = legCoords[i].z - legCoords[j].z;
            if (Math.sqrt(dx * dx + dz * dz) < 0.1) return true; // coincident legs
        }
    }
    // Calculate 2D polygon area using Shoelace formula
    let area = 0;
    const n = legCoords.length;
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += legCoords[i].x * legCoords[j].z;
        area -= legCoords[j].x * legCoords[i].z;
    }
    area = Math.abs(area) / 2;
    return area < 1.0;
}

export function generatePlatform3DCoordinates(platformDetails: any, elevations: any[], faces: any[], components: any[]) {
    const sanitizeElevation = (elvVal: any): number => {
        if (elvVal === undefined || elvVal === null) return 0;
        let val = typeof elvVal === "number" ? elvVal : parseFloat(elvVal);
        if (isNaN(val)) return 0;
        if (val === 50.772) return -50.772; // Fix 50m spike typo
        if (val < -1000) return val / 1000; // Fix -21424m typo
        return val;
    };

    const availableElevations = (() => {
        const values = elevations.map((e) => sanitizeElevation(e.elv));
        return Array.from(new Set(values)).sort((a, b) => b - a);
    })();

    // Derived level markers from real elevation data
    const { seabedY, waterSurfaceY, waterDepth } = (() => {
        const elvValues = elevations.map((e) => sanitizeElevation(e.elv));
        // Lowest elevation minus a 5m buffer = seabed
        const minElv = elvValues.length > 0 ? Math.min(...elvValues) : -30;
        const seabedY = minElv - 5;
        // Water surface is always MSL = 0
        const waterSurfaceY = 0;
        // Water column depth from surface to seabed
        const waterDepth = Math.abs(waterSurfaceY - seabedY);
        return { seabedY, waterSurfaceY, waterDepth };
    })();

    const availableFaces = (() => {
        return Array.from(new Set(faces.map((f) => f.face).filter(Boolean)));
    })();

    const { componentLayouts, foundationMembers, elvMarkers } = (() => {
        // 1. Determine Leg Footprints and Grid Centering
        const SPACING = 15; // default spacing between rows/cols
        const legMap: Record<string, { x: number; z: number }> = {};

        // Collect all leg names from details and faces
        const allLegNamesSet = new Set<string>();
        if (platformDetails) {
            for (let i = 1; i <= 20; i++) {
                const name = platformDetails[`leg_t${i}`];
                if (name) allLegNamesSet.add(name.toString().toUpperCase());
            }
        }
        faces.forEach((f) => {
            if (f.face_from) allLegNamesSet.add(f.face_from.toUpperCase());
            if (f.face_to) allLegNamesSet.add(f.face_to.toUpperCase());
        });

        const allLegNames = Array.from(allLegNamesSet);
        const geometryType = determineGeometryType(platformDetails, allLegNames);
        const isD21JT = platformDetails?.title?.toUpperCase().includes("D21JT") || false;
        const legRowCol: Record<string, { row: number; col: number }> = {};

        if (geometryType === "TRIPOD") {
            let radius = 10.0;
            const memberLengths: number[] = [];
            components.forEach((c) => {
                const code = (c.code || "").toUpperCase();
                if (["HM", "HOM", "HD", "HDM"].includes(code)) {
                    const md = c.metadata || {};
                    const len = parseFloat(md.length || md.additionalInfo?.length || "0");
                    if (!isNaN(len) && len > 1.0 && len < 100.0) {
                        memberLengths.push(len);
                    }
                }
            });
            if (memberLengths.length > 0) {
                const avgLength = memberLengths.reduce((a, b) => a + b, 0) / memberLengths.length;
                radius = Math.max(avgLength / Math.sqrt(3), 6.0);
            }

            const angles = [Math.PI / 2, Math.PI / 2 + (2 * Math.PI) / 3, Math.PI / 2 + (4 * Math.PI) / 3];
            allLegNames.forEach((name, index) => {
                const angle = angles[index % 3];
                const x = radius * Math.cos(angle);
                const z = radius * Math.sin(angle);
                legMap[name.toUpperCase()] = { x, z };
                legRowCol[name.toUpperCase()] = { row: index, col: index };
            });
        } else {
            // Group legs by row, preserving entry order from Platform Specs (leg_t1..leg_t20)
            const rowMap = new Map<string, string[]>();
            allLegNames.forEach((n) => {
                const match = n.match(/([A-Z]+)(\d+)/i) || n.match(/(\d+)([A-Z]+)/i);
                const rowKey = match ? match[1].toUpperCase() : "ROW0";
                if (!rowMap.has(rowKey)) {
                    rowMap.set(rowKey, []);
                }
                rowMap.get(rowKey)!.push(n.toUpperCase());
            });

            // Fallback if legs didn't parse into multiple rows (e.g. all defaulted to ROW0 or single row)
            if (rowMap.size === 1 && (geometryType === "OCTAPOD" || geometryType === "HEXAPOD" || geometryType === "TETRAPOD")) {
                const legs = rowMap.get(Array.from(rowMap.keys())[0])!;
                const half = Math.ceil(legs.length / 2);
                rowMap.clear();
                rowMap.set("ROW_A", legs.slice(0, half));
                rowMap.set("ROW_B", legs.slice(half));
            }

            const rowKeys = Array.from(rowMap.keys());
            const centerRow = (rowKeys.length - 1) / 2;

            rowKeys.forEach((rowKey, rowIndex) => {
                const legsInRow = rowMap.get(rowKey)!;
                const centerCol = (legsInRow.length - 1) / 2;

                legsInRow.forEach((name, colIndex) => {
                    legMap[name] = {
                        x: (colIndex - centerCol) * SPACING,
                        z: (rowIndex - centerRow) * SPACING,
                    };
                    legRowCol[name] = { row: rowIndex, col: colIndex };
                });
            });
        }

        interface MemberDataPoint {
            y: number;
            length: number;
            type: "X" | "Z";
        }
        const dataPoints: MemberDataPoint[] = [];
        const tripodLengthByY = new Map<number, number[]>();

        components.forEach((c) => {
            const code = (c.code || "").toUpperCase();
            if (!["HM", "HOM", "HD", "HDM"].includes(code)) return;
            const md = c.metadata || {};
            const sLeg = (md.s_leg || "").toUpperCase();
            const fLeg = (md.f_leg || "").toUpperCase();

            const y1 = sanitizeElevation(md.elv_1 || (md.depth ? -parseFloat(md.depth) / 10 : undefined));
            const y2 = sanitizeElevation(md.elv_2 || (md.depth ? -parseFloat(md.depth) / 10 : undefined));
            if (Math.abs(y1 - y2) > 0.01) return;

            const lengthVal = parseFloat(md.length || md.additionalInfo?.length || "0");
            if (isNaN(lengthVal) || lengthVal <= 0.1) return;

            if (geometryType === "TRIPOD") {
                if (!tripodLengthByY.has(y1)) tripodLengthByY.set(y1, []);
                tripodLengthByY.get(y1)!.push(lengthVal);
            } else {
                if (!sLeg || !fLeg || sLeg === fLeg) return;
                const sInfo = legRowCol[sLeg];
                const fInfo = legRowCol[fLeg];
                if (!sInfo || !fInfo) return;

                const colDiff = Math.abs(fInfo.col - sInfo.col);
                const rowDiff = Math.abs(fInfo.row - sInfo.row);

                if (sInfo.row === fInfo.row && colDiff > 0) {
                    dataPoints.push({ y: y1, length: lengthVal / colDiff, type: "X" });
                } else if (sInfo.col === fInfo.col && rowDiff > 0) {
                    dataPoints.push({ y: y1, length: lengthVal / rowDiff, type: "Z" });
                }
            }
        });

        const tripodPoints: { y: number; scale: number }[] = [];
        if (geometryType === "TRIPOD") {
            const nominalRadius = Math.max(...Object.values(legMap).map(l => Math.sqrt(l.x * l.x + l.z * l.z)), 6.0);
            const yLevels = Array.from(tripodLengthByY.keys()).sort((a, b) => a - b);

            if (yLevels.length >= 2) {
                yLevels.forEach((y) => {
                    const lengths = tripodLengthByY.get(y)!;
                    const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
                    const radiusAtY = avgLen / Math.sqrt(3);
                    tripodPoints.push({ y, scale: radiusAtY / nominalRadius });
                });
            } else {
                const batterSlope = 0.08;
                const refY = 0;
                const elvList = elevations.map((e) => sanitizeElevation(e.elv));
                const minY = elvList.length > 0 ? Math.min(...elvList) : -30;
                const maxY = elvList.length > 0 ? Math.max(...elvList) : 5;

                [maxY + 5, maxY, 0, minY].forEach((y) => {
                    const radiusAtY = Math.max(nominalRadius + (refY - y) * batterSlope, nominalRadius * 0.5);
                    tripodPoints.push({ y, scale: radiusAtY / nominalRadius });
                });
            }
            tripodPoints.sort((a, b) => a.y - b.y);
        }

        const xScalesByY = new Map<number, number[]>();
        const zScalesByY = new Map<number, number[]>();

        dataPoints.forEach((p) => {
            if (p.type === "X") {
                if (!xScalesByY.has(p.y)) xScalesByY.set(p.y, []);
                xScalesByY.get(p.y)!.push(p.length / SPACING);
            } else if (p.type === "Z") {
                if (!zScalesByY.has(p.y)) zScalesByY.set(p.y, []);
                zScalesByY.get(p.y)!.push(p.length / SPACING);
            }
        });

        const xPoints: { y: number; scale: number }[] = [];
        const zPoints: { y: number; scale: number }[] = [];

        xScalesByY.forEach((scales, y) => {
            const avg = scales.reduce((a, b) => a + b, 0) / scales.length;
            xPoints.push({ y, scale: avg });
        });

        zScalesByY.forEach((scales, y) => {
            const avg = scales.reduce((a, b) => a + b, 0) / scales.length;
            zPoints.push({ y, scale: avg });
        });

        xPoints.sort((a, b) => a.y - b.y);
        zPoints.sort((a, b) => a.y - b.y);

        const getScaleAtY = (points: { y: number; scale: number }[], yVal: number): number => {
            if (points.length === 0) {
                // Unified splay fallback: scale contracts going UP towards maxElv (1.0 at top level)
                const batterSlope = 0.008;
                return Math.max(1.0 + (maxElv - yVal) * batterSlope, 0.5);
            }
            if (points.length === 1) return points[0].scale;

            if (yVal <= points[0].y) {
                const p0 = points[0];
                const p1 = points[1];
                const slope = (p1.scale - p0.scale) / (p1.y - p0.y);
                return p0.scale + slope * (yVal - p0.y);
            }
            if (yVal >= points[points.length - 1].y) {
                const p0 = points[points.length - 2];
                const p1 = points[points.length - 1];
                const slope = (p1.scale - p0.scale) / (p1.y - p0.y);
                return p1.scale + slope * (yVal - p1.y);
            }
            for (let i = 0; i < points.length - 1; i++) {
                const p0 = points[i];
                const p1 = points[i + 1];
                if (yVal >= p0.y && yVal <= p1.y) {
                    const t = (yVal - p0.y) / (p1.y - p0.y);
                    return p0.scale + (p1.scale - p0.scale) * t;
                }
            }
            return 1.0;
        };

        const elvValues = elevations.map((e) => sanitizeElevation(e.elv)).sort((a, b) => b - a);
        const maxElv = elvValues.length > 0 ? Math.max(...elvValues) : 5;
        const minElv = elvValues.length > 0 ? Math.min(...elvValues) : -30;

        const getLegCoordsAtElv = (legName: string, yVal: number) => {
            const key = legName.toUpperCase();
            if (isD21JT) {
                const L = 13.91 - 0.12489 * (yVal - 2.872);
                const W = 12.45 - 0.16665 * (yVal - 2.872);

                if (key === "A1") return { x: -L / 2, z: W / 2 };
                if (key === "B1") return { x: L / 2, z: W / 2 };
                if (key === "A2") return { x: -L / 2, z: -W / 2 };
                if (key === "B2") return { x: L / 2, z: -W / 2 };
            }
            if (legMap[key]) {
                const nominal = legMap[key];
                const getScaleFactor = (yVal: number) => {
                    if (geometryType === "TRIPOD") {
                        const scale = getScaleAtY(tripodPoints, yVal);
                        return { x: scale, z: scale };
                    } else {
                        const scaleX = getScaleAtY(xPoints, yVal);
                        const scaleZ = getScaleAtY(zPoints, yVal);
                        return { x: scaleX, z: scaleZ };
                    }
                };
                const scales = getScaleFactor(yVal);
                return { x: nominal.x * scales.x, z: nominal.z * scales.z };
            }
            return { x: 0, z: 0 };
        };

        // 3. Generate Foundation Members (Legs and Rows)
        const foundationMembers: any[] = [];
        const elvMarkers: any[] = [];

        // Render Vertical Legs (Tapered/Splayed)
        Object.keys(legMap).forEach((name) => {
            const startCoords = getLegCoordsAtElv(name, maxElv + 5);
            const endCoords = getLegCoordsAtElv(name, minElv);
            foundationMembers.push({
                id: `leg-${name}`,
                start: [startCoords.x, maxElv + 5, startCoords.z], // Extend slightly above max
                end: [endCoords.x, minElv, endCoords.z],
                thickness: 0.8,
                color: "#94a3b8", // slate-400 (galvanized look)
                label: name,
                renderMesh: false,
            });
        });

        // Render Horizontal Rows (Faces) at each elevation
        faces.forEach((face) => {
            elvValues.forEach((elv, idx) => {
                const fromCoords = getLegCoordsAtElv(face.face_from, elv);
                const toCoords = getLegCoordsAtElv(face.face_to, elv);
                foundationMembers.push({
                    id: `face-${face.face}-${idx}`,
                    start: [fromCoords.x, elv, fromCoords.z],
                    end: [toCoords.x, elv, toCoords.z],
                    thickness: 0.4,
                    color: "#64748b", // slate-500
                    label: face.face,
                    renderMesh: false,
                });
            });
        });

        // Generate Elevation Markers
        elevations.forEach((e) => {
            const y = sanitizeElevation(e.elv);
            elvMarkers.push({
                y: y,
                label: `${y.toFixed(3)}m`,
            });
        });

        // 4. Build 3D Node Map for existing components
        const nodeMap = new Map<string, THREE.Vector3>();
        const nodeLegMap = new Map<string, string>();

        // Helper to scan nodeMap for any existing aliases of the target node and return its vector reference
        const getExistingNodeVector = (nodeId: string, legKey?: string): THREE.Vector3 | undefined => {
            const normalized = nodeId.toUpperCase().trim();
            const aliases = [normalized];
            if (/^N\d+$/.test(normalized)) aliases.push(normalized.slice(1));
            if (/^\d+$/.test(normalized)) aliases.push(`N${normalized}`);
            if (!normalized.startsWith("WN")) {
                aliases.push(`WN ${normalized}`);
                aliases.push(`WN${normalized}`);
            }
            // 1. Prioritize weld vectors if they exist in nodeMap
            for (const alias of aliases) {
                if (alias.startsWith("WN") && nodeMap.has(alias)) {
                    const vec = nodeMap.get(alias)!;
                    if (vec.x !== 0 || vec.z !== 0) return vec;
                }
            }
            // 2. Standard composite/alias lookups
            for (const alias of aliases) {
                if (legKey) {
                    const compositeKey = `${alias}|${legKey.toUpperCase()}`;
                    if (nodeMap.has(compositeKey)) {
                        const vec = nodeMap.get(compositeKey)!;
                        if (vec.x !== 0 || vec.z !== 0) return vec;
                    }
                }
                if (nodeMap.has(alias)) {
                    const vec = nodeMap.get(alias)!;
                    if (vec.x !== 0 || vec.z !== 0) return vec;
                }
            }
            return undefined;
        };

        // Helper to register a vector under multiple alias keys in nodeMap
        const registerNodeAlias = (alias: string, vec: THREE.Vector3, legKey: string) => {
            const key = alias.toUpperCase();

            // Look for any existing vector instance for this node name to share reference
            const existingVec = getExistingNodeVector(key, legKey);
            const activeVec = existingVec || vec;

            if (!nodeMap.has(key) || (nodeMap.get(key)!.x === 0 && nodeMap.get(key)!.z === 0)) {
                nodeMap.set(key, activeVec);
                if (legKey) nodeLegMap.set(key, legKey);
            }
            if (legKey) {
                const compositeKey = `${key}|${legKey.toUpperCase()}`;
                if (
                    !nodeMap.has(compositeKey) ||
                    (nodeMap.get(compositeKey)!.x === 0 && nodeMap.get(compositeKey)!.z === 0)
                ) {
                    nodeMap.set(compositeKey, activeVec);
                    nodeLegMap.set(compositeKey, legKey);
                }
            }
        };

        const processNode = (
            nodeName: string | undefined,
            legName: string | undefined,
            elv: string | undefined,
            depth: string | undefined,
            easting: string | undefined,
            northing: string | undefined,
            isPrimary: boolean
        ) => {
            if (!nodeName) return;

            const normalizedNodeName = nodeName.toUpperCase();
            const legKey = legName?.toUpperCase() || "";
            const mapKey = legKey ? `${normalizedNodeName}|${legKey}` : normalizedNodeName;

            let x = 0,
                y = 0,
                z = 0;

            if (elv) {
                y = sanitizeElevation(elv);
            } else if (depth) {
                y = -sanitizeElevation(depth) / 10 || 0;
            }

            if (legKey) {
                const coords = getLegCoordsAtElv(legKey, y);
                x = coords.x;
                z = coords.z;
            } else if (easting || northing) {
                x = parseFloat(easting || "0") / 100 || 0;
                z = parseFloat(northing || "0") / 100 || 0;
            }

            const vec = new THREE.Vector3(x, y, z);
            registerNodeAlias(normalizedNodeName, vec, legKey);
        };

        // Helper to extract bare node from q_id
        const extractBareNode = (q_id: string): string => {
            const matchFull = q_id.match(/WN\s*(N?[A-Za-z0-9]+)/i);
            const matchBare = q_id.match(/(?:WN\s*)?(N?(\d+))$/i);
            if (matchFull) return matchFull[1].toUpperCase();
            if (matchBare) return matchBare[1].toUpperCase();
            return q_id.toUpperCase();
        };

        // PASS 1: Authoritative Root Node Providers (WN, ND, NODE that define their own absolute coords)
        const intermediateWelds: typeof components = [];

        components.forEach((c) => {
            const md = c.metadata || {};
            const code = (c.code || "").toUpperCase();
            const isWeld = code === "WN" || code === "WP" || code.includes("WELD");

            if (isWeld || code.includes("NODE") || code === "ND") {
                const bareNode = extractBareNode(c.q_id);
                const sNode = (md.s_node || "").toUpperCase();
                const fNode = (md.f_node || "").toUpperCase();

                // If it has s_node and f_node, and neither is itself, it's an intermediate weld on a member!
                // Point welds (where s_node === f_node) represent the root node itself, and are not intermediate.
                const isIntermediate = sNode && fNode && sNode !== fNode && sNode !== bareNode && fNode !== bareNode;

                if (isIntermediate) {
                    intermediateWelds.push(c);
                    return; // Process in Pass 2
                }

                // Root Node Weld Processing
                const leg = (md.s_leg || md.f_leg || md.leg || "").toUpperCase();
                const elv = md.elv_1 || md.elv_2 || md.depth;
                const ePlainNum = md.elv_1 || md.elv_2;

                let y = 0;
                if (ePlainNum) y = sanitizeElevation(ePlainNum);
                else if (md.depth) y = -sanitizeElevation(md.depth) / 10;

                let x = 0,
                    z = 0;
                if (leg) {
                    const coords = getLegCoordsAtElv(leg, y);
                    x = coords.x;
                    z = coords.z;
                } else if (md.easting || md.northing) {
                    x = parseFloat(md.easting || "0") / 100 || 0;
                    z = parseFloat(md.northing || "0") / 100 || 0;
                }

                if (leg || md.easting || md.northing || ePlainNum || md.depth) {
                    const vec = new THREE.Vector3(x, y, z);

                    registerNodeAlias(c.q_id, vec, leg);

                    const matchFull = c.q_id.match(/WN\s*(N?[A-Za-z0-9]+)/i);
                    const matchBare = c.q_id.match(/(?:WN\s*)?(N?(\d+))$/i);
                    if (matchFull) {
                        const withN = matchFull[1].toUpperCase();
                        registerNodeAlias(withN, vec, leg);
                        const numOnly = withN.replace(/^N/, "");
                        registerNodeAlias(numOnly, vec, leg);
                        registerNodeAlias(`N${numOnly}`, vec, leg);
                    } else if (matchBare) {
                        const withN = matchBare[1].toUpperCase();
                        registerNodeAlias(withN, vec, leg);
                        registerNodeAlias(matchBare[2], vec, leg);
                    }
                }
            }
        });

        // lookupNode tries multiple alias forms so that whatever format s_node/f_node uses,
        // it resolves correctly ("N164", "164", "WN N164", etc.)
        const lookupNode = (
            nodeId: string | undefined,
            legName: string | undefined
        ): THREE.Vector3 | undefined => {
            if (!nodeId) return undefined;
            const normalizedNodeId = nodeId.toUpperCase().trim();
            const legKey = legName?.toUpperCase() || "";

            const aliases: string[] = [normalizedNodeId];
            if (/^N\d+$/.test(normalizedNodeId)) aliases.push(normalizedNodeId.slice(1));
            if (/^\d+$/.test(normalizedNodeId)) aliases.push(`N${normalizedNodeId}`);
            if (!normalizedNodeId.startsWith("WN")) {
                aliases.push(`WN ${normalizedNodeId}`);
                aliases.push(`WN${normalizedNodeId}`);
                if (/^\d+$/.test(normalizedNodeId)) {
                    aliases.push(`WN N${normalizedNodeId}`);
                    aliases.push(`WNN${normalizedNodeId}`);
                }
            }

            // 1. Prioritize leg-specific composite key first if legKey is specified
            if (legKey) {
                for (const alias of aliases) {
                    const compositeKey = `${alias}|${legKey}`;
                    if (nodeMap.has(compositeKey)) return nodeMap.get(compositeKey);
                }
            }

            // 2. Fallback to authoritative node weld references (e.g. "WN N4") if they exist in nodeMap
            for (const alias of aliases) {
                if (alias.startsWith("WN") && nodeMap.has(alias)) {
                    const vec = nodeMap.get(alias)!;
                    if (vec.x !== 0 || vec.z !== 0) return vec;
                }
            }

            // 3. Fallback to global alias
            for (const alias of aliases) {
                if (nodeMap.has(alias)) return nodeMap.get(alias);
            }
            return undefined;
        };

        // PASS 1.2: Register endpoints for all primary member components
        components.forEach((c) => {
            const md = c.metadata || {};
            const code = (c.code || "").toUpperCase();
            const isPrimary = ["HM", "HOM", "HD", "HDM", "VM", "VD", "VDM", "LG", "LEG"].includes(code);
            if (isPrimary) {
                processNode(md.s_node, md.s_leg, md.elv_1, md.depth, md.easting, md.northing, true);
                processNode(md.f_node, md.f_leg, md.elv_2, md.depth, md.easting, md.northing, true);
            }
        });

        // PASS 1.5: Adjust primary member endpoint positions based on metadata length
        // (Commented out to prevent cumulative in-place coordinate distortion on closed loop frames)
        /*
            components.forEach(c => {
                const md = c.metadata || {};
                const code = (c.code || "").toUpperCase();
                const isMember = ["HM", "HOM", "HD", "HDM", "VM", "VD", "VDM"].includes(code);
                if (isMember && md.s_node && md.f_node) {
                    const sPos = lookupNode(md.s_node, md.s_leg);
                    const fPos = lookupNode(md.f_node, md.f_leg);
                    if (sPos && fPos) {
                        const originalDist = sPos.distanceTo(fPos);
                        if (originalDist > 0.001) {
                            const lengthStr = md.length || md.additionalInfo?.length;
                            if (lengthStr) {
                                const memberLength = parseFloat(lengthStr);
                                if (!isNaN(memberLength) && memberLength > 0) {
                                    const dir = fPos.clone().sub(sPos).normalize();
                                    const newFPos = sPos.clone().add(dir.multiplyScalar(memberLength));
                                    fPos.copy(newFPos);
                                }
                            }
                        }
                    }
                }
            });
            */

        // PASS 2: Intermediate Node Welds (e.g. WN N170 sitting on HOM N166-N164)
        // Group by endpoints, interpolate, and REGISTER back to nodeMap!
        const intermediateWeldGroups = new Map<string, typeof intermediateWelds>();
        intermediateWelds.forEach((c) => {
            const md = c.metadata || {};
            const sNode = lookupNode(md.s_node, md.s_leg);
            const fNode = lookupNode(md.f_node, md.f_leg);
            if (sNode && fNode) {
                const key = `${sNode.x.toFixed(3)},${sNode.y.toFixed(3)},${sNode.z.toFixed(3)}|${fNode.x.toFixed(3)},${fNode.y.toFixed(3)},${fNode.z.toFixed(3)}`;
                if (!intermediateWeldGroups.has(key)) intermediateWeldGroups.set(key, []);
                intermediateWeldGroups.get(key)!.push(c);
            }
        });

        intermediateWeldGroups.forEach((items, key) => {
            const md0 = items[0].metadata || {};
            const sNode = lookupNode(md0.s_node, md0.s_leg)!;
            const fNode = lookupNode(md0.f_node, md0.f_leg)!;

            items.sort((a, b) => a.q_id.localeCompare(b.q_id));
            const count = items.length;

            items.forEach((item, idx) => {
                const md = item.metadata || {};
                let pos = new THREE.Vector3();

                if ((md.elv_1 || md.depth) && Math.abs(fNode.y - sNode.y) > 0.001) {
                    const targetY = sanitizeElevation(md.elv_1 || -parseFloat(md.depth) / 10);
                    const t = (targetY - sNode.y) / (fNode.y - sNode.y);
                    pos.copy(sNode).lerp(fNode, Math.max(0, Math.min(1, t)));
                } else {
                    // For horizontal/diagonal members, distribute using dist/length if available, else evenly
                    let t = (idx + 1) / (count + 1);
                    const distVal = parseFloat(md.dist || md.length || md.dist_from_start);
                    if (!isNaN(distVal) && distVal > 0) {
                        const dx = Math.abs(fNode.x - sNode.x);
                        const dy = Math.abs(fNode.y - sNode.y);
                        const dz = Math.abs(fNode.z - sNode.z);
                        const model_projected_span = Math.max(dx, dy, dz);
                        if (model_projected_span > 0.01) {
                            t = Math.max(0, Math.min(1, distVal / model_projected_span));
                        }
                    }
                    pos.copy(sNode).lerp(fNode, t);
                }

                if (md.dist) {
                    const distance = parseFloat(md.dist);
                    if (distance > 0 && distance < 3.0) {
                        const clockPos = parseFloat(md.clk_pos || "12");
                        const angle = getEffectiveClockAngle(clockPos);
                        pos.x += Math.sin(angle) * distance;
                        pos.z += Math.cos(angle) * distance;
                    }
                }

                // Register interpolated position to nodeMap so HDM members can use it!
                const bareNode = extractBareNode(item.q_id);
                registerNodeAlias(item.q_id, pos, "");
                registerNodeAlias(bareNode, pos, "");
                if (/^N\d+$/.test(bareNode)) {
                    registerNodeAlias(bareNode.slice(1), pos, "");
                } else if (/^\d+$/.test(bareNode)) {
                    registerNodeAlias(`N${bareNode}`, pos, "");
                }
            });
        });

        // PASS 3: Fallback registrations for endpoints on non-node and non-primary components
        components.forEach((c) => {
            const md = c.metadata || {};
            const code = (c.code || "").toUpperCase();
            const isWeld = code === "WN" || code === "WP" || code.includes("WELD");
            const isNode = isWeld || code.includes("NODE") || code === "ND";
            const isPrimary = ["HM", "HOM", "HD", "HDM", "VM", "VD", "VDM", "LG", "LEG"].includes(code);

            if (!isNode && !isPrimary) {
                const isPrimaryFallback = ["CF", "CG", "CD", "CO", "CA"].includes(code);
                processNode(
                    md.s_node,
                    md.s_leg,
                    md.elv_1,
                    md.depth,
                    md.easting,
                    md.northing,
                    isPrimaryFallback
                );
                processNode(
                    md.f_node,
                    md.f_leg,
                    md.elv_2,
                    md.depth,
                    md.easting,
                    md.northing,
                    isPrimaryFallback
                );
            }
        });

        // 5. Resolve Structural Layouts for components
        const intermediateLayouts = new Map<
            number,
            { component: any; start: THREE.Vector3; end: THREE.Vector3; thickness: number }
        >();

        // PASS 1.7: Interpolate and register child node welds (WN) on parent members
        const childWeldGroups = new Map<number, typeof components>();
        components.forEach((c) => {
            const md = c.metadata || {};
            const code = (c.code || "").toUpperCase();
            if (code === "WN" && md.associated_comp_id) {
                const parentId = md.associated_comp_id;
                if (!childWeldGroups.has(parentId)) {
                    childWeldGroups.set(parentId, []);
                }
                childWeldGroups.get(parentId)!.push(c);
            }
        });

        // Run interpolation multiple times (3 iterations) to resolve dependency ordering
        // (e.g. child welds whose parent endpoints themselves depend on other child welds)
        for (let iter = 0; iter < 3; iter++) {
            childWeldGroups.forEach((children, parentId) => {
                // Find parent component
                const parentComp = components.find((c) => c.id === parentId);
                if (!parentComp) return;

                const parentMd = parentComp.metadata || {};
                const pStart = lookupNode(parentMd.s_node, parentMd.s_leg);
                const pEnd = lookupNode(parentMd.f_node, parentMd.f_leg);
                if (!pStart || !pEnd) return;

                const direction = pEnd.clone().sub(pStart).normalize();

                // Sort children by dist ascending
                children.sort((a, b) => {
                    const distA = parseFloat(a.metadata?.dist || "0");
                    const distB = parseFloat(b.metadata?.dist || "0");
                    if (distA !== distB) return distA - distB;
                    return (a.q_id || "").localeCompare(b.q_id || "");
                });

                // Determine the real physical length of the parent member.
                let realParentLength = parseFloat(parentMd.length || parentMd.dist || "0");
                if (realParentLength <= 0 && children.length > 0) {
                     const endNodeWeld = children.find(c => {
                        const cNode = (c.metadata?.s_node || "").toUpperCase().trim();
                        const parentFNode = (parentMd.f_node || "").toUpperCase().trim();
                        return cNode === parentFNode && parentFNode !== "";
                    });
                    if (endNodeWeld) {
                        realParentLength = parseFloat(endNodeWeld.metadata?.dist || endNodeWeld.metadata?.length || "0");
                    }
                }
                const count = children.length;
                children.forEach((c, idx) => {
                    let t = (idx + 1) / (count + 1);
                    const distVal = parseFloat(c.metadata?.dist || c.metadata?.length);
                    if (!isNaN(distVal) && distVal > 0) {
                        const dx = Math.abs(pEnd.x - pStart.x);
                        const dy = Math.abs(pEnd.y - pStart.y);
                        const dz = Math.abs(pEnd.z - pStart.z);
                        const model_projected_span = Math.max(dx, dy, dz);
                        if (realParentLength > 0.01) {
                            t = Math.max(0, Math.min(1, distVal / realParentLength));
                        } else if (model_projected_span > 0.01) {
                            t = Math.max(0, Math.min(1, distVal / model_projected_span));
                        }
                    }
                    const pos = pStart.clone().lerp(pEnd, t);

                    // Update position in nodeMap
                    const nodeName = (c.metadata?.s_node || "").toUpperCase();
                    if (nodeName) {
                        const nodeVec = lookupNode(nodeName, "");
                        if (nodeVec) {
                            nodeVec.copy(pos);
                        } else {
                            registerNodeAlias(nodeName, pos, "");
                            registerNodeAlias(c.q_id, pos, "");
                        }
                    }

                    // Add layout to intermediateLayouts immediately
                    let thickness = 0.15; // default weld thickness
                    if (parentComp) {
                        const parentCode = (parentComp.code || "").toUpperCase();
                        let parentThickness = 0.2;
                        if (parentCode.includes("LG")) parentThickness = 0.5;
                        else if (parentCode === "RS" || parentCode.includes("RISER")) parentThickness = 0.3;
                        else if (parentCode.includes("HM") || parentCode.includes("HD")) parentThickness = 0.2;
                        else if (parentCode.includes("VM") || parentCode.includes("VD")) parentThickness = 0.16;
                        thickness = parentThickness * 1.15;
                    }
                    const start = pos.clone();
                    const end = pos.clone();
                    if (direction.lengthSq() > 0.1) {
                        end.add(direction.clone().multiplyScalar(0.1));
                    }
                    intermediateLayouts.set(c.id, { component: c, start, end, thickness });
                });
            });

            // Project cantilever/protruding members with clk_pos & dist
            components.forEach((c) => {
                const md = c.metadata || {};
                const code = (c.code || "").toUpperCase();
                const isMember = ["HM", "HOM", "HD", "HDM", "VM", "VD", "VDM"].includes(code);
                if (isMember && md.clk_pos && md.clk_pos !== "N/A" && md.dist) {
                    const sNodePos = lookupNode(md.s_node, md.s_leg);
                    if (!sNodePos) return;

                    // Find parent component to get direction reference
                    let parentComp: any = null;
                    const parentWeld = components.find(
                        (w) =>
                            (w.code || "").toUpperCase() === "WN" &&
                            (w.metadata?.s_node || "").toUpperCase() === (md.s_node || "").toUpperCase() &&
                            w.metadata?.associated_comp_id
                    );
                    if (parentWeld) {
                        parentComp = components.find((pc) => pc.id === parentWeld.metadata.associated_comp_id);
                    }

                    const dir = new THREE.Vector3(0, 0, -1); // default fallback direction
                    if (parentComp) {
                        const pStart = lookupNode(parentComp.metadata.s_node, parentComp.metadata.s_leg);
                        const pEnd = lookupNode(parentComp.metadata.f_node, parentComp.metadata.f_leg);
                        if (pStart && pEnd && pStart.distanceTo(pEnd) > 0.01) {
                            dir.copy(pEnd).sub(pStart).normalize();
                        }
                    }

                    // Compute orthogonal plane vectors
                    const up = new THREE.Vector3(0, 1, 0);
                    if (Math.abs(dir.y) > 0.99) {
                        up.set(0, 0, -1);
                    }
                    up.sub(dir.clone().multiplyScalar(up.dot(dir))).normalize();
                    const right = new THREE.Vector3().crossVectors(up, dir).normalize();

                    // Calculate offset direction using clock position
                    const clockPos = parseFloat(md.clk_pos);
                    if (!isNaN(clockPos)) {
                        const angle = getEffectiveClockAngle(clockPos);
                        
                        let offsetDir = new THREE.Vector3();
                        if (Math.abs(dir.y) <= 0.8) {
                            // Horizontal parent member: rotate horizontally (compass style) around Global Y-axis
                            // 12 o'clock is along the member (dir), 3 is right, 6 is back, 9 is left
                            const rotAxis = new THREE.Vector3(0, 1, 0);
                            offsetDir = dir.clone().applyAxisAngle(rotAxis, -angle).normalize();
                        } else {
                            // Vertical parent member: rotate in the horizontal plane (orthogonal to vertical dir)
                            offsetDir = right
                                .clone()
                                .multiplyScalar(Math.sin(angle))
                                .add(up.clone().multiplyScalar(Math.cos(angle)))
                                .normalize();
                        }

                        const distance = parseFloat(md.dist);
                        if (!isNaN(distance)) {
                            const fNodePos = sNodePos.clone().add(offsetDir.multiplyScalar(distance));

                            // Update/register f_node in nodeMap
                            const fNodeName = (md.f_node || "").toUpperCase();
                            if (fNodeName) {
                                const fNodeVec = lookupNode(fNodeName, "");
                                if (fNodeVec) {
                                    fNodeVec.copy(fNodePos);
                                } else {
                                    registerNodeAlias(fNodeName, fNodePos, "");
                                }
                            }
                        }
                    }
                }
            });
        }

        const pendingAttachments: typeof components = [];
        const pendingSpanAccessories: { component: any; sNode: THREE.Vector3; fNode: THREE.Vector3 }[] =
            [];
        const pendingRiserSupports: { component: any; riserNum: string; targetElv: number }[] = [];
        const wincairsAppliedSet = new Set<number>();

        components.forEach((c, i) => {
            const md = c.metadata || {};
            const code = (c.code || "").toUpperCase();

            // Check WINCAIRS Mode 3D CAD parameter override
            const wincairsParam: any = null;
            const hasWincairsParam = !!(
                wincairsParam &&
                isFinite(Number(wincairsParam.s_point3d_x)) &&
                isFinite(Number(wincairsParam.s_point3d_y)) &&
                isFinite(Number(wincairsParam.s_point3d_z)) &&
                !(Number(wincairsParam.s_point3d_x) === 0 && Number(wincairsParam.s_point3d_y) === 0 && Number(wincairsParam.s_point3d_z) === 0 && Number(wincairsParam.e_point3d_x) === 0 && Number(wincairsParam.e_point3d_y) === 0 && Number(wincairsParam.e_point3d_z) === 0)
            );

            if (hasWincairsParam) {
                const start = new THREE.Vector3(
                    Number(wincairsParam.s_point3d_x),
                    Number(wincairsParam.s_point3d_y),
                    Number(wincairsParam.s_point3d_z)
                );
                let end = new THREE.Vector3();
                const hasEndVec = isFinite(Number(wincairsParam.e_point3d_x)) &&
                                  isFinite(Number(wincairsParam.e_point3d_y)) &&
                                  isFinite(Number(wincairsParam.e_point3d_z)) &&
                                  !(Number(wincairsParam.e_point3d_x) === 0 && Number(wincairsParam.e_point3d_y) === 0 && Number(wincairsParam.e_point3d_z) === 0);

                if (hasEndVec) {
                    end.set(
                        Number(wincairsParam.e_point3d_x),
                        Number(wincairsParam.e_point3d_y),
                        Number(wincairsParam.e_point3d_z)
                    );
                } else {
                    end.copy(start).add(new THREE.Vector3(0, 0.2, 0));
                }

                let thickness = 0.15;
                if (code.includes("LG")) thickness = 0.5;
                else if (code === "RS" || code.includes("RISER") || code.includes("RISR")) thickness = 0.3;
                else if (code.includes("HM") || code.includes("HD")) thickness = 0.2;
                else if (code.includes("VM") || code.includes("VD")) thickness = 0.16;
                else if (code === "CO" || code === "CA" || code === "CS" || code.includes("COND") || code.includes("CAIS") || code === "CD") thickness = 0.30;

                intermediateLayouts.set(c.id, { component: c, start, end, thickness });
                wincairsAppliedSet.add(c.id);
                return;
            }

            // Skip child welds already resolved in PASS 1.7
            if (code === "WN" && md.associated_comp_id && intermediateLayouts.has(c.id)) {
                return;
            }

            const isConductor = code === "CD" || code.includes("COND");
            if (isConductor) {
                return;
            }

            const qIdUpper = (c.q_id || "").toUpperCase();
            const clampMatch = 
                qIdUpper.match(/(?:RIS|R)[-_]?(\d+)[-_]?(?:SUPP|CLP|CLAMP|CL)[-_ ]*(\+|-)?\s*(\d+(?:\.\d+)?)M?/i) ||
                qIdUpper.match(/(?:CLP|CLAMP|CL)[-_]?(?:R|RIS)?[-_]?(\d+)[-_ ]*(\+|-)?\s*(\d+(?:\.\d+)?)M?/i) ||
                qIdUpper.match(/RIS-?(\d+)-SUPP-?(\d+)M/i) ||
                qIdUpper.match(/RIS-?(\d+)-CLP-?(\d+)M/i);

            if (clampMatch) {
                const riserNum = clampMatch[1];
                const explicitSign = clampMatch[2];
                const rawElv = parseFloat(clampMatch[3] || clampMatch[2]);
                let targetElv = explicitSign === "+" ? rawElv : explicitSign === "-" ? -rawElv : -Math.abs(rawElv);

                if (elvValues.length > 0 && !isNaN(rawElv)) {
                    const possibleElvs = [-Math.abs(rawElv), Math.abs(rawElv)];
                    let closest = elvValues[0];
                    let minDist = Math.abs(elvValues[0] - targetElv);
                    for (const elv of elvValues) {
                        for (const possible of possibleElvs) {
                            const dist = Math.abs(elv - possible);
                            if (dist < minDist) {
                                minDist = dist;
                                closest = elv;
                            }
                        }
                    }
                    targetElv = closest;
                }

                pendingRiserSupports.push({
                    component: c,
                    riserNum,
                    targetElv,
                });
                return;
            }

            const isAnode = code === "AN" || code.includes("ANOD");
            const isWeld = code === "WN" || code === "WP" || code.includes("WELD");
            const isClamp = code === "CL" || code.includes("CLAM");
            const isPile = code === "PL" || code === "PILE" || qIdUpper.includes("PILE");
            const isPointAccessory = isAnode || isWeld || isClamp;

            let thickness = 0.15;
            if (code.includes("LG")) thickness = 0.48;
            else if (isPile) thickness = 0.2;
            else if (code === "RS" || code.includes("RISER") || code.includes("RISR")) thickness = 0.3;
            else if (code.includes("HM") || code.includes("HD")) thickness = 0.2;
            else if (code.includes("VM") || code.includes("VD")) thickness = 0.16;
            else if (code === "CO" || code === "CA" || code === "CS" || code.includes("COND") || code.includes("CAIS") || code === "CD")
                thickness = 0.30;

            const startNode = lookupNode(md.s_node, md.s_leg);
            const endNode = lookupNode(md.f_node, md.f_leg);
            const hasStartNode = !!startNode;
            const hasEndNode = !!endNode;

            let start = new THREE.Vector3();
            let end = new THREE.Vector3();
            let resolved = false;

            const isPointNodeWeld = isWeld && (!md.s_node || !md.f_node || md.s_node === md.f_node || md.s_node.toString().toUpperCase() === extractBareNode(c.q_id));

            if (isPile) {
                const legMatch = qIdUpper.match(/(?:LEG\s*|PL\s*|PILE\s*|LEG\-?)([A-Z0-9]+)/i) || qIdUpper.match(/([A-Z]\d+)/i);
                const targetLeg = (md.s_leg || md.f_leg || md.leg || (legMatch?.[1]) || "").toUpperCase();

                const nodeMatch = (qIdUpper.match(/(?:WN\s*|N\s*)?(\d+)/i) || [])[1];
                const targetNode = String(md.s_node || md.f_node || md.start_node || md.end_node || nodeMatch || "").toUpperCase().trim();

                const nodePos = (targetNode ? lookupNode(targetNode, targetLeg) : undefined) ||
                                (targetNode ? lookupNode(targetNode, undefined) : undefined) ||
                                (hasStartNode ? startNode : hasEndNode ? endNode : undefined);

                const yTop = nodePos ? nodePos.y : (md.elv_1 ? sanitizeElevation(md.elv_1) : minElv);
                const pileLength = md.length ? Math.abs(parseFloat(md.length)) : 2.0;
                const yBottom = yTop - pileLength;

                let topCoords = nodePos ? nodePos.clone() : new THREE.Vector3(0, yTop, 0);
                if (!nodePos && targetLeg) {
                    const cTop = getLegCoordsAtElv(targetLeg, yTop);
                    topCoords.set(cTop.x, yTop, cTop.z);
                }

                let bottomCoords = new THREE.Vector3();
                if (targetLeg) {
                    const cBot = getLegCoordsAtElv(targetLeg, yBottom);
                    bottomCoords.set(cBot.x, yBottom, cBot.z);
                } else {
                    bottomCoords.set(topCoords.x, yBottom, topCoords.z);
                }

                start.copy(topCoords);
                end.copy(bottomCoords);
                thickness = 0.2;
                resolved = true;
            } else if (md.associated_comp_id && code !== "VM") {
                if (code !== "WN") {
                    pendingAttachments.push(c);
                }
                return;
            } else if (
                isPointAccessory &&
                hasStartNode &&
                hasEndNode &&
                startNode!.distanceTo(endNode!) > 0.001
            ) {
                pendingSpanAccessories.push({ component: c, sNode: startNode!, fNode: endNode! });
                return;
            } else if (isPointAccessory && (hasStartNode || hasEndNode || md.s_leg || md.elv_1 !== undefined || isPointNodeWeld)) {
                const y = md.elv_1 ? sanitizeElevation(md.elv_1) : (startNode?.y ?? endNode?.y ?? 0);
                const bareNode = extractBareNode(c.q_id);
                const nodePos = startNode || endNode || lookupNode(bareNode, md.s_leg);
                if (nodePos) {
                    start.set(nodePos.x, y || nodePos.y, nodePos.z);
                } else if (md.s_leg) {
                    const coords = getLegCoordsAtElv(md.s_leg.toUpperCase(), y);
                    start.set(coords.x, y, coords.z);
                }
                if (md.dist && !isAnode) {
                    const distance = parseFloat(md.dist);
                    if (distance > 0 && distance < 3.0) {
                        const clockPos = parseFloat(md.clk_pos || "12");
                        const angle = (clockPos / 12) * Math.PI * 2;
                        start.x += Math.sin(angle) * distance;
                        start.z += Math.cos(angle) * distance;
                    }
                }
                end.copy(start);
                resolved = true;
            } else if (
                code === "CS" ||
                code === "CA" ||
                code.includes("CAIS") ||
                qIdUpper.startsWith("CS-")
            ) {
                // Caisson 3D Placement: Detect start node (s_node) and place top under start node weld in flush contact
                const sNodeName = (md.s_node || md.start_node || c.s_node || "").toString().trim().toUpperCase();
                const fNodeName = (md.f_node || md.end_node || c.f_node || "").toString().trim().toUpperCase();
                const sLegName = (md.s_leg || md.leg || c.s_leg || "").toString().trim().toUpperCase();
                const fLegName = (md.f_leg || md.leg || c.f_leg || "").toString().trim().toUpperCase();

                const sNodePos = sNodeName ? (lookupNode(sNodeName, sLegName) || lookupNode(sNodeName, undefined)) : null;
                const fNodePos = fNodeName ? (lookupNode(fNodeName, fLegName) || lookupNode(fNodeName, undefined)) : null;

                const contactOffset = 0.275; // Half height of weld collar (0.55m) for flush contact below weld collar

                if (sNodePos) {
                    start.set(sNodePos.x, sNodePos.y - contactOffset, sNodePos.z);
                } else if (sLegName && md.elv_1 !== undefined && md.elv_1 !== null && md.elv_1 !== "") {
                    const y1 = sanitizeElevation(md.elv_1);
                    const coords1 = getLegCoordsAtElv(sLegName, y1);
                    start.set(coords1.x, y1 - contactOffset, coords1.z);
                } else if (md.elv_1 !== undefined && md.elv_1 !== null && md.elv_1 !== "") {
                    const y1 = sanitizeElevation(md.elv_1);
                    start.set(0, y1 - contactOffset, 0);
                } else {
                    start.set(0, maxElv - contactOffset, 0);
                }

                if (fNodePos) {
                    const y2 = (md.elv_2 !== undefined && md.elv_2 !== null && md.elv_2 !== "")
                        ? sanitizeElevation(md.elv_2)
                        : fNodePos.y;
                    end.set(fNodePos.x, y2, fNodePos.z);
                } else if (fLegName && md.elv_2 !== undefined && md.elv_2 !== null && md.elv_2 !== "") {
                    const y2 = sanitizeElevation(md.elv_2);
                    const coords2 = getLegCoordsAtElv(fLegName, y2);
                    end.set(coords2.x, y2, coords2.z);
                } else if (md.elv_2 !== undefined && md.elv_2 !== null && md.elv_2 !== "") {
                    const y2 = sanitizeElevation(md.elv_2);
                    end.set(start.x, y2, start.z);
                } else {
                    end.set(start.x, seabedY, start.z);
                }

                if (end.y >= start.y) {
                    if (md.elv_2 !== undefined && md.elv_2 !== null && md.elv_2 !== "") {
                        const y2 = sanitizeElevation(md.elv_2);
                        if (y2 < start.y) end.setY(y2);
                        else end.setY(start.y - 2.0);
                    } else {
                        end.setY(seabedY < start.y ? seabedY : start.y - 2.0);
                    }
                }

                thickness = 0.30;
                resolved = true;
            } else if (
                code === "RS" ||
                code === "CO" ||
                code.includes("RISER") ||
                code.includes("RISR")
            ) {
                const getScaleFactor = (yVal: number) => {
                    if (isD21JT) {
                        const scaleX = (13.91 - 0.12489 * (yVal - 2.872)) / 13.91;
                        const scaleZ = (12.45 - 0.16665 * (yVal - 2.872)) / 12.45;
                        return { x: scaleX, z: scaleZ };
                    } else if (geometryType === "TRIPOD") {
                        const scale = getScaleAtY(tripodPoints, yVal);
                        return { x: scale, z: scale };
                    } else {
                        const scaleX = getScaleAtY(xPoints, yVal);
                        const scaleZ = getScaleAtY(zPoints, yVal);
                        return { x: scaleX, z: scaleZ };
                    }
                };

                const getCoordsAtElv = (p: THREE.Vector3, yRef: number, yTarget: number) => {
                    const sRef = getScaleFactor(yRef);
                    const sTarget = getScaleFactor(yTarget);

                    const nominalX = p.x / (sRef.x || 1.0);
                    const nominalZ = p.z / (sRef.z || 1.0);

                    return new THREE.Vector3(
                        nominalX * sTarget.x,
                        yTarget,
                        nominalZ * sTarget.z
                    );
                };

                // Check if there are associated support welds (WP / SUPP) that define guide hole midpoints
                const compQIdUpper = (c.q_id || "").toUpperCase().trim();
                const compIdStr = String(c.id);

                const matchingSupps = components.filter((other) => {
                    const oCode = (other.code || "").toUpperCase();
                    const oQId = (other.q_id || "").toUpperCase();
                    const isSupp = oCode === "WP" || oCode === "WN" || oQId.includes("SUPP") || oQId.includes("CLP");
                    if (!isSupp) return false;

                    const assocId = other.metadata?.associated_comp_id;
                    if (assocId && String(assocId) === compIdStr) return true;
                    if (compQIdUpper && (oQId.startsWith(`${compQIdUpper}-`) || oQId.startsWith(`${compQIdUpper} `))) return true;
                    return false;
                });

                const suppMidpoints: { elv: number; midpoint: THREE.Vector3 }[] = [];
                matchingSupps.forEach((supp) => {
                    const suppMd = supp.metadata || {};
                    const sNodeName = suppMd.s_node || suppMd.start_node;
                    const fNodeName = suppMd.f_node || suppMd.end_node;
                    const sLegName = suppMd.s_leg || suppMd.leg;
                    const fLegName = suppMd.f_leg || suppMd.leg;

                    const sPos = sNodeName ? (lookupNode(sNodeName, sLegName) || lookupNode(sNodeName, undefined)) : null;
                    const fPos = fNodeName ? (lookupNode(fNodeName, fLegName) || lookupNode(fNodeName, undefined)) : null;

                    if (sPos && fPos && sPos.distanceTo(fPos) > 0.001) {
                        const midpoint = new THREE.Vector3(
                            (sPos.x + fPos.x) / 2,
                            (sPos.y + fPos.y) / 2,
                            (sPos.z + fPos.z) / 2
                        );
                        const elv = suppMd.elv_1 !== undefined ? sanitizeElevation(suppMd.elv_1) : (sPos.y + fPos.y) / 2;
                        suppMidpoints.push({ elv, midpoint });
                    }
                });

                if (suppMidpoints.length > 0) {
                    suppMidpoints.sort((a, b) => b.elv - a.elv);
                    const y1 = md.elv_1 !== undefined ? sanitizeElevation(md.elv_1) : suppMidpoints[0].elv;
                    const y2 = md.elv_2 !== undefined ? sanitizeElevation(md.elv_2) : suppMidpoints[suppMidpoints.length - 1].elv;
                    const yTop = Math.max(y1, y2);
                    const yBot = Math.min(y1, y2);

                    let topMid = suppMidpoints[0].midpoint.clone();
                    let botMid = suppMidpoints[suppMidpoints.length - 1].midpoint.clone();

                    const distVal = parseFloat(md.dist || "0");
                    const sLegName = (c.s_leg || md.s_leg || "").toString().trim().toUpperCase();
                    const fLegName = (c.f_leg || md.f_leg || "").toString().trim().toUpperCase();
                    const offsetDistance = 0.50; // Outward standoff outside jacket frame

                    let dir = new THREE.Vector3(0, 0, 0);
                    if (startNode && endNode && startNode.distanceTo(endNode) > 0.001) {
                        dir = endNode.clone().sub(startNode).normalize();
                    } else if (sLegName && fLegName && sLegName !== fLegName) {
                        const sL = legMap[sLegName];
                        const fL = legMap[fLegName];
                        if (sL && fL) {
                            const legVec = new THREE.Vector3(fL.x - sL.x, 0, fL.z - sL.z);
                            if (legVec.lengthSq() > 0.001) dir = legVec.normalize();
                        }
                    }

                    if (distVal > 0 && dir.lengthSq() > 0.001) {
                        topMid = startNode
                            ? startNode.clone().add(dir.clone().multiplyScalar(distVal))
                            : topMid.add(dir.clone().multiplyScalar(distVal));

                        const sNodeBot = startNode ? getCoordsAtElv(startNode, startNode.y, yBot) : botMid;
                        botMid = sNodeBot.clone().add(dir.clone().multiplyScalar(distVal));
                    }

                    if (dir.lengthSq() > 0.001) {
                        const perpTop = new THREE.Vector3(-dir.z, 0, dir.x);
                        const vCenterTop = new THREE.Vector3(topMid.x, 0, topMid.z);
                        if (perpTop.dot(vCenterTop) < 0) perpTop.negate();
                        topMid.add(perpTop.multiplyScalar(offsetDistance));

                        const perpBot = new THREE.Vector3(-dir.z, 0, dir.x);
                        const vCenterBot = new THREE.Vector3(botMid.x, 0, botMid.z);
                        if (perpBot.dot(vCenterBot) < 0) perpBot.negate();
                        botMid.add(perpBot.multiplyScalar(offsetDistance));
                    }

                    start.set(topMid.x, yTop, topMid.z);
                    end.set(botMid.x, yBot, botMid.z);
                    resolved = true;
                } else if (hasStartNode && hasEndNode) {
                    const distVal = parseFloat(md.dist || "0");
                    const y1 = sanitizeElevation(md.elv_1);
                    const y2 = sanitizeElevation(md.elv_2);
                    const yTop = Math.max(y1, y2);

                    // Compute start and end node coords at both elevations
                    const sNode1 = getCoordsAtElv(startNode, startNode.y, y1);
                    const eNode1 = getCoordsAtElv(endNode, endNode.y, y1);

                    const sNode2 = getCoordsAtElv(startNode, startNode.y, y2);
                    const eNode2 = getCoordsAtElv(endNode, endNode.y, y2);

                    const sLegName = (c.s_leg || md.s_leg || "").toString().trim().toUpperCase();
                    const fLegName = (c.f_leg || md.f_leg || "").toString().trim().toUpperCase();

                    // Compute points along the members at y1 and y2
                    const len1 = eNode1.distanceTo(sNode1);
                    let dir1 = (len1 > 0.001) ? eNode1.clone().sub(sNode1).normalize() : new THREE.Vector3(0, 0, 0);
                    if (dir1.lengthSq() < 0.001 && sLegName && fLegName && sLegName !== fLegName) {
                        const sL = legMap[sLegName];
                        const fL = legMap[fLegName];
                        if (sL && fL) {
                            const sLegPos = getCoordsAtElv(new THREE.Vector3(sL.x, y1, sL.z), y1, y1);
                            const fLegPos = getCoordsAtElv(new THREE.Vector3(fL.x, y1, fL.z), y1, y1);
                            const legVec = new THREE.Vector3(fLegPos.x - sLegPos.x, 0, fLegPos.z - sLegPos.z);
                            if (legVec.lengthSq() > 0.001) {
                                dir1 = legVec.normalize();
                            }
                        }
                    }
                    const offsetPos1 = sNode1.clone().add(dir1.clone().multiplyScalar(distVal));

                    const len2 = eNode2.distanceTo(sNode2);
                    let dir2 = (len2 > 0.001) ? eNode2.clone().sub(sNode2).normalize() : new THREE.Vector3(0, 0, 0);
                    if (dir2.lengthSq() < 0.001 && sLegName && fLegName && sLegName !== fLegName) {
                        const sL = legMap[sLegName];
                        const fL = legMap[fLegName];
                        if (sL && fL) {
                            const sLegPos = getCoordsAtElv(new THREE.Vector3(sL.x, y2, sL.z), y2, y2);
                            const fLegPos = getCoordsAtElv(new THREE.Vector3(fL.x, y2, fL.z), y2, y2);
                            const legVec = new THREE.Vector3(fLegPos.x - sLegPos.x, 0, fLegPos.z - sLegPos.z);
                            if (legVec.lengthSq() > 0.001) {
                                dir2 = legVec.normalize();
                            }
                        }
                    }
                    const offsetPos2 = sNode2.clone().add(dir2.clone().multiplyScalar(distVal));

                    const offsetDistance = 0.50; // Outward standoff outside jacket frame
                    const finalStart = offsetPos1.clone();
                    const finalEnd = offsetPos2.clone();

                    if (dir1.lengthSq() > 0.001) {
                        const perp1 = new THREE.Vector3(-dir1.z, 0, dir1.x);
                        const vCenter1 = new THREE.Vector3(offsetPos1.x, 0, offsetPos1.z);
                        if (perp1.dot(vCenter1) < 0) {
                            perp1.negate();
                        }
                        finalStart.add(perp1.multiplyScalar(offsetDistance));
                    }

                    if (dir2.lengthSq() > 0.001) {
                        const perp2 = new THREE.Vector3(-dir2.z, 0, dir2.x);
                        const vCenter2 = new THREE.Vector3(offsetPos2.x, 0, offsetPos2.z);
                        if (perp2.dot(vCenter2) < 0) {
                            perp2.negate();
                        }
                        finalEnd.add(perp2.multiplyScalar(offsetDistance));
                    }

                    // Risers slant along with the structure while maintaining a constant standoff distance
                    start.copy(finalStart);
                    end.copy(finalEnd);
                    resolved = true;
                }
            } else if (hasStartNode || hasEndNode) {
                if (hasStartNode) start.copy(startNode!);
                if (hasEndNode) end.copy(endNode!);

                if (hasStartNode && !hasEndNode) end.copy(start);
                else if (!hasStartNode && hasEndNode) start.copy(end);

                resolved = true;
            } else if (md.s_leg) {
                const y = sanitizeElevation(md.elv_1 || (md.depth ? -parseFloat(md.depth) / 10 : 0));
                const coords = getLegCoordsAtElv(md.s_leg, y);
                start.set(coords.x, y, coords.z);
                if (md.f_leg && md.elv_2) {
                    const y2 = sanitizeElevation(md.elv_2);
                    const coords2 = getLegCoordsAtElv(md.f_leg, y2);
                    end.set(coords2.x, y2, coords2.z);
                } else {
                    end.copy(start);
                }
                resolved = true;
            } else if (md.easting || md.northing) {
                const x = parseFloat(md.easting || "0") / 100 || 0;
                const z = parseFloat(md.northing || "0") / 100 || 0;
                start.set(x, maxElv + 2, z);
                end.set(x, minElv, z);
                resolved = true;
            }

            if (!resolved) {
                const layer = Math.floor(i / 16);
                const posInLayer = i % 16;
                const radius = 20 + layer * 2;
                const angle = (posInLayer / 16) * Math.PI * 2;
                start.set(Math.cos(angle) * radius, -layer * 4, Math.sin(angle) * radius);
                end.set(start.x, start.y + 4, start.z);
            }

            intermediateLayouts.set(c.id, { component: c, start, end, thickness });
        });

        // Pass 1.8: Resolve pending riser support clamps along parent risers
        pendingRiserSupports.forEach(({ component, riserNum, targetElv }) => {
            // Find parent riser layout in intermediateLayouts
            let parentLayout: any = null;
            for (const layout of Array.from(intermediateLayouts.values())) {
                const comp = layout.component;
                const compCode = (comp.code || "").toUpperCase();
                const isRiser = compCode === "RS" || compCode.includes("RISER") || compCode.includes("RISR");
                if (isRiser) {
                    const qIdUpper = (comp.q_id || comp.name || "").toUpperCase();
                    if (
                        qIdUpper.startsWith(`R${riserNum}-`) ||
                        qIdUpper.startsWith(`R${riserNum}_`) ||
                        qIdUpper.includes(`R${riserNum}-`) ||
                        qIdUpper.includes(`R${riserNum}_`) ||
                        qIdUpper.includes(`R-${riserNum}`) ||
                        qIdUpper.includes(`RISER${riserNum}`) ||
                        qIdUpper.includes(`RISER-${riserNum}`) ||
                        qIdUpper.includes(`RISER ${riserNum}`) ||
                        qIdUpper.includes(`RIS-${riserNum}`) ||
                        qIdUpper.includes(`RIS_${riserNum}`) ||
                        qIdUpper === `R${riserNum}` ||
                        qIdUpper === `RIS-${riserNum}` ||
                        qIdUpper === `RISER${riserNum}`
                    ) {
                        parentLayout = layout;
                        break;
                    }
                }
            }

            if (parentLayout) {
                const start = new THREE.Vector3();
                const end = new THREE.Vector3();

                const y1 = parentLayout.start.y;
                const y2 = parentLayout.end.y;

                if (Math.abs(y2 - y1) > 0.001) {
                    const t = (targetElv - y1) / (y2 - y1);
                    const clampedT = Math.max(0, Math.min(1, t));
                    start.copy(parentLayout.start).lerp(parentLayout.end, clampedT);
                } else {
                    start.copy(parentLayout.start);
                    start.setY(targetElv);
                }

                // Align with riser direction
                const direction = parentLayout.end.clone().sub(parentLayout.start).normalize();
                if (direction.lengthSq() > 0.1) {
                    end.copy(start).add(direction.multiplyScalar(0.4)); // 0.4m clamp length
                } else {
                    end.copy(start).add(new THREE.Vector3(0, 0.4, 0));
                }

                const thickness = parentLayout.thickness * 1.35;
                intermediateLayouts.set(component.id, { component, start, end, thickness });
            } else {
                // Fallback if parent riser is not found (render in unresolved area)
                const start = new THREE.Vector3(0, targetElv, 20);
                const end = start.clone().add(new THREE.Vector3(0, 0.4, 0));
                intermediateLayouts.set(component.id, { component, start, end, thickness: 0.3 });
            }
        });

        const spanMap = new Map<string, typeof pendingSpanAccessories>();
        pendingSpanAccessories.forEach((item) => {
            const key = `${item.sNode.x.toFixed(3)},${item.sNode.y.toFixed(3)},${item.sNode.z.toFixed(3)}|${item.fNode.x.toFixed(3)},${item.fNode.y.toFixed(3)},${item.fNode.z.toFixed(3)}`;
            if (!spanMap.has(key)) spanMap.set(key, []);
            spanMap.get(key)!.push(item);
        });

        spanMap.forEach((items, key) => {
            const sNode = items[0].sNode;
            const fNode = items[0].fNode;

            items.sort((a, b) => a.component.q_id.localeCompare(b.component.q_id));
            const count = items.length;

            items.forEach((item, idx) => {
                const md = item.component.metadata || {};
                const itemCode = (item.component.code || "").toUpperCase();
                const itemQId = (item.component.q_id || "").toUpperCase();
                const isAnode = itemCode === "AN" || itemCode.includes("ANOD");

                let start = new THREE.Vector3();
                let end = new THREE.Vector3();

                if (isAnode) {
                    // For anodes on member spans, default to equal gap distribution (1 anode = middle t=0.5)
                    const t = (idx + 1) / (count + 1);
                    start.copy(sNode).lerp(fNode, t);
                } else if ((md.elv_1 || md.depth) && Math.abs(fNode.y - sNode.y) > 0.001) {
                    const targetY = sanitizeElevation(md.elv_1 || -parseFloat(md.depth) / 10);
                    const t = (targetY - sNode.y) / (fNode.y - sNode.y);
                    const clampedT = Math.max(0, Math.min(1, t));
                    start.copy(sNode).lerp(fNode, clampedT);
                } else {
                    const t = (idx + 1) / (count + 1);
                    start.copy(sNode).lerp(fNode, t);
                }

                if (md.dist && !isAnode) {
                    const distance = parseFloat(md.dist);
                    if (distance > 0 && distance < 3.0) {
                        const clockPos = parseFloat(md.clk_pos || "12");
                        const angle = (clockPos / 12) * Math.PI * 2;
                        start.x += Math.sin(angle) * distance;
                        start.z += Math.cos(angle) * distance;
                    }
                }

                const direction = fNode.clone().sub(sNode).normalize();
                if (direction.lengthSq() > 0.1) {
                    end.copy(start).add(direction.clone().multiplyScalar(0.8));
                } else {
                    end.copy(start);
                }

                intermediateLayouts.set(item.component.id, {
                    component: item.component,
                    start,
                    end,
                    thickness: 0.15,
                });
            });
        });

        // Pass 2: Resolve attachments relative to their parents
        const pendingAttachmentsByParent = new Map<number, typeof components>();
        pendingAttachments.forEach((c) => {
            const parentId = c.metadata?.associated_comp_id;
            if (parentId) {
                if (!pendingAttachmentsByParent.has(parentId)) {
                    pendingAttachmentsByParent.set(parentId, []);
                }
                pendingAttachmentsByParent.get(parentId)!.push(c);
            } else {
                const fallbackId = -1;
                if (!pendingAttachmentsByParent.has(fallbackId)) {
                    pendingAttachmentsByParent.set(fallbackId, []);
                }
                pendingAttachmentsByParent.get(fallbackId)!.push(c);
            }
        });

        let unattachedIndex = 0;
        pendingAttachmentsByParent.forEach((children, parentId) => {
            if (parentId === -1) {
                children.forEach((c) => {
                    let start = new THREE.Vector3();
                    const layer = Math.floor(unattachedIndex / 16);
                    const radius = 25 + layer * 2;
                    const angle = (unattachedIndex / 16) * Math.PI * 2;
                    start.set(Math.cos(angle) * radius, maxElv, Math.sin(angle) * radius);
                    let end = start.clone();
                    intermediateLayouts.set(c.id, { component: c, start, end, thickness: 0.15 });
                    unattachedIndex++;
                });
                return;
            }

            const parentLayout = intermediateLayouts.get(parentId);
            if (!parentLayout) {
                children.forEach((c) => {
                    let start = new THREE.Vector3();
                    const layer = Math.floor(unattachedIndex / 16);
                    const radius = 25 + layer * 2;
                    const angle = (unattachedIndex / 16) * Math.PI * 2;
                    start.set(Math.cos(angle) * radius, maxElv, Math.sin(angle) * radius);
                    let end = start.clone();
                    intermediateLayouts.set(c.id, { component: c, start, end, thickness: 0.15 });
                    unattachedIndex++;
                });
                return;
            }

            const { start: pStart, end: pEnd, thickness: pThickness, component: parentComp } = parentLayout;
            const parentCode = (parentComp?.code || "").toUpperCase();
            const parentQId = (parentComp?.q_id || "").toUpperCase();
            const isParentCaisson = parentCode === "CS" || parentCode === "CA" || parentCode.includes("CAIS") || parentQId.startsWith("CS-");
            let caissonTop = pStart.clone();
            if (isParentCaisson) {
                const pMd = parentComp?.metadata || {};
                const sNodeName = (pMd.s_node || pMd.start_node || parentComp?.s_node || "").toString().trim().toUpperCase();
                const sLegName = (pMd.s_leg || pMd.leg || parentComp?.s_leg || "").toString().trim().toUpperCase();
                const sNodePos = sNodeName ? (lookupNode(sNodeName, sLegName) || lookupNode(sNodeName, undefined)) : null;
                if (sNodePos) {
                    caissonTop = sNodePos.clone();
                } else {
                    caissonTop = pStart.clone().add(new THREE.Vector3(0, 0.275, 0));
                }
            }

            const direction = pEnd.clone().sub(isParentCaisson ? caissonTop : pStart).normalize();

            const anodeChildren = children.filter((c) => {
                const code = (c.code || "").toUpperCase();
                return code === "AN" || code.includes("ANOD");
            });

            if (anodeChildren.length > 0) {
                // Force equal spacing for all anodes attached to a member
                anodeChildren.sort((a, b) => a.q_id.localeCompare(b.q_id));
                const anodeCount = anodeChildren.length;
                anodeChildren.forEach((c, idx) => {
                    let start = new THREE.Vector3();
                    let end = new THREE.Vector3();
                    const t = (idx + 1) / (anodeCount + 1);
                    start.copy(isParentCaisson ? caissonTop : pStart).lerp(pEnd, t);
                    if (direction.lengthSq() > 0.1) {
                        end.copy(start).add(direction.clone().multiplyScalar(0.1));
                    } else {
                        end.copy(start);
                    }
                    intermediateLayouts.set(c.id, { component: c, start, end, thickness: pThickness });
                });
            }

            const nonAnodeChildren = children.filter((c) => {
                const code = (c.code || "").toUpperCase();
                return code !== "AN" && !code.includes("ANOD");
            });

            const childrenWithPos = nonAnodeChildren.filter((c) => c.metadata?.depth || c.metadata?.elv_1);
            const childrenWithoutPos = nonAnodeChildren.filter((c) => !c.metadata?.depth && !c.metadata?.elv_1);

            childrenWithoutPos.sort((a, b) => a.q_id.localeCompare(b.q_id));

            childrenWithPos.forEach((c) => {
                const md = c.metadata || {};
                let thickness = pThickness;
                let start = new THREE.Vector3();
                let end = new THREE.Vector3();

                const targetY = sanitizeElevation(md.elv_1 || -parseFloat(md.depth) / 10);
                const topRef = isParentCaisson ? caissonTop : pStart;
                if (Math.abs(pEnd.y - topRef.y) > 0.001) {
                    const t = (targetY - topRef.y) / (pEnd.y - topRef.y);
                    const clampedT = Math.max(0, Math.min(1, t));
                    start.copy(topRef).lerp(pEnd, clampedT);
                } else {
                    start.copy(topRef).add(pEnd).multiplyScalar(0.5);
                    start.setY(targetY);
                }

                const cCode = (c.code || "").toUpperCase();
                const cQId = (c.q_id || "").toUpperCase();
                const isChildCaissonSupport = cCode === "WP" || cCode === "CL" || cQId.includes("SUPP") || cQId.includes("CLP");

                if (isChildCaissonSupport && isParentCaisson) {
                    end.copy(start).add(direction.clone().multiplyScalar(0.001));
                } else if (direction.lengthSq() > 0.1) {
                    end.copy(start).add(direction.clone().multiplyScalar(0.1));
                } else {
                    end.copy(start);
                }
                intermediateLayouts.set(c.id, { component: c, start, end, thickness });
            });

            const count = childrenWithoutPos.length;
            childrenWithoutPos.forEach((c, idx) => {
                let thickness = pThickness;
                let start = new THREE.Vector3();
                let end = new THREE.Vector3();

                const t = (idx + 1) / (count + 1);
                start.copy(pStart).lerp(pEnd, t);

                if (direction.lengthSq() > 0.1) {
                    end.copy(start).add(direction.clone().multiplyScalar(0.1));
                } else {
                    end.copy(start);
                }
                intermediateLayouts.set(c.id, { component: c, start, end, thickness });
            });
        });

        // Align endpoint welds with connecting members
        intermediateLayouts.forEach((layout) => {
            const c = layout.component;
            const code = (c.code || "").toUpperCase();
            const isWeld = code === "WN" || code === "WP" || code.includes("WELD");

            if (isWeld && layout.start.distanceTo(layout.end) < 0.001) {
                const md = c.metadata || {};
                const leg = (md.s_leg || md.f_leg || md.leg || "").toUpperCase();
                const isCorner = leg && !md.associated_comp_id;

                if (isCorner) {
                    // Set corner node welds to be vertical cylinders
                    const verticalDir = new THREE.Vector3(0, 1, 0);
                    layout.end.copy(layout.start.clone().add(verticalDir.multiplyScalar(0.1)));
                } else {
                    const nodeName = String(md.s_node || "")
                        .toUpperCase()
                        .trim();
                    if (nodeName) {
                        let foundMemberLayout: any = null;
                        if (md.associated_comp_id) {
                            foundMemberLayout = intermediateLayouts.get(md.associated_comp_id);
                        }
                        if (!foundMemberLayout) {
                            for (const otherLayout of Array.from(intermediateLayouts.values())) {
                                const otherComp = otherLayout.component;
                                const otherCode = (otherComp.code || "").toUpperCase();
                                const isMember = ["HM", "HOM", "HD", "HDM", "VM", "VD", "VDM"].includes(otherCode);
                                if (isMember) {
                                    const otherMd = otherComp.metadata || {};
                                    const sNodeStr = String(otherMd.s_node || "")
                                        .toUpperCase()
                                        .trim();
                                    const fNodeStr = String(otherMd.f_node || "")
                                        .toUpperCase()
                                        .trim();
                                    if (sNodeStr === nodeName || fNodeStr === nodeName) {
                                        foundMemberLayout = otherLayout;
                                        break;
                                    }
                                }
                            }
                        }

                        if (foundMemberLayout) {
                            const mStart = foundMemberLayout.start;
                            const mEnd = foundMemberLayout.end;
                            const mDist = mStart.distanceTo(mEnd);
                            if (mDist > 0.001) {
                                const dir = mEnd.clone().sub(mStart).normalize();
                                layout.end.copy(layout.start.clone().add(dir.multiplyScalar(0.1)));
                            }
                        }
                    }
                }
            }
        });

        const initialResolvedLayouts = Array.from(intermediateLayouts.values())
            // Filter out any layouts where coordinates are NaN or non-finite
            .filter((layout) => {
                const coords = [
                    layout.start.x,
                    layout.start.y,
                    layout.start.z,
                    layout.end.x,
                    layout.end.y,
                    layout.end.z,
                ];
                return coords.every((v) => isFinite(v));
            })
            // Filter out leg and CGF guide frame components from the 3D visualization
            .filter((layout) => {
                const code = (layout.component.code || "").toUpperCase();
                const qId = (layout.component.q_id || "").toUpperCase();
                const isCgf = code === "CF" || qId.includes("CGF");
                const isPile = code === "PL" || code === "PILE" || qId.includes("PILE");
                if (isPile) return true;
                return !(code === "LG" || code === "LEG" || qId.includes("LEG") || isCgf);
            })
            .map((layout) => ({
                id: `${layout.component.id}`,
                component: layout.component,
                start: [layout.start.x, layout.start.y, layout.start.z] as [number, number, number],
                end: [layout.end.x, layout.end.y, layout.end.z] as [number, number, number],
                thickness: layout.thickness,
            }));

        const conductorLayouts: {
            id: string;
            component: any;
            start: [number, number, number];
            end: [number, number, number];
            thickness: number;
        }[] = [];

        const conductors = components.filter(c => {
            const code = (c.code || "").toUpperCase();
            return code === "CD" || (c.q_id || "").toUpperCase().includes("CON");
        });

        conductors.forEach(c => {
            const md = c.metadata || {};
            const topElv = sanitizeElevation(md.elv_1 || 3);
            const botElv = sanitizeElevation(md.elv_2 || -55);
            const condName = (c.q_id || "").toUpperCase();
            const numMatch = condName.match(/\d+/);
            if (!numMatch) return;
            const indexStr = numMatch[0];

            // Find all CGF (Conductor Guide Frame) components that match this index
            const matchingCgfs = components.filter(other => {
                const otherCode = (other.code || "").toUpperCase();
                const otherQId = (other.q_id || "").toUpperCase();
                const isCgf = otherCode === "CF" || otherQId.includes("CGF");
                return isCgf && otherQId.includes(indexStr);
            });

            // Map CGFs to their elevations and midpoints
            const cgfMidpoints: { elv: number; midpoint: THREE.Vector3 }[] = [];
            matchingCgfs.forEach(cgf => {
                const cgfMd = cgf.metadata || {};
                const sPos = lookupNode(cgfMd.s_node, cgfMd.s_leg);
                const fPos = lookupNode(cgfMd.f_node, cgfMd.f_leg);
                if (sPos && fPos) {
                    const midpoint = new THREE.Vector3(
                        (sPos.x + fPos.x) / 2,
                        (sPos.y + fPos.y) / 2,
                        (sPos.z + fPos.z) / 2
                    );
                    const elv = sanitizeElevation(cgfMd.elv_1 || cgfMd.elv_2 || sPos.y);
                    cgfMidpoints.push({ elv, midpoint });
                }
            });

            // Sort midpoints by elevation descending (top to bottom)
            cgfMidpoints.sort((a, b) => b.elv - a.elv);

            // Generate segments
            if (cgfMidpoints.length > 0) {
                // Generate segments between consecutive midpoints
                for (let i = 0; i < cgfMidpoints.length - 1; i++) {
                    const startMid = cgfMidpoints[i];
                    const endMid = cgfMidpoints[i + 1];
                    conductorLayouts.push({
                        id: `${c.id}-seg-${i}`,
                        component: c,
                        start: [startMid.midpoint.x, startMid.elv, startMid.midpoint.z],
                        end: [endMid.midpoint.x, endMid.elv, endMid.midpoint.z],
                        thickness: 0.10,
                    });
                }
                // Append bottom extension segment if target botElv is lower than the last guide frame
                const lastFrame = cgfMidpoints[cgfMidpoints.length - 1];
                if (botElv < lastFrame.elv - 0.1) {
                    conductorLayouts.push({
                        id: `${c.id}-seg-bottom`,
                        component: c,
                        start: [lastFrame.midpoint.x, lastFrame.elv, lastFrame.midpoint.z],
                        end: [lastFrame.midpoint.x, botElv, lastFrame.midpoint.z],
                        thickness: 0.10,
                    });
                }
                // Prepend top extension segment if target topElv is higher than the first guide frame
                const firstFrame = cgfMidpoints[0];
                if (topElv > firstFrame.elv + 0.1) {
                    conductorLayouts.push({
                        id: `${c.id}-seg-top`,
                        component: c,
                        start: [firstFrame.midpoint.x, topElv, firstFrame.midpoint.z],
                        end: [firstFrame.midpoint.x, firstFrame.elv, firstFrame.midpoint.z],
                        thickness: 0.10,
                    });
                }
            } else {
                // Fallback to vertical line at s_node coordinate if no guide frame matched
                const startNode = lookupNode(md.s_node, md.s_leg);
                if (startNode) {
                    conductorLayouts.push({
                        id: `${c.id}-fallback`,
                        component: c,
                        start: [startNode.x, topElv, startNode.z],
                        end: [startNode.x, botElv, startNode.z],
                        thickness: 0.10,
                    });
                }
            }
        });

        const resolvedLayouts = [
            ...initialResolvedLayouts,
            ...conductorLayouts
        ];

        const getComponentLegs = (comp: any) => {
            const compMd = comp.metadata || {};
            let targetComp = comp;
            if (compMd.associated_comp_id) {
                const parent = components.find((c) => c.id === compMd.associated_comp_id);
                if (parent) {
                    targetComp = parent;
                }
            }
            const targetMd = targetComp.metadata || {};
            const sNodeKey = (targetMd.s_node || "").toUpperCase();
            const fNodeKey = (targetMd.f_node || "").toUpperCase();
            const sLeg = (
                targetMd.s_leg ||
                nodeLegMap.get(sNodeKey) ||
                nodeLegMap.get(`N${sNodeKey}`) ||
                ""
            ).toUpperCase();
            const fLeg = (
                targetMd.f_leg ||
                nodeLegMap.get(fNodeKey) ||
                nodeLegMap.get(`N${fNodeKey}`) ||
                ""
            ).toUpperCase();
            return { sLeg, fLeg };
        };

        // Helper to check if component belongs strictly to the face plane (outermost members only)
        const isComponentOnFace = (comp: any, faceName: string) => {
            const compMd = comp.metadata || {};
            const faceObj = faces.find((f) => f.face?.toUpperCase() === faceName.toUpperCase());
            if (!faceObj) return false;

            const fFrom = (faceObj.face_from || "").toUpperCase();
            const fTo = (faceObj.face_to || "").toUpperCase();
            const faceLegs = [fFrom, fTo].filter(Boolean);
            if (faceLegs.length !== 2) return false;

            const { sLeg, fLeg } = getComponentLegs(comp);
            if (!sLeg || !fLeg) return false;

            const sMatch = faceLegs.includes(sLeg);
            const fMatch = faceLegs.includes(fLeg);

            // Outermost face members only: both ends must belong to the face's leg set {fFrom, fTo}
            if (sMatch && fMatch) return true;

            // If explicit face metadata is present, still require the component to be on the face legs
            if (compMd.face?.toUpperCase() === faceName.toUpperCase()) {
                return sMatch && fMatch;
            }

            return false;
        };

        const filteredLayouts = resolvedLayouts.filter((layout) => {
            const c = layout.component;
            const md = c.metadata || {};

            // Filter out riser guard supports (e.g. RISG 1-SUPP-A1) from the 3D scene representation
            const qidUpper = (c.q_id || "").toUpperCase();
            if (qidUpper.startsWith("RISG") && qidUpper.includes("-SUPP-")) {
                return false;
            }



            return true;
        });

        const filteredFoundationMembers = foundationMembers.filter((m) => {
            if (m.id.startsWith("leg-")) {
                return true;
            }

            if (m.id.startsWith("face-")) {
                const faceName = m.label;
            }

            // Both start and end coordinates of foundation members must match selected elevations

            return true;
        });

        const filteredElvMarkers = elvMarkers.filter((m) => {
            return true;
        });

        return {
            componentLayouts: filteredLayouts,
            foundationMembers: filteredFoundationMembers,
            elvMarkers: filteredElvMarkers,
        };
    })();

  return { componentLayouts, foundationMembers, elvMarkers };
}


export async function syncWebapp3D(supabase: any, structureId: number) {
  try {
    // 1. Fetch Platform Details
    const { data: platformDetails } = await supabase
      .from("u_lib_list")
      .select("*")
      .eq("structure_id", structureId)
      .single();

    // 2. Fetch Elevations
    const { data: elevations } = await supabase
      .from("platform_elevation")
      .select("*")
      .eq("plat_id", structureId);

    // 3. Fetch Faces
    const { data: faces } = await supabase
      .from("platform_faces")
      .select("*")
      .eq("plat_id", structureId);

    // 4. Fetch Components (Paginated)
    let rawComponents: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;
    while (hasMore) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data, error } = await supabase
        .from("structure_components")
        .select("*")
        .eq("structure_id", structureId)
        .eq("is_deleted", false)
        .range(from, to);

      if (error || !data || data.length === 0) {
        hasMore = false;
      } else {
        rawComponents = rawComponents.concat(data);
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      }
    }

    const excludeCodes = ["IT", "FV", "HS", "GP", "PG", "PC", "RC", "RB", "SD", "FA"];
    const components = (rawComponents || [])
      .filter((c: any) => {
          const code = (c.code || "").trim().toUpperCase();
          const qIdUpper = (c.q_id || "").toUpperCase();
          const isRiserSupport = qIdUpper.includes("SUPP") || qIdUpper.includes("CLP");
          if ((excludeCodes.includes(code) || code.startsWith("FA") || code.includes("FACE")) && !isRiserSupport) return false;
          if (qIdUpper.startsWith("FACE") || /^FACE[\s\-]/i.test(qIdUpper)) return false;
          if (code === "WN") {
              const md = c.metadata || c;
              const sNode = (md.s_node || "").toString().trim().toUpperCase();
              const fNode = (md.f_node || "").toString().trim().toUpperCase();
              if (sNode && fNode && sNode !== fNode) return false;
          }

          if (/^FEND\s+\d+-SUPP-/i.test(qIdUpper)) return false;
          if (qIdUpper.endsWith("TERM")) return false;
          return true;
      })
      .map((c: any) => ({
          ...c.metadata,
          ...c,
          qid: c.q_id,
          type: c.code,
      }));

    // 5. Generate coordinates
    const { componentLayouts } = generatePlatform3DCoordinates(
      platformDetails || {},
      elevations || [],
      faces || [],
      components
    );

    if (!componentLayouts || componentLayouts.length === 0) return;

    // 6. Delete old and Upsert new webapp_3d
    await supabase.from("webapp_3d").delete().eq("structure_id", structureId);
    
    const insertData = componentLayouts.map((m: any) => {
      const startX = m.start?.x ?? m.start?.[0] ?? m.position?.[0] ?? 0;
      const startY = m.start?.y ?? m.start?.[1] ?? m.position?.[1] ?? 0;
      const startZ = m.start?.z ?? m.start?.[2] ?? m.position?.[2] ?? 0;
      const endX = m.end?.x ?? m.end?.[0] ?? startX;
      const endY = m.end?.y ?? m.end?.[1] ?? startY;
      const endZ = m.end?.z ?? m.end?.[2] ?? startZ;
      const posX = (startX + endX) / 2;
      const posY = (startY + endY) / 2;
      const posZ = (startZ + endZ) / 2;
      return {
        structure_id: structureId,
        component_id: m.id,
        start_x: startX,
        start_y: startY,
        start_z: startZ,
        end_x: endX,
        end_y: endY,
        end_z: endZ,
        pos_x: posX,
        pos_y: posY,
        pos_z: posZ,
        rot_x: m.rotation?.[0] || 0,
        rot_y: m.rotation?.[1] || 0,
        rot_z: m.rotation?.[2] || 0,
        scale_x: m.scale?.[0] || 1,
        scale_y: m.scale?.[1] || 1,
        scale_z: m.scale?.[2] || 1,
        shape_type: m.shape || (startX === endX && startY === endY && startZ === endZ ? "sphere" : "cylinder"),
        dimensions: { length: m.length, radius: m.thickness, offset: m.offsetDistance },
        color_hex: m.color || null,
        material_type: "steel",
        opacity: 1.0,
        visibility_flag: true,
        has_geometry_issue: false,
      };
    });

    // Chunk the insert to avoid postgres limits
    const chunkSize = 500;
    for (let i = 0; i < insertData.length; i += chunkSize) {
      const chunk = insertData.slice(i, i + chunkSize);
      await supabase.from("webapp_3d").insert(chunk);
    }
    
    console.log(`Successfully synced ${insertData.length} 3D components for structure ${structureId}`);
  } catch (err) {
    console.error("Error syncing webapp_3d:", err);
  }
}
