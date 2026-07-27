const THREE = require('three');

function simulate() {
    // Initial leg coordinates as defined by the grid layout with SPACING = 15
    const SPACING = 15;
    const centerRow = 0.5;
    const centerCol = 0.5;

    // rowLetters = ['A', 'B'], colNumbers = ['1', '2']
    // A1: row 0, col 0
    // A2: row 0, col 1
    // B1: row 1, col 0
    // B2: row 1, col 1
    const legCoords = {
        'A1': { x: (0 - centerCol) * SPACING, z: -(0 - centerRow) * SPACING }, // -7.5, 7.5
        'A2': { x: (1 - centerCol) * SPACING, z: -(0 - centerRow) * SPACING }, //  7.5, 7.5
        'B1': { x: (0 - centerCol) * SPACING, z: -(1 - centerRow) * SPACING }, // -7.5, -7.5
        'B2': { x: (1 - centerCol) * SPACING, z: -(1 - centerRow) * SPACING }, //  7.5, -7.5
    };

    console.log("Initial leg/node coordinates:");
    Object.keys(legCoords).forEach(leg => {
        console.log(`Leg ${leg}: x = ${legCoords[leg].x}, z = ${legCoords[leg].z}`);
    });

    // Node map (each node holds a reference to a Vector3)
    const nodeMap = new Map();
    nodeMap.set("29", new THREE.Vector3(legCoords['A2'].x, -55, legCoords['A2'].z)); // A2
    nodeMap.set("30", new THREE.Vector3(legCoords['A1'].x, -55, legCoords['A1'].z)); // A1
    nodeMap.set("31", new THREE.Vector3(legCoords['B1'].x, -55, legCoords['B1'].z)); // B1
    nodeMap.set("32", new THREE.Vector3(legCoords['B2'].x, -55, legCoords['B2'].z)); // B2

    console.log("\nBefore PASS 1.5 adjustments:");
    for (const [nodeId, vec] of nodeMap.entries()) {
        console.log(`Node N${nodeId}: (${vec.x.toFixed(3)}, ${vec.y.toFixed(3)}, ${vec.z.toFixed(3)})`);
    }

    // Members as defined in BKP-A metadata:
    // HOM N32-N31: f_node: "31", s_node: "32", s_leg: "B2", f_leg: "B1", length: 20.003
    // HOM N31-N30: f_node: "30", s_node: "31", s_leg: "B1", f_leg: "A1", length: 20.003 (Wait, let's verify from JSON)
    // Wait, in check_all_fields.js, we had:
    // - HOM N32-N31: f_node: "31", s_node: "32", f_leg: "B1", s_leg: "B2"
    // - HOM N29-N32: f_node: "32", s_node: "29", f_leg: "B2", s_leg: "A2"
    // - HOM N31-N30: f_node: "30", s_node: "31", f_leg: "A1", s_leg: "B1"
    // - HOM N30-N29: f_node: "29", s_node: "30", f_leg: "A2", s_leg: "A1"
    const members = [
        { q_id: 'HOM N32-N31', s_node: '32', f_node: '31', s_leg: 'B2', f_leg: 'B1', length: 20.003 },
        { q_id: 'HOM N29-N32', s_node: '29', f_node: '32', s_leg: 'A2', f_leg: 'B2', length: 20.003 },
        { q_id: 'HOM N31-N30', s_node: '31', f_node: '30', s_leg: 'B1', f_leg: 'A1', length: 20.003 },
        { q_id: 'HOM N30-N29', s_node: '30', f_node: '29', s_leg: 'A1', f_leg: 'A2', length: 20.003 }
    ];

    // Simulate PASS 1.5 logic:
    // "fPos.copy(newFPos)"
    members.forEach(member => {
        const sPos = nodeMap.get(member.s_node);
        const fPos = nodeMap.get(member.f_node);
        if (sPos && fPos) {
            const originalDist = sPos.distanceTo(fPos);
            if (originalDist > 0.001) {
                const dir = fPos.clone().sub(sPos).normalize();
                const newFPos = sPos.clone().add(dir.multiplyScalar(member.length));
                
                console.log(`\nAdjusting ${member.q_id}:`);
                console.log(`  s_node (N${member.s_node}): (${sPos.x.toFixed(3)}, ${sPos.y.toFixed(3)}, ${sPos.z.toFixed(3)})`);
                console.log(`  f_node (N${member.f_node}) original: (${fPos.x.toFixed(3)}, ${fPos.y.toFixed(3)}, ${fPos.z.toFixed(3)}), original distance: ${originalDist.toFixed(3)}`);
                
                fPos.copy(newFPos);
                
                console.log(`  f_node (N${member.f_node}) adjusted: (${fPos.x.toFixed(3)}, ${fPos.y.toFixed(3)}, ${fPos.z.toFixed(3)}), new distance: ${sPos.distanceTo(fPos).toFixed(3)}`);
            }
        }
    });

    console.log("\nAfter PASS 1.5 adjustments:");
    for (const [nodeId, vec] of nodeMap.entries()) {
        console.log(`Node N${nodeId}: (${vec.x.toFixed(3)}, ${vec.y.toFixed(3)}, ${vec.z.toFixed(3)})`);
    }
}

simulate();
