const SUPABASE_URL = 'https://zpsmxtdqlpbdwfzctqzd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc214dGRxbHBiZHdmemN0cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY4NDIzODIsImV4cCI6MjA0MjQxODM4Mn0.t3uO7vnabDlwaz5iM6i8A-ya9cc6X20ZTn0bcR3zzs4';

const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
};

async function fetchJson(url) {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return res.json();
}

const THREE = require('three');

async function run(withLegFix) {
    try {
        const platId = 204;
        const platformDetails = (await fetchJson(`${SUPABASE_URL}/rest/v1/platform?plat_id=eq.${platId}`))[0];
        const faces = (await fetchJson(`${SUPABASE_URL}/rest/v1/str_faces?plat_id=eq.${platId}`)).filter(Boolean);
        const elevations = (await fetchJson(`${SUPABASE_URL}/rest/v1/str_elv?plat_id=eq.${platId}`)).filter(Boolean);
        const components = await fetchJson(`${SUPABASE_URL}/rest/v1/structure_components?structure_id=eq.${platId}&is_deleted=eq.false&limit=2000`);

        const SPACING = 15;
        const legMap = {};
        const allLegNamesSet = new Set();
        for (let i = 1; i <= 20; i++) {
            const name = platformDetails[`leg_t${i}`];
            if (name) allLegNamesSet.add(name.toString().toUpperCase());
        }
        faces.forEach((f) => {
            if (f.face_from) allLegNamesSet.add(f.face_from.toUpperCase());
            if (f.face_to) allLegNamesSet.add(f.face_to.toUpperCase());
        });

        const allLegNames = Array.from(allLegNamesSet);
        const rowLetters = Array.from(new Set(allLegNames.map((n) => n.match(/([A-Z]+)/)?.[1] || ""))).filter(Boolean).sort();
        const colNumbers = Array.from(new Set(allLegNames.map((n) => n.match(/(\d+)/)?.[1] || ""))).filter(Boolean).sort((a, b) => parseInt(a) - parseInt(b));

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

        const sanitizeElevation = (elvStr) => {
            if (!elvStr) return 0;
            return parseFloat(elvStr.toString().replace(/[^0-9.-]/g, "")) || 0;
        };

        const getScaleAtY = (points, yVal) => {
            if (!points || points.length === 0) return 1.0;
            if (points.length === 1) return points[0].scale;
            if (yVal >= points[points.length - 1].y) return points[points.length - 1].scale;
            if (yVal <= points[0].y) return points[0].scale;

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
            } else {
                if (!zScalesByY.has(p.y)) zScalesByY.set(p.y, []);
                zScalesByY.get(p.y).push(p.length / SPACING);
            }
        });

        const xPoints = Array.from(xScalesByY.entries()).map(([y, arr]) => ({
            y,
            scale: arr.reduce((sum, v) => sum + v, 0) / arr.length,
        })).sort((a, b) => a.y - b.y);

        const zPoints = Array.from(zScalesByY.entries()).map(([y, arr]) => ({
            y,
            scale: arr.reduce((sum, v) => sum + v, 0) / arr.length,
        })).sort((a, b) => a.y - b.y);

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

        const registerNodeAlias = (alias, vec, legKey) => {
            const key = alias.toUpperCase();
            nodeMap.set(key, vec);
            if (legKey) {
                nodeLegMap.set(key, legKey);
                const compositeKey = `${key}|${legKey.toUpperCase()}`;
                nodeMap.set(compositeKey, vec);
                nodeLegMap.set(compositeKey, legKey);
            }
        };

        const getExistingNodeVector = (nodeId, legKey) => {
            const normalized = nodeId.toUpperCase().trim();
            const aliases = [normalized];
            if (/^N\d+$/.test(normalized)) aliases.push(normalized.slice(1));
            if (/^\d+$/.test(normalized)) aliases.push(`N${normalized}`);
            if (!normalized.startsWith("WN")) {
                aliases.push(`WN ${normalized}`);
                aliases.push(`WN${normalized}`);
            }
            for (const alias of aliases) {
                if (alias.startsWith("WN") && nodeMap.has(alias)) {
                    const vec = nodeMap.get(alias);
                    if (vec.x !== 0 || vec.z !== 0) return vec;
                }
            }
            for (const alias of aliases) {
                if (legKey) {
                    const compositeKey = `${alias}|${legKey.toUpperCase()}`;
                    if (nodeMap.has(compositeKey)) {
                        const vec = nodeMap.get(compositeKey);
                        if (vec.x !== 0 || vec.z !== 0) return vec;
                    }
                }
                if (nodeMap.has(alias)) {
                    const vec = nodeMap.get(alias);
                    if (!withLegFix) {
                        const nodeLeg = nodeLegMap.get(alias);
                        if (nodeLeg && legKey && nodeLeg.toUpperCase() !== legKey.toUpperCase()) {
                            continue;
                        }
                    }
                    if (vec.x !== 0 || vec.z !== 0) return vec;
                }
            }
            return undefined;
        };

        const lookupNode = (nodeId, legName) => {
            if (!nodeId) return undefined;
            const normalizedNodeId = nodeId.toUpperCase().trim();
            const legKey = legName?.toUpperCase() || "";
            const aliases = [normalizedNodeId];
            if (/^N\d+$/.test(normalizedNodeId)) aliases.push(normalizedNodeId.slice(1));
            if (/^\d+$/.test(normalizedNodeId)) aliases.push(`N${normalizedNodeId}`);
            
            for (const alias of aliases) {
                if (legKey) {
                    const compositeKey = `${alias}|${legKey}`;
                    if (nodeMap.has(compositeKey)) return nodeMap.get(compositeKey);
                }
                if (nodeMap.has(alias)) return nodeMap.get(alias);
            }
            return undefined;
        };

        const processNode = (nodeName, legName, elv, depth, easting, northing, isPrimary) => {
            if (!nodeName) return;
            const normalizedNodeName = nodeName.toUpperCase();
            const legKey = legName?.toUpperCase() || "";
            let x = 0, y = 0, z = 0;
            if (elv) y = sanitizeElevation(elv);
            if (legKey) {
                const coords = getLegCoordsAtElv(legKey, y);
                x = coords.x;
                z = coords.z;
            }
            
            const existingVec = getExistingNodeVector(normalizedNodeName, legKey);
            const vec = existingVec || new THREE.Vector3(x, y, z);
            registerNodeAlias(normalizedNodeName, vec, legKey);
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

        const childWeldGroups = new Map();
        components.forEach((c) => {
            const md = c.metadata || {};
            const code = (c.code || "").toUpperCase();
            if (code === "WN" && md.associated_comp_id) {
                const parentId = md.associated_comp_id;
                if (!childWeldGroups.has(parentId)) {
                    childWeldGroups.set(parentId, []);
                }
                childWeldGroups.get(parentId).push(c);
            }
        });

        const intermediateLayouts = new Map();

        for (let iter = 0; iter < 3; iter++) {
            childWeldGroups.forEach((children, parentId) => {
                const parentComp = components.find((c) => c.id === parentId);
                if (!parentComp) return;

                const parentMd = parentComp.metadata || {};
                const pStart = lookupNode(parentMd.s_node, parentMd.s_leg);
                const pEnd = lookupNode(parentMd.f_node, parentMd.f_leg);
                if (!pStart || !pEnd) return;

                const direction = pEnd.clone().sub(pStart).normalize();

                children.sort((a, b) => {
                    const distA = parseFloat(a.metadata?.dist || "0");
                    const distB = parseFloat(b.metadata?.dist || "0");
                    if (distA !== distB) return distA - distB;
                    return (a.q_id || "").localeCompare(b.q_id || "");
                });

                const count = children.length;
                children.forEach((c, idx) => {
                    let t = (idx + 1) / (count + 1);
                    const distVal = parseFloat(c.metadata?.dist);
                    if (!isNaN(distVal) && distVal > 0) {
                        const dx = Math.abs(pEnd.x - pStart.x);
                        const dy = Math.abs(pEnd.y - pStart.y);
                        const dz = Math.abs(pEnd.z - pStart.z);
                        const model_projected_span = Math.max(dx, dy, dz);
                        if (model_projected_span > 0.01) {
                            t = Math.max(0, Math.min(1, distVal / model_projected_span));
                        }
                    }
                    const pos = pStart.clone().lerp(pEnd, t);

                    const nodeName = (c.metadata?.s_node || "").toUpperCase();
                    if (nodeName) {
                        const nodeVec = lookupNode(nodeName, "");
                        if (nodeVec) {
                            nodeVec.copy(pos);
                        } else {
                            const newVec = pos.clone();
                            registerNodeAlias(nodeName, newVec, "");
                            registerNodeAlias(c.q_id, newVec, "");
                        }
                    }

                    // Set start/end layout for the weld
                    const start = pos.clone();
                    const end = pos.clone();
                    if (direction.lengthSq() > 0.1) {
                        end.add(direction.clone().multiplyScalar(0.1));
                    }
                    intermediateLayouts.set(c.id, { component: c, start, end, thickness: 0.2 });
                });
            });

            // Project cantilever/protruding members
            components.forEach((c) => {
                const md = c.metadata || {};
                const code = (c.code || "").toUpperCase();
                const isMember = ["HM", "HOM", "HD", "HDM", "VM", "VD", "VDM"].includes(code);
                if (isMember && md.clk_pos && md.clk_pos !== "N/A" && md.dist) {
                    const sNodePos = lookupNode(md.s_node, md.s_leg);
                    if (!sNodePos) return;

                    let parentComp = null;
                    const parentWeld = components.find(
                        (w) =>
                            (w.code || "").toUpperCase() === "WN" &&
                            (w.metadata?.s_node || "").toUpperCase() === (md.s_node || "").toUpperCase() &&
                            w.metadata?.associated_comp_id
                    );
                    if (parentWeld) {
                        parentComp = components.find((pc) => pc.id === parentWeld.metadata.associated_comp_id);
                    }

                    const dir = new THREE.Vector3(0, 0, -1);
                    if (parentComp) {
                        const pStart = lookupNode(parentComp.metadata.s_node, parentComp.metadata.s_leg);
                        const pEnd = lookupNode(parentComp.metadata.f_node, parentComp.metadata.f_leg);
                        if (pStart && pEnd && pStart.distanceTo(pEnd) > 0.01) {
                            dir.copy(pEnd).sub(pStart).normalize();
                        }
                    }

                    const up = new THREE.Vector3(0, 1, 0);
                    if (Math.abs(dir.y) > 0.99) {
                        up.set(0, 0, -1);
                    }
                    up.sub(dir.clone().multiplyScalar(up.dot(dir))).normalize();
                    const right = new THREE.Vector3().crossVectors(dir, up).normalize();

                    const clockPos = parseFloat(md.clk_pos);
                    if (!isNaN(clockPos)) {
                        const angle = (clockPos / 12) * Math.PI * 2;
                        const offsetDir = right
                            .clone()
                            .multiplyScalar(Math.sin(angle))
                            .add(up.clone().multiplyScalar(Math.cos(angle)))
                            .normalize();

                        const distance = parseFloat(md.dist);
                        if (!isNaN(distance)) {
                            const fNodePos = sNodePos.clone().add(offsetDir.multiplyScalar(distance));
                            const fNodeName = (md.f_node || "").toUpperCase();
                            if (fNodeName) {
                                const fNodeVec = lookupNode(fNodeName, "");
                                if (fNodeVec) {
                                    fNodeVec.copy(fNodePos);
                                } else {
                                    const newVec = fNodePos.clone();
                                    registerNodeAlias(fNodeName, newVec, "");
                                }
                            }
                        }
                    }
                }
            });
        }

        // Final coordinates resolution
        const pendingAttachments = [];

        components.forEach((c) => {
            const md = c.metadata || {};
            const code = (c.code || "").toUpperCase();

            const isAnode = code === "AN" || code.includes("ANOD");
            const isWeld = code === "WN" || code === "WP" || code.includes("WELD");
            const isClamp = code === "CL" || code === "CP" || code.includes("CLAMP");
            const isPointAccessory = isAnode || isWeld || isClamp;

            if (code === "WN" && md.associated_comp_id) {
                return;
            }

            const startNode = lookupNode(md.s_node, md.s_leg);
            const endNode = lookupNode(md.f_node, md.f_leg);
            const hasStartNode = !!startNode;
            const hasEndNode = !!endNode;

            let start = new THREE.Vector3();
            let end = new THREE.Vector3();
            let resolved = false;

            if (md.associated_comp_id) {
                pendingAttachments.push(c);
                return;
            } else if (hasStartNode || hasEndNode) {
                if (hasStartNode) start.copy(startNode);
                if (hasEndNode) end.copy(endNode);
                if (hasStartNode && !hasEndNode) end.copy(start);
                else if (!hasStartNode && hasEndNode) start.copy(end);
                resolved = true;
            } else if (md.s_leg) {
                const y = sanitizeElevation(md.elv_1);
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
            }

            if (resolved) {
                intermediateLayouts.set(c.id, { component: c, start, end });
            }
        });

        // Resolve pending attachments
        pendingAttachments.forEach(c => {
            const md = c.metadata || {};
            const code = (c.code || "").toUpperCase();
            const parentId = md.associated_comp_id;
            const parentLayout = intermediateLayouts.get(parentId);
            if (!parentLayout) return;

            const pStart = parentLayout.start;
            const pEnd = parentLayout.end;

            const startNode = lookupNode(md.s_node, md.s_leg);
            const endNode = lookupNode(md.f_node, md.f_leg);
            const hasStartNode = !!startNode;
            const hasEndNode = !!endNode;

            let start = new THREE.Vector3();
            let end = new THREE.Vector3();

            const isAnode = code === "AN" || code.includes("ANOD");
            const isWeld = code === "WN" || code === "WP" || code.includes("WELD");
            const isClamp = code === "CL" || code === "CP" || code.includes("CLAMP");
            const isPointAccessory = isAnode || isWeld || isClamp;

            if (isPointAccessory && (hasStartNode || hasStartNode !== hasEndNode || md.s_leg)) {
                const y = md.elv_1 ? sanitizeElevation(md.elv_1) : (startNode?.y ?? endNode?.y ?? 0);
                if (startNode) {
                    start.set(startNode.x, y, startNode.z);
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
                intermediateLayouts.set(c.id, { component: c, start, end });
            }
        });

        // Align endpoint welds
        intermediateLayouts.forEach((layout) => {
            const c = layout.component;
            const code = (c.code || "").toUpperCase();
            const isWeld = code === "WN" || code === "WP" || code.includes("WELD");

            if (isWeld && layout.start.distanceTo(layout.end) < 0.001) {
                const md = c.metadata || {};
                const leg = (md.s_leg || md.f_leg || md.leg || "").toUpperCase();
                const isCorner = leg && !md.associated_comp_id;

                if (!isCorner) {
                    const nodeName = String(md.s_node || "").toUpperCase().trim();
                    if (nodeName) {
                        let foundMemberLayout = null;
                        if (md.associated_comp_id) {
                            foundMemberLayout = intermediateLayouts.get(md.associated_comp_id);
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

        // Print comparative outputs
        const n4n3 = Array.from(intermediateLayouts.values()).find(l => l.component.q_id === "HOM N4-N3");
        const n4an4b = Array.from(intermediateLayouts.values()).find(l => l.component.q_id === "HOM N4A-N4B");
        const wnn4a = Array.from(intermediateLayouts.values()).find(l => l.component.q_id === "WN N4A");
        const wnn4b = Array.from(intermediateLayouts.values()).find(l => l.component.q_id === "WN N4B");
        const clamp = Array.from(intermediateLayouts.values()).find(l => l.component.q_id === "CS-S1-SUPP 3M");

        console.log(`\n--- Run withLegFix = ${withLegFix} ---`);
        if (n4n3) console.log(`HOM N4-N3:     Start (${n4n3.start.x.toFixed(3)}, ${n4n3.start.z.toFixed(3)}) -> End (${n4n3.end.x.toFixed(3)}, ${n4n3.end.z.toFixed(3)})`);
        if (n4an4b) console.log(`HOM N4A-N4B:   Start (${n4an4b.start.x.toFixed(3)}, ${n4an4b.start.z.toFixed(3)}) -> End (${n4an4b.end.x.toFixed(3)}, ${n4an4b.end.z.toFixed(3)})`);
        if (wnn4a) console.log(`WN N4A (Start): Start (${wnn4a.start.x.toFixed(3)}, ${wnn4a.start.z.toFixed(3)}) -> End (${wnn4a.end.x.toFixed(3)}, ${wnn4a.end.z.toFixed(3)})`);
        if (wnn4b) console.log(`WN N4B (End):   Start (${wnn4b.start.x.toFixed(3)}, ${wnn4b.start.z.toFixed(3)}) -> End (${wnn4b.end.x.toFixed(3)}, ${wnn4b.end.z.toFixed(3)})`);
        if (clamp) console.log(`Clamp:         Start (${clamp.start.x.toFixed(3)}, ${clamp.start.z.toFixed(3)})`);

    } catch (err) {
        console.error(err);
    }
}

async function start() {
    await run(false);
    await run(true);
}

start();
