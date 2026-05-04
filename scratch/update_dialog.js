const fs = require('fs');
let content = fs.readFileSync('components/dialogs/component-spec-dialog.tsx', 'utf-8');

// Replace isSpecialComp arrays
content = content.replace(
    /const isSpecialComp = \['pp', 'fd', 'an', 'cs', 'cl', 'cd', 'fa', 'hd', 'hm', 'vd', 'vm', 'hs', 'pl', 'pg', 'bb', 'sg', 'cu', 'cf', 'it', 'lg', 'wn', 'wp', 'rs', 'rg', 'rb', 'ct', 'gp', 'gs', 'bl', 'fv', 'ce', 'sd', 'yp', 'pv', 'pc', 'ss', 'pw'\]\.includes\(code \|\| ''\);/g,
    "const isSpecialComp = ['pp', 'fd', 'an', 'cs', 'cl', 'cd', 'fa', 'hd', 'hm', 'vd', 'vm', 'hs', 'pl', 'pg', 'bb', 'sg', 'cu', 'cf', 'it', 'lg', 'wn', 'wp', 'rs', 'rg', 'rb', 'ct', 'gp', 'gs', 'bl', 'fv', 'ce', 'sd', 'yp', 'pv', 'pc', 'ss', 'pw', 'rc'].includes(code || '');"
);

// Add field deletion for rc
content = content.replace(
    /\} else if \(code === 'ss'\) \{/g,
    "} else if (code === 'rc') {\n              delete info.wall_thk;\n              delete info.depth;\n            } else if (code === 'ss') {"
);

// Add label mappings
content = content.replace(
    /if \(key === 'fj_typ' && lowerCode === 'pw'\) label = 'Field Joint Wrappings';/g,
    "if (key === 'fj_typ' && lowerCode === 'pw') label = 'Field Joint Wrappings';\n                        if (key === 'manufacture') label = 'Manufacture';\n                        if (key === 'model_type') label = 'Model Type';\n                        if (key === 'repair_comp_t') label = 'Repair Comp. T';\n                        if (key === 'po_no') label = 'PO No.';\n                        if (key === 'installed_date') label = 'Installed Date';"
);

fs.writeFileSync('components/dialogs/component-spec-dialog.tsx', content);
console.log('Successfully updated components/dialogs/component-spec-dialog.tsx');
