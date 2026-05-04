const fs = require('fs');
let content = fs.readFileSync('components/dialogs/component-spec-dialog.tsx', 'utf-8');

// Labels
const labels = `if (key === 'fj_typ') label = 'Field Joint Wrappings';
                        if (key === 'manufacture') label = 'Manufacture';
                        if (key === 'model_type') label = 'Model Type';
                        if (key === 'repair_comp_t') label = 'Repair Comp. T';
                        if (key === 'po_no') label = 'PO No.';
                        if (key === 'installed_date') label = 'Installed Date';
                        if (key === 'condition') label = 'Condition';`;

if (content.includes("if (key === 'fj_typ') label = 'Field Joint Wrappings';")) {
    content = content.replace("if (key === 'fj_typ') label = 'Field Joint Wrappings';", labels);
}

// renderSelect for rc
if (!content.includes("lowerCode === 'rc'")) {
    const renderSelect = `if (key === 'fj_typ' && lowerCode === 'pw') return renderSelect(key, "Select field joint wrapping", fjTypData);
                        if (key === 'pipe_cls' && lowerCode === 'rc') return renderSelect(key, "Select pipe class", pipeClsData);
                        if (key === 'material' && lowerCode === 'rc') return renderSelect(key, "Select material", pipeMatData);`;
    content = content.replace("if (key === 'fj_typ' && lowerCode === 'pw') return renderSelect(key, \"Select field joint wrapping\", fjTypData);", renderSelect);
}

fs.writeFileSync('components/dialogs/component-spec-dialog.tsx', content);
console.log('Successfully updated component-spec-dialog.tsx labels and dropdowns');
