const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.env.local', 'utf-8');
const supabaseUrlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const supabaseKeyMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = supabaseUrlMatch ? supabaseUrlMatch[1].trim() : '';
const supabaseKey = supabaseKeyMatch ? supabaseKeyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkInsert() {
    let log = "";
    const tapeNo = "TEST_TAPE_" + Date.now();
    log += "Inserting first tape: " + tapeNo + "\n";
    const { data: d1, error: e1 } = await supabase.from('insp_video_tapes').insert({
        tape_no: tapeNo,
        chapter_no: 1,
        tape_type: 'DIGITAL - PRIMARY',
        status: 'ACTIVE'
    }).select();
    if (e1) log += "Error 1: " + JSON.stringify(e1) + "\n";
    else log += "Success 1: " + d1[0].tape_no + "\n";

    log += "Inserting second tape with same name: " + tapeNo + "\n";
    const { data: d2, error: e2 } = await supabase.from('insp_video_tapes').insert({
        tape_no: tapeNo,
        chapter_no: 2,
        tape_type: 'DIGITAL - PRIMARY',
        status: 'ACTIVE'
    }).select();
    if (e2) log += "Error 2: " + JSON.stringify(e2) + "\n";
    else log += "Success 2: " + d2[0].tape_no + "\n";

    fs.writeFileSync('result_js.txt', log, 'utf8');
}

checkInsert();
