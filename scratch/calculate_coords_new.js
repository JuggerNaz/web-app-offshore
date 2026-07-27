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

class Vec3 {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
    copy(v) {
        this.x = v.x;
        this.y = v.y;
        this.z = v.z;
        return this;
    }
    clone() {
        return new Vec3(this.x, this.y, this.z);
    }
    sub(v) {
        this.x -= v.x;
        this.y -= v.y;
        this.z -= v.z;
        return this;
    }
    normalize() {
        const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
        if (len > 0) {
            this.x /= len;
            this.y /= len;
            this.z /= len;
        }
        return this;
    }
    lerp(v, alpha) {
        this.x += (v.x - this.x) * alpha;
        this.y += (v.y - this.y) * alpha;
        this.z += (v.z - this.z) * alpha;
        return this;
    }
    distanceTo(v) {
        const dx = this.x - v.x;
        const dy = this.y - v.y;
        const dz = this.z - v.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
}

async function run() {
    try {
        const platId = 203;
        
        // Fetch inputs
        const platformDetails = (await fetchJson(`${SUPABASE_URL}/rest/v1/platform?plat_id=eq.${platId}`))[0];
        const rawComps = await fetchJson(`${SUPABASE_URL}/rest/v1/structure_components?structure_id=eq.${platId}&is_deleted=eq.false&limit=2000`);
        const elevations = await fetchJson(`${SUPABASE_URL}/rest/v1/str_elv?plat_id=eq.${platId}`);
        const faces = await fetchJson(`${SUPABASE_URL}/rest/v1/str_faces?plat_id=eq.${platId}`);

        // Filter components like page.tsx does
        const excludeCodes = ["IT", "CU", "FV", "HS", "GP", "PG", "PC", "RC", "RB", "SD"];
        const components = rawComps.filter((c) => {
            const code = (c.code || "").trim().toUpperCase();
            if (excludeCodes.includes(code)) return false;
            const isNodeWeld = code === "WN";
            if (isNodeWeld && c.q_id && c.q_id.includes("-")) return false;
            return true;
        });

        // 1. Determine Leg Footprints and Grid Centering
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

        const sanitizeElevation = (elvVal) => {
            if (elvVal === undefined || elvVal === null) return 0;
            let val = typeof elvVal === "number" ? elvVal : parseFloat(elvVal);
            if (isNaN(val)) return 0;
            if (val === 50.772) return -50.772;
            if (val < -1000) return val / 1000;
            return val;
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
            } else if (p.type === "Z") {
                if (!zScalesByY.has(p.y)) zScalesByY.set(p.y, []);
                zScalesByY.get(p.y).push(p.length / SPACING);
            }
        });

        const xPoints = [];
        const zPoints = [];
        xScalesByY.forEach((scales, y) => {
            xPoints.push({ y, scale: scales.reduce((a, b) => a + b, 0) / scales.length });
        });
        zScalesByY.forEach((scales, y) => {
            zPoints.push({ y, scale: scales.reduce((a, b) => a + b, 0) / scales.length });
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

        // Let's trace node coordinate generation!
        const nodeMap = new Map();
        const registerNodeAlias = (alias, vec, legKey) => {
            const key = alias.toUpperCase().trim();
            nodeMap.set(key, vec);
            if (legKey) {
                nodeMap.set(`${key}|${legKey.toUpperCase()}`, vec);
            }
        };

        const lookupNode = (nodeId, legName) => {
            if (!nodeId) return undefined;
            const normalized = nodeId.toUpperCase().trim();
            const legKey = legName?.toUpperCase() || "";
            const aliases = [normalized];
            if (/^N\d+$/.test(normalized)) aliases.push(normalized.slice(1));
            if (/^\d+$/.test(normalized)) aliases.push(`N${normalized}`);
            if (!normalized.startsWith("WN")) {
                aliases.push(`WN ${normalized}`);
                aliases.push(`WN${normalized}`);
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

        const processNode = (nodeName, legName, elv, depth) => {
            if (!nodeName) return;
            const normalizedNodeName = nodeName.toUpperCase();
            const legKey = legName?.toUpperCase() || "";
            
            let y = 0;
            if (elv) y = sanitizeElevation(elv);
            else if (depth) y = -sanitizeElevation(depth) / 10;

            let x = 0, z = 0;
            if (legKey) {
                const coords = getLegCoordsAtElv(legKey, y);
                x = coords.x;
                z = coords.z;
            }
            const vec = new Vec3(x, y, z);
            registerNodeAlias(normalizedNodeName, vec, legKey);
        };

        // Run PASS 1: Authoritative Root Nodes (WN)
        components.forEach((c) => {
            const md = c.metadata || {};
            const code = (c.code || "").toUpperCase();
            const isWeld = code === "WN" || code === "WP" || code.includes("WELD");

            if ((isWeld || code.includes("NODE") || code === "ND") && !md.associated_comp_id) {
                const leg = (md.s_leg || md.f_leg || md.leg || "").toUpperCase();
                const elv = md.elv_1 || md.elv_2 || md.depth;
                let y = 0;
                if (elv) y = sanitizeElevation(elv);
                
                let x = 0, z = 0;
                if (leg) {
                    const coords = getLegCoordsAtElv(leg, y);
                    x = coords.x;
                    z = coords.z;
                }
                const vec = new Vec3(x, y, z);
                registerNodeAlias(c.q_id, vec, leg);
                
                const matchFull = c.q_id.match(/WN\s*(N?[A-Za-z0-9]+)/i);
                if (matchFull) {
                    const withN = matchFull[1].toUpperCase();
                    registerNodeAlias(withN, vec, leg);
                    const numOnly = withN.replace(/^N/, "");
                    registerNodeAlias(numOnly, vec, leg);
                    registerNodeAlias(`N${numOnly}`, vec, leg);
                }
            }
        });

        // Run PASS 1.2: Register endpoints for primary member components
        components.forEach((c) => {
            const md = c.metadata || {};
            const code = (c.code || "").toUpperCase();
            const isPrimary = ["HM", "HOM", "HD", "HDM", "VM", "VD", "VDM", "LG", "LEG"].includes(code);
            if (isPrimary) {
                processNode(md.s_node, md.s_leg, md.elv_1, md.depth);
                processNode(md.f_node, md.f_leg, md.elv_2, md.depth);
            }
        });

        // Run PASS 1.7: child node welds (WN) on parent members
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

        console.log("Interpolating child welds (NEW LEG-BASED METHOD):");
        for (let iter = 0; iter < 3; iter++) {
            childWeldGroups.forEach((children, parentId) => {
                const parentComp = components.find((c) => c.id === parentId);
                if (!parentComp) return;

                const parentMd = parentComp.metadata || {};
                
                // Let's resolve the parent's actual leg endpoints if possible!
                let pStart, pEnd;
                const sLeg = parentMd.s_leg?.toUpperCase();
                const fLeg = parentMd.f_leg?.toUpperCase();
                
                if (sLeg && fLeg && sLeg !== fLeg) {
                    const y1 = sanitizeElevation(parentMd.elv_1 || (parentMd.depth ? -parseFloat(parentMd.depth) / 10 : undefined));
                    const y2 = sanitizeElevation(parentMd.elv_2 || (parentMd.depth ? -parseFloat(parentMd.depth) / 10 : undefined));
                    const coordsStart = getLegCoordsAtElv(sLeg, y1);
                    const coordsEnd = getLegCoordsAtElv(fLeg, y2);
                    pStart = new Vec3(coordsStart.x, y1, coordsStart.z);
                    pEnd = new Vec3(coordsEnd.x, y2, coordsEnd.z);
                } else {
                    pStart = lookupNode(parentMd.s_node, parentMd.s_leg);
                    pEnd = lookupNode(parentMd.f_node, parentMd.f_leg);
                }

                if (!pStart || !pEnd) return;

                children.sort((a, b) => {
                    const distA = parseFloat(a.metadata?.dist || "0");
                    const distB = parseFloat(b.metadata?.dist || "0");
                    if (distA !== distB) return distA - distB;
                    return (a.q_id || "").localeCompare(b.q_id || "");
                });

                // The divisor should be the full leg-to-leg distance!
                const legToLegDistance = pStart.distanceTo(pEnd);

                children.forEach((c, idx) => {
                    let t = (idx + 1) / (children.length + 1);
                    const distVal = parseFloat(c.metadata?.dist);
                    if (!isNaN(distVal) && distVal > 0 && legToLegDistance > 0.01) {
                        t = Math.max(0, Math.min(1, distVal / legToLegDistance));
                    }
                    const pos = pStart.clone().lerp(pEnd, t);

                    if (["WN N12", "WN N18", "WN N13", "WN N19"].includes(c.metadata?.description)) {
                        console.log(`[Iter ${iter}] ${c.metadata.description}:`);
                        console.log(`  Legs: s_leg=${sLeg}, f_leg=${fLeg}`);
                        console.log(`  pStart=[${pStart.x.toFixed(3)}, ${pStart.y.toFixed(3)}, ${pStart.z.toFixed(3)}], pEnd=[${pEnd.x.toFixed(3)}, ${pEnd.y.toFixed(3)}, ${pEnd.z.toFixed(3)}]`);
                        console.log(`  dist=${c.metadata.dist}, legToLegDistance=${legToLegDistance.toFixed(3)}, t=${t.toFixed(4)}`);
                        console.log(`  Computed Pos: [${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)}]`);
                    }

                    const nodeName = (c.metadata?.s_node || "").toUpperCase();
                    if (nodeName) {
                        const nodeVec = lookupNode(nodeName, "");
                        if (nodeVec) {
                            nodeVec.copy(pos);
                        } else {
                            registerNodeAlias(nodeName, pos, "");
                        }
                    }
                });
            });
        }

    } catch (err) {
        console.error(err);
    }
}

run();
