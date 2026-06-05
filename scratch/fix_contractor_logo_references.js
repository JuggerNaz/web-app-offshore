const fs = require('fs');
const path = require('path');

const file1 = path.join(__dirname, '../app/dashboard/inspection-v2/workspace/hooks/useWorkspaceReports.ts');
const file2 = path.join(__dirname, '../app/dashboard/inspection-v2/workspace/components/WorkspaceDialogs.tsx');

function fixFile(filePath) {
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return;
    }
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace the supabase query
    const queryTarget = "from('u_lib_contr_nam').select('lib_path').eq('lib_desc', jobPack?.metadata?.contrac)";
    const queryRepl = "from('u_lib_list').select('logo_url').eq('lib_code', 'CONTR_NAM').eq('lib_id', jobPack?.metadata?.contrac)";
    
    // Replace contrData?.lib_path
    const pathTarget = "contrData?.lib_path";
    const pathRepl = "contrData?.logo_url";
    
    let updated = content;
    if (updated.includes(queryTarget)) {
        updated = updated.split(queryTarget).join(queryRepl);
    }
    if (updated.includes(pathTarget)) {
        updated = updated.split(pathTarget).join(pathRepl);
    }
    
    // Also clean up any double assignments like "contractorLogoUrl = contractorLogoUrl ="
    const doubleAssignTarget = "contractorLogoUrl = contractorLogoUrl = contrData?.logo_url";
    const doubleAssignRepl = "contractorLogoUrl = contrData?.logo_url";
    if (updated.includes(doubleAssignTarget)) {
        updated = updated.split(doubleAssignTarget).join(doubleAssignRepl);
    }
    
    if (updated !== content) {
        fs.writeFileSync(filePath, updated, 'utf8');
        console.log(`Successfully updated ${filePath}`);
    } else {
        console.log(`No changes made to ${filePath}`);
    }
}

fixFile(file1);
fixFile(file2);
