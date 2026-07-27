const SUPABASE_URL = 'https://zpsmxtdqlpbdwfzctqzd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc214dGRxbHBiZHdmemN0cXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY4NDIzODIsImV4cCI6MjA0MjQxODM4Mn0.t3uO7vnabDlwaz5iM6i8A-ya9cc6X20ZTn0bcR3zzs4';

const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
};

const { generatePlatform3DCoordinates, determineGeometryType } = require('../utils/platform-3d-math');

async function run() {
    const structureId = 301; // BAP-AA
    console.log(`\n======================================================`);
    console.log(`TESTING PROCEDURAL 3D MATH GENERATOR FOR BAP-AA (plat_id: ${structureId})`);
    console.log(`======================================================`);

    const platRes = await fetch(`${SUPABASE_URL}/rest/v1/platform?plat_id=eq.${structureId}`, { headers });
    const platforms = await platRes.json();
    const platformDetails = platforms[0];

    const elvRes = await fetch(`${SUPABASE_URL}/rest/v1/str_elv?plat_id=eq.${structureId}`, { headers });
    const elevations = await elvRes.json();

    const faceRes = await fetch(`${SUPABASE_URL}/rest/v1/str_faces?plat_id=eq.${structureId}`, { headers });
    const faces = await faceRes.json();

    const compRes = await fetch(`${SUPABASE_URL}/rest/v1/structure_components?structure_id=eq.${structureId}&is_deleted=eq.false&limit=1000`, { headers });
    const components = await compRes.json();

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
    const legNames = Array.from(allLegNamesSet);
    console.log('Leg Names:', legNames);
    console.log('Determined Geometry Type:', determineGeometryType(platformDetails, legNames));

    const result = generatePlatform3DCoordinates(platformDetails, elevations, faces, components);

    console.log('\n--- PROCEDURAL MATH GENERATED LAYOUTS ---');
    console.log('Foundation Members count:', result.foundationMembers.length);
    console.log('Foundation Members sample (first 10):');
    result.foundationMembers.slice(0, 10).forEach(m => {
        console.log(`id: ${m.id}, label: ${m.label}, start: [${m.start}], end: [${m.end}]`);
    });

    console.log('\nComponent Layouts count:', result.componentLayouts.length);
    console.log('Sample componentLayouts (first 10):');
    result.componentLayouts.slice(0, 10).forEach(l => {
        const c = l.component;
        const s = Array.isArray(l.start) ? l.start : [l.start?.x, l.start?.y, l.start?.z];
        const e = Array.isArray(l.end) ? l.end : [l.end?.x, l.end?.y, l.end?.z];
        console.log(`q_id: ${c.q_id}, code: ${c.code}, start: [${s}], end: [${e}]`);
    });
}

run();
