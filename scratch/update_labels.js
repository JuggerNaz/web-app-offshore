const fs = require('fs');
let content = fs.readFileSync('components/dialogs/component-spec-dialog.tsx', 'utf-8');

const target = "if (key === 'fj_typ') label = 'Field Joint Wrappings';";
const replacement = `if (key === 'fj_typ') label = 'Field Joint Wrappings';
                        if (key === 'manufacture') label = 'Manufacture';
                        if (key === 'model_type') label = 'Model Type';
                        if (key === 'repair_comp_t') label = 'Repair Comp. T';
                        if (key === 'po_no') label = 'PO No.';
                        if (key === 'installed_date') label = 'Installed Date';`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('components/dialogs/component-spec-dialog.tsx', content);
    console.log('Successfully updated labels');
} else {
    console.error('Target not found');
}
