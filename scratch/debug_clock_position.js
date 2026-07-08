const fs = require('fs');
const path = require('path');

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
    add(v) {
        this.x += v.x;
        this.y += v.y;
        this.z += v.z;
        return this;
    }
    multiplyScalar(s) {
        this.x *= s;
        this.y *= s;
        this.z *= s;
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
    dot(v) {
        return this.x * v.x + this.y * v.y + this.z * v.z;
    }
    crossVectors(a, b) {
        const ax = a.x, ay = a.y, az = a.z;
        const bx = b.x, by = b.y, bz = b.z;
        this.x = ay * bz - az * by;
        this.y = az * bx - ax * bz;
        this.z = ax * by - ay * bx;
        return this;
    }
    lengthSq() {
        return this.x * this.x + this.y * this.y + this.z * this.z;
    }
}

async function run() {
    try {
        const platId = 203;
        const platformDetails = (await fetchJson(`${SUPABASE_URL}/rest/v1/platform?plat_id=eq.${platId}`))[0];
        const rawComps = await fetchJson(`${SUPABASE_URL}/rest/v1/structure_components?structure_id=eq.${platId}&is_deleted=eq.false&limit=2000`);
        const elevations = await fetchJson(`${SUPABASE_URL}/rest/v1/str_elv?plat_id=eq.${platId}`);
        const faces = await fetchJson(`${SUPABASE_URL}/rest/v1/str_faces?plat_id=eq.${platId}`);

        const excludeCodes = ["IT", "CU", "FV", "HS", "GP", "PG", "PC", "RC", "RB", "SD"];
        const components = rawComps.filter((c) => {
            const code = (c.code || "").trim().toUpperCase();
            if (excludeCodes.includes(code)) return false;
            const isNodeWeld = code === "WN";
            if (isNodeWeld && c.q_id && c.q_id.includes("-")) return false;
            return true;
        });

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
        
        allLegNames.forEach((name) => {
            const match = name.match(/([A-Z]+)(\d+)/);
            if (match) {
                const letter = match[1];
                const num = match[2];
                const rIdx = rowLetters.indexOf(letter);
                const cIdx = colNumbers.indexOf(num);
                if (rIdx !== -1 && cIdx !== -1) {
                    const x = (cIdx - centerCol) * SPACING;
                    const z = (rIdx - centerRow) * SPACING;
                    legMap[name] = new Vec3(x, 0, z);
                }
            }
        });

        const nodeMap = new Map();
        const nodeMetadataMap = new Map();

        function registerNodeAlias(name, pos, desc) {
            if (!name) return;
            const key = name.toUpperCase();
            nodeMap.set(key, pos);
            if (desc) nodeMetadataMap.set(key, desc);
        }

        function lookupNode(name, legHint) {
            if (!name) return null;
            const key = name.toUpperCase();
            if (nodeMap.has(key)) return nodeMap.get(key);
            if (legHint) {
                const legKey = legHint.toUpperCase();
                const lpos = legMap[legKey];
                if (lpos) {
                    const pos = lpos.clone();
                    return pos;
                }
            }
            if (legMap[key]) {
                return legMap[key].clone();
            }
            return null;
        }

        function sanitizeElevation(val) {
            const num = parseFloat(val);
            return isNaN(num) ? 0 : num;
        }

        function extractBareNode(qId) {
            if (!qId) return "";
            const m = qId.match(/WN\s*N?(\d+)/i) || qId.match(/N?(\d+)/);
            return m ? m[1] : qId;
        }

        // Pass 1: Primary nodes
        components.forEach((c) => {
            const md = c.metadata || {};
            const code = (c.code || "").toUpperCase();
            const isWeld = code === "WN" || code === "WP" || code.includes("WELD");
            const isNode = isWeld || code.includes("NODE") || code === "ND";
            const isPrimary = ["HM", "HOM", "HD", "HDM", "VM", "VD", "VDM", "LG", "LEG"].includes(code);

            if (isNode && isPrimary) {
                const elv = sanitizeElevation(md.elv_1 || md.elv_2 || 0);
                const legName = (md.s_leg || md.f_leg || "").toUpperCase();
                const nodeName = (md.s_node || md.f_node || "").toUpperCase();

                let basePos = lookupNode(nodeName, legName);
                if (!basePos && legName) {
                    basePos = lookupNode(legName, "");
                }
                const pos = basePos ? basePos.clone() : new Vec3(0, 0, 0);
                pos.y = elv;

                if (md.easting && md.northing) {
                    pos.x = parseFloat(md.easting);
                    pos.z = parseFloat(md.northing);
                }

                registerNodeAlias(nodeName, pos, md.description);
                registerNodeAlias(extractBareNode(c.q_id), pos, md.description);
            }
        });

        // Pass 2: Intermediate welds
        const intermediateWelds = [];
        components.forEach((c) => {
            const md = c.metadata || {};
            const code = (c.code || "").toUpperCase();
            const isWeld = code === "WN" || code === "WP" || code.includes("WELD");
            const isNode = isWeld || code.includes("NODE") || code === "ND";
            const isPrimary = ["HM", "HOM", "HD", "HDM", "VM", "VD", "VDM", "LG", "LEG"].includes(code);
            if (isNode && !isPrimary) {
                intermediateWelds.push(c);
            }
        });

        const intermediateWeldGroups = new Map();
        intermediateWelds.forEach((c) => {
            const md = c.metadata || {};
            
            // Check if there is an associated component
            let sNode = null;
            let fNode = null;
            if (md.associated_comp_id) {
                const parent = components.find(pc => pc.id === md.associated_comp_id);
                if (parent) {
                    sNode = lookupNode(parent.metadata?.s_node, parent.metadata?.s_leg);
                    fNode = lookupNode(parent.metadata?.f_node, parent.metadata?.f_leg);
                }
            }
            
            if (!sNode || !fNode) {
                sNode = lookupNode(md.s_node, md.s_leg);
                fNode = lookupNode(md.f_node, md.f_leg);
            }
            
            if (sNode && fNode) {
                const key = `${sNode.x.toFixed(3)},${sNode.y.toFixed(3)},${sNode.z.toFixed(3)}|${fNode.x.toFixed(3)},${fNode.y.toFixed(3)},${fNode.z.toFixed(3)}`;
                if (!intermediateWeldGroups.has(key)) intermediateWeldGroups.set(key, []);
                intermediateWeldGroups.get(key).push(c);
            }
        });

        intermediateWeldGroups.forEach((items, key) => {
            // Find parent endpoints
            const md0 = items[0].metadata || {};
            let sNode = null;
            let fNode = null;
            if (md0.associated_comp_id) {
                const parent = components.find(pc => pc.id === md0.associated_comp_id);
                if (parent) {
                    sNode = lookupNode(parent.metadata?.s_node, parent.metadata?.s_leg);
                    fNode = lookupNode(parent.metadata?.f_node, parent.metadata?.f_leg);
                }
            }
            if (!sNode || !fNode) {
                sNode = lookupNode(md0.s_node, md0.s_leg);
                fNode = lookupNode(md0.f_node, md0.f_leg);
            }

            items.sort((a, b) => a.q_id.localeCompare(b.q_id));
            const count = items.length;

            items.forEach((item, idx) => {
                const md = item.metadata || {};
                let pos = new Vec3();

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

                if (md.dist && (!md.associated_comp_id || item.code !== "WN")) {
                    const distance = parseFloat(md.dist);
                    if (distance > 0 && distance < 3.0) {
                        const clockPos = parseFloat(md.clk_pos || "12");
                        const angle = (clockPos / 12) * Math.PI * 2;
                        pos.x += Math.sin(angle) * distance;
                        pos.z += Math.cos(angle) * distance;
                    }
                }

                registerNodeAlias(item.q_id, pos, md.description);
                registerNodeAlias(extractBareNode(item.q_id), pos, md.description);
            });
        });

        // Pass 3: Cantilever projection
        console.log("\nProjections:");
        components.forEach((c) => {
            const md = c.metadata || {};
            const code = (c.code || "").toUpperCase();
            const isMember = ["HM", "HOM", "HD", "HDM", "VM", "VD", "VDM"].includes(code);
            if (isMember && md.clk_pos && md.clk_pos !== "N/A" && md.dist) {
                const sNodePos = lookupNode(md.s_node, md.s_leg);
                if (!sNodePos) {
                    console.log(`No sNodePos for member ${c.metadata.description}`);
                    return;
                }

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

                const dir = new Vec3(0, 0, -1);
                if (parentComp) {
                    const pStart = lookupNode(parentComp.metadata.s_node, parentComp.metadata.s_leg);
                    const pEnd = lookupNode(parentComp.metadata.f_node, parentComp.metadata.f_leg);
                    if (pStart && pEnd && pStart.distanceTo(pEnd) > 0.01) {
                        dir.copy(pEnd).sub(pStart).normalize();
                    }
                }

                const up = new Vec3(0, 1, 0);
                if (Math.abs(dir.y) > 0.99) {
                    up.set(0, 0, -1);
                }
                up.sub(dir.clone().multiplyScalar(up.dot(dir))).normalize();
                const right = new Vec3().crossVectors(dir, up).normalize();

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
                        const fNodePos = sNodePos.clone().add(offsetDir.clone().multiplyScalar(distance));
                        console.log(`Member: ${md.description}`);
                        console.log(`  sNode: ${md.s_node} -> ${JSON.stringify(sNodePos)}`);
                        console.log(`  parentComp: ${parentComp ? parentComp.metadata.description : 'None'}`);
                        console.log(`  dir: [${dir.x.toFixed(3)}, ${dir.y.toFixed(3)}, ${dir.z.toFixed(3)}]`);
                        console.log(`  up: [${up.x.toFixed(3)}, ${up.y.toFixed(3)}, ${up.z.toFixed(3)}]`);
                        console.log(`  right: [${right.x.toFixed(3)}, ${right.y.toFixed(3)}, ${right.z.toFixed(3)}]`);
                        console.log(`  clk_pos: ${md.clk_pos} (angle: ${(angle/Math.PI).toFixed(3)}*pi)`);
                        console.log(`  offsetDir: [${offsetDir.x.toFixed(3)}, ${offsetDir.y.toFixed(3)}, ${offsetDir.z.toFixed(3)}]`);
                        console.log(`  fNode (${md.f_node}) calculated: [${fNodePos.x.toFixed(3)}, ${fNodePos.y.toFixed(3)}, ${fNodePos.z.toFixed(3)}]`);
                        
                        registerNodeAlias(md.f_node, fNodePos, md.description);
                    }
                }
            }
        });

        const nodesToPrint = ["2", "3", "17", "19", "11", "13"];
        console.log("\nNode Coordinates after calculations:");
        nodesToPrint.forEach(n => {
            const vec = lookupNode(n);
            if (vec) {
                console.log(`Node ${n}: [${vec.x.toFixed(3)}, ${vec.y.toFixed(3)}, ${vec.z.toFixed(3)}]`);
            } else {
                console.log(`Node ${n} not found!`);
            }
        });

    } catch (err) {
        console.error(err);
    }
}

run();
