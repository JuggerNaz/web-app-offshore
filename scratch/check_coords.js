const fs = require('fs');
const THREE = require('three');

async function run() {
    const envText = fs.readFileSync('.env.local', 'utf8');
    const key = envText.split('NEXT_PUBLIC_SUPABASE_ANON_KEY=')[1].split('\n')[0].trim();
    const url = envText.split('NEXT_PUBLIC_SUPABASE_URL=')[1].split('\n')[0].trim();

    const platRes = await fetch(`${url}/rest/v1/platform?plat_id=eq.1507&select=*`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const platformDetails = (await platRes.json())[0];

    const elvRes = await fetch(`${url}/rest/v1/str_elv?plat_id=eq.1507&select=*`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const elevations = await elvRes.json();

    const facesRes = await fetch(`${url}/rest/v1/str_faces?plat_id=eq.1507&select=*`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const faces = await facesRes.json();

    const compRes = await fetch(`${url}/rest/v1/structure_components?structure_id=eq.1507&select=*`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const rawComponents = await compRes.json();

    const excludeCodes = ["IT", "CU", "FV", "HS", "GP", "PG", "PC", "RC", "RB", "SD", "CS"];
    const components = rawComponents.filter((c) => {
        const code = (c.code || "").trim().toUpperCase();
        if (excludeCodes.includes(code)) return false;
        const isNodeWeld = code === "WN";
        if (isNodeWeld && c.q_id && c.q_id.includes("-")) return false;
        return true;
    });

    const sanitizeElevation = (elvVal) => {
        if (elvVal === undefined || elvVal === null) return 0;
        let val = typeof elvVal === "number" ? elvVal : parseFloat(elvVal);
        if (isNaN(val)) return 0;
        if (val === 50.772) return -50.772;
        if (val < -1000) return val / 1000;
        return val;
    };

    const SPACING = 15;
    const legMap = {};
    const allLegNamesSet = new Set();
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

    const rowLetters = Array.from(new Set(allLegNames.map((n) => n.match(/([A-Z]+)/)?.[1] || "")))
        .filter(Boolean)
        .sort();
    const colNumbers = Array.from(new Set(allLegNames.map((n) => n.match(/(\d+)/)?.[1] || "")))
        .filter(Boolean)
        .sort((a, b) => parseInt(a) - parseInt(b));

    const centerRow = (rowLetters.length - 1) / 2;
    const centerCol = (colNumbers.length - 1) / 2;

    const legRowCol = {};
    allLegNames.forEach((name) => {
        const match = name.match(/([A-Z]+)(\d+)/);
        if (match) {
            const letter = match[1];
            const num = match[2];
            const rowIndex = rowLetters.indexOf(letter);
            const colIndex = colNumbers.indexOf(num);

            legMap[name] = {
                x: (colIndex - centerCol) * SPACING,
                z: -(rowIndex - centerRow) * SPACING,
            };
            legRowCol[name.toUpperCase()] = { row: rowIndex, col: colIndex };
        }
    });

    const dataPoints = [];
    components.forEach((c) => {
        const code = (c.code || "").toUpperCase();
        if (!["HM", "HOM", "HD", "HDM"].includes(code)) return;
        const md = c.metadata || {};
        if (!md.s_leg || !md.f_leg) return;
        const sLeg = md.s_leg.toUpperCase();
        const fLeg = md.f_leg.toUpperCase();
        if (sLeg === fLeg) return;

        const sInfo = legRowCol[sLeg];
        const fInfo = legRowCol[fLeg];
        if (!sInfo || !fInfo) return;

        const y1 = sanitizeElevation(md.elv_1 || (md.depth ? -parseFloat(md.depth) / 10 : undefined));
        const y2 = sanitizeElevation(md.elv_2 || (md.depth ? -parseFloat(md.depth) / 10 : undefined));
        if (Math.abs(y1 - y2) > 0.01) return;

        const lengthVal = parseFloat(md.length || md.additionalInfo?.length || "0");
        if (isNaN(lengthVal) || lengthVal <= 0.1) return;

        const colDiff = Math.abs(fInfo.col - sInfo.col);
        const rowDiff = Math.abs(fInfo.row - sInfo.row);

        if (sInfo.row === fInfo.row && colDiff > 0) {
            dataPoints.push({ y: y1, length: lengthVal / colDiff, type: "X" });
        } else if (sInfo.col === fInfo.col && rowDiff > 0) {
            dataPoints.push({ y: y1, length: lengthVal / rowDiff, type: "Z" });
        }
    });

    const xScalesByY = new Map();
    const zScalesByY = new Map();
    dataPoints.forEach((p) => {
        if (p.type === "X") {
            if (!xScalesByY.has(p.y)) xScalesByY.set(p.y, []);
            xScalesByY.get(p.y).push(p.length / SPACING);
        } else if (p.type === "Z") {
            if (!zScalesByY.has(p.y)) zScalesByY.set(p.y, []);
            zScalesByY.get(p.y).push(p.length / SPACING);
        }
    });

    const xPoints = [];
    const zPoints = [];
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

    const getScaleAtY = (points, yVal) => {
        if (points.length === 0) return 1.0;
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

    const getLegCoordsAtElv = (legName, yVal) => {
        const key = legName.toUpperCase();
        if (legMap[key]) {
            const nominal = legMap[key];
            const scaleX = getScaleAtY(xPoints, yVal);
            const scaleZ = getScaleAtY(zPoints, yVal);
            return { x: nominal.x * scaleX, z: nominal.z * scaleZ };
        }
        return { x: 0, z: 0 };
    };

    const nodeMap = new Map();
    const nodeLegMap = new Map();

    const getExistingNodeVector = (nodeId) => {
        const normalized = nodeId.toUpperCase().trim();
        const aliases = [normalized];
        if (/^N\d+$/.test(normalized)) aliases.push(normalized.slice(1));
        if (/^\d+$/.test(normalized)) aliases.push(`N${normalized}`);
        if (!normalized.startsWith("WN")) {
            aliases.push(`WN ${normalized}`);
            aliases.push(`WN${normalized}`);
        }
        for (const alias of aliases) {
            if (nodeMap.has(alias)) {
                const vec = nodeMap.get(alias);
                if (vec.x !== 0 || vec.z !== 0) return vec;
            }
        }
        return undefined;
    };

    const registerNodeAlias = (alias, vec, legKey) => {
        const key = alias.toUpperCase();
        const existingVec = getExistingNodeVector(key);
        const activeVec = existingVec || vec;

        if (!nodeMap.has(key) || (nodeMap.get(key).x === 0 && nodeMap.get(key).z === 0)) {
            nodeMap.set(key, activeVec);
            if (legKey) nodeLegMap.set(key, legKey);
        }
        if (legKey) {
            const compositeKey = `${key}|${legKey}`;
            if (!nodeMap.has(compositeKey) || (nodeMap.get(compositeKey).x === 0 && nodeMap.get(compositeKey).z === 0)) {
                nodeMap.set(compositeKey, activeVec);
                nodeLegMap.set(compositeKey, legKey);
            }
        }
    };

    const processNode = (nodeName, legName, elv, depth, easting, northing, isPrimary) => {
        if (!nodeName) return;
        const normalizedNodeName = nodeName.toUpperCase();
        const legKey = legName?.toUpperCase() || "";
        let x = 0, y = 0, z = 0;

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

    const extractBareNode = (q_id) => {
        const matchFull = q_id.match(/WN\s*(N?[A-Za-z0-9]+)/i);
        const matchBare = q_id.match(/(?:WN\s*)?(N?(\d+))$/i);
        if (matchFull) return matchFull[1].toUpperCase();
        if (matchBare) return matchBare[1].toUpperCase();
        return q_id.toUpperCase();
    };

    const lookupNode = (nodeId, legName) => {
        if (!nodeId) return undefined;
        const normalizedNodeId = nodeId.toUpperCase().trim();
        const legKey = legName?.toUpperCase() || "";

        const aliases = [normalizedNodeId];
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

        for (const alias of aliases) {
            if (legKey) {
                const compositeKey = `${alias}|${legKey}`;
                if (nodeMap.has(compositeKey)) return nodeMap.get(compositeKey);
            }
            if (nodeMap.has(alias)) return nodeMap.get(alias);
        }
        return undefined;
    };

    // PASS 1: Authoritative Root Node Providers
    const intermediateWelds = [];
    components.forEach((c) => {
        const md = c.metadata || {};
        const code = (c.code || "").toUpperCase();
        const isWeld = code === "WN" || code === "WP" || code.includes("WELD");

        if (isWeld || code.includes("NODE") || code === "ND") {
            const bareNode = extractBareNode(c.q_id);
            const sNode = (md.s_node || "").toUpperCase();
            const fNode = (md.f_node || "").toUpperCase();
            const isIntermediate = sNode && fNode && sNode !== bareNode && fNode !== bareNode;

            if (isIntermediate) {
                intermediateWelds.push(c);
                return;
            }

            const leg = (md.s_leg || md.f_leg || md.leg || "").toUpperCase();
            const elv = md.elv_1 || md.elv_2 || md.depth;
            const ePlainNum = md.elv_1 || md.elv_2;

            let y = 0;
            if (ePlainNum) y = sanitizeElevation(ePlainNum);
            else if (md.depth) y = -sanitizeElevation(md.depth) / 10;

            let x = 0, z = 0;
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

    // PASS 1.2: Register endpoints for primary members
    components.forEach((c) => {
        const md = c.metadata || {};
        const code = (c.code || "").toUpperCase();
        const isPrimary = ["HM", "HOM", "HD", "HDM", "VM", "VD", "VDM", "LG", "LEG"].includes(code);
        if (isPrimary) {
            processNode(md.s_node, md.s_leg, md.elv_1, md.depth, md.easting, md.northing, true);
            processNode(md.f_node, md.f_leg, md.elv_2, md.depth, md.easting, md.northing, true);
        }
    });

    // PASS 2: Intermediate Node Welds
    const intermediateWeldGroups = new Map();
    intermediateWelds.forEach((c) => {
        const md = c.metadata || {};
        const sNode = lookupNode(md.s_node, md.s_leg);
        const fNode = lookupNode(md.f_node, md.f_leg);
        if (sNode && fNode) {
            const key = `${sNode.x.toFixed(3)},${sNode.y.toFixed(3)},${sNode.z.toFixed(3)}|${fNode.x.toFixed(3)},${fNode.y.toFixed(3)},${fNode.z.toFixed(3)}`;
            if (!intermediateWeldGroups.has(key)) intermediateWeldGroups.set(key, []);
            intermediateWeldGroups.get(key).push(c);
        }
    });

    intermediateWeldGroups.forEach((items, key) => {
        const md0 = items[0].metadata || {};
        const sNode = lookupNode(md0.s_node, md0.s_leg);
        const fNode = lookupNode(md0.f_node, md0.f_leg);

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
                let t = (idx + 1) / (count + 1);
                const distVal = parseFloat(md.dist);
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
                    const angle = (clockPos / 12) * Math.PI * 2;
                    pos.x += Math.sin(angle) * distance;
                    pos.z += Math.cos(angle) * distance;
                }
            }

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

    const intermediateLayouts = new Map();

    // Main layouts
    components.forEach((c, i) => {
        const md = c.metadata || {};
        const code = (c.code || "").toUpperCase();

        if (code === "WN" && md.associated_comp_id) {
            return;
        }

        const isAnode = code === "AN" || code.includes("ANOD");
        const isWeld = code === "WN" || code === "WP" || code.includes("WELD");
        const isClamp = code === "CL" || code.includes("CLAM");
        const isPointAccessory = isAnode || isWeld || isClamp;

        let thickness = 0.15;
        const startNode = lookupNode(md.s_node, md.s_leg);
        const endNode = lookupNode(md.f_node, md.f_leg);
        const hasStartNode = !!startNode;
        const hasEndNode = !!endNode;

        let start = new THREE.Vector3();
        let end = new THREE.Vector3();
        let resolved = false;

        if (isPointAccessory && (hasStartNode || hasStartNode !== hasEndNode || md.s_leg)) {
            const y = md.elv_1 ? sanitizeElevation(md.elv_1) : (startNode?.y ?? endNode?.y ?? 0);
            if (startNode) {
                start.set(startNode.x, y, startNode.z);
            } else if (md.s_leg) {
                const coords = getLegCoordsAtElv(md.s_leg.toUpperCase(), y);
                start.set(coords.x, y, coords.z);
            }
            end.copy(start);
            resolved = true;
        } else if (hasStartNode || hasEndNode) {
            if (hasStartNode) start.copy(startNode);
            if (hasEndNode) end.copy(endNode);
            resolved = true;
        }

        if (resolved) {
            intermediateLayouts.set(c.id, { component: c, start, end, thickness });
        }
    });

    console.log("All resolved layout q_ids and their positions:");
    intermediateLayouts.forEach((layout) => {
        if (layout.component.code === "WN" && layout.component.metadata.elv_1 === "3") {
            console.log(`- ${layout.component.q_id} (ID: ${layout.component.id}): Start=(${layout.start.x.toFixed(3)}, ${layout.start.y.toFixed(3)}, ${layout.start.z.toFixed(3)})`);
        }
    });
}

run();
