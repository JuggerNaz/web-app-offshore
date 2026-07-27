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

async function run() {
    try {
        const platforms = await fetchJson(`${SUPABASE_URL}/rest/v1/platform?title=ilike.*BKP-A*&select=*`);
        const platformDetails = platforms[0];
        const platId = platformDetails.plat_id;

        const faces = (await fetchJson(`${SUPABASE_URL}/rest/v1/str_faces?plat_id=eq.${platId}`)).filter(Boolean);
        const elevations = (await fetchJson(`${SUPABASE_URL}/rest/v1/str_elv?plat_id=eq.${platId}`)).filter(Boolean);
        const components = await fetchJson(`${SUPABASE_URL}/rest/v1/structure_components?structure_id=eq.${platId}&is_deleted=eq.false&limit=2000`);

        // Spacing calculations
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
            const vec = new THREE.Vector3(x, y, z);
            registerNodeAlias(normalizedNodeName, vec, legKey);
        };

        // PASS 1.2
        components.forEach((c) => {
            const md = c.metadata || {};
            const code = (c.code || "").toUpperCase();
            const isPrimary = ["HM", "HOM", "HD", "HDM", "VM", "VD", "VDM", "LG", "LEG"].includes(code);
            if (isPrimary) {
                processNode(md.s_node, md.s_leg, md.elv_1, md.depth, md.easting, md.northing, true);
                processNode(md.f_node, md.f_leg, md.elv_2, md.depth, md.easting, md.northing, true);
            }
        });

        // Debug child welds search
        const md = { s_node: "4A", s_leg: "B2", f_node: "4B", f_leg: "B1", clk_pos: "3 O' CLOCK", dist: "-.7" };
        
        let parentComp = null;
        const parentWeld = components.find(
            (w) =>
                (w.code || "").toUpperCase() === "WN" &&
                (w.metadata?.s_node || "").toUpperCase() === (md.s_node || "").toUpperCase() &&
                w.metadata?.associated_comp_id
        );
        console.log("parentWeld found:", parentWeld ? parentWeld.q_id : "NO");
        if (parentWeld) {
            parentComp = components.find((pc) => pc.id === parentWeld.metadata.associated_comp_id);
            console.log("parentComp found:", parentComp ? parentComp.q_id : "NO");
        }

        if (parentComp) {
            const pStart = lookupNode(parentComp.metadata.s_node, parentComp.metadata.s_leg);
            const pEnd = lookupNode(parentComp.metadata.f_node, parentComp.metadata.f_leg);
            console.log("pStart:", pStart);
            console.log("pEnd:", pEnd);
            
            const dir = new THREE.Vector3(0, 0, -1);
            if (pStart && pEnd && pStart.distanceTo(pEnd) > 0.01) {
                dir.copy(pEnd).sub(pStart).normalize();
            }
            console.log("dir:", dir);
            
            const up = new THREE.Vector3(0, 1, 0);
            up.sub(dir.clone().multiplyScalar(up.dot(dir))).normalize();
            const right = new THREE.Vector3().crossVectors(dir, up).normalize();
            console.log("right:", right);
            
            const clockPos = parseFloat(md.clk_pos);
            const angle = (clockPos / 12) * Math.PI * 2;
            const offsetDir = right.clone().multiplyScalar(Math.sin(angle)).add(up.clone().multiplyScalar(Math.cos(angle))).normalize();
            console.log("offsetDir:", offsetDir);
        }

    } catch (err) {
        console.error(err);
    }
}

run();
