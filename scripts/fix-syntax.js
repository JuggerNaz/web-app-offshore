const fs = require('fs');
let code = fs.readFileSync('app/dashboard/inspection-v2/workspace/page.tsx', 'utf8');

const targetStr = `            allEv.sort((a, b) => timeToSecs(b.time) - timeToSecs(a.time));
            setVideoEvents(allEv);
            const { data: h } = await supabase.from('insp_records').select('*').eq('component_id', selectedComp.id).order('cr_date', { ascending: false });`;

const replaceStr = `            allEv.sort((a, b) => timeToSecs(b.time) - timeToSecs(a.time));
            setVideoEvents(allEv);
        }
        syncDeploymentState();
    }, [activeDep, supabase, inspMethod]);

    useEffect(() => {
        async function fetchHistory() {
            if (!selectedComp || !structureId) return;
            const { data: h } = await supabase.from('insp_records').select('*').eq('component_id', selectedComp.id).order('cr_date', { ascending: false });`;

if (code.includes(targetStr)) {
    code = code.replace(targetStr, replaceStr);
    console.log("Replaced target block.");
}

// Ensure brackets match
let open = (code.match(/\{/g) || []).length;
let close = (code.match(/\}/g) || []).length;
console.log(`Braces: { = ${open}, } = ${close}`);
while (close > open && code.trim().endsWith('}')) {
    let lastIndex = code.lastIndexOf('}');
    code = code.substring(0, lastIndex) + code.substring(lastIndex + 1);
    close--;
    console.log('Removed an extra closing brace at EOF');
}

fs.writeFileSync('app/dashboard/inspection-v2/workspace/page.tsx', code);
