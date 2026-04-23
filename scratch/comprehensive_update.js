const fs = require('fs');
let content = fs.readFileSync('components/dialogs/component-spec-dialog.tsx', 'utf-8');

// 1. Add rc to isSpecialComp (two locations)
// We use a regex that matches the list up to 'pw' and adds 'rc'
content = content.replace(
    /const isSpecialComp = \['pp', 'fd', 'an', 'cs', 'cl', 'cd', 'fa', 'hd', 'hm', 'vd', 'vm', 'hs', 'pl', 'pg', 'bb', 'sg', 'cu', 'cf', 'it', 'lg', 'wn', 'wp', 'rs', 'rg', 'rb', 'ct', 'gp', 'gs', 'bl', 'fv', 'ce', 'sd', 'yp', 'pv', 'pc', 'ss', 'pw'\]\.includes\(code \|\| ''\);/g,
    "const isSpecialComp = ['pp', 'fd', 'an', 'cs', 'cl', 'cd', 'fa', 'hd', 'hm', 'vd', 'vm', 'hs', 'pl', 'pg', 'bb', 'sg', 'cu', 'cf', 'it', 'lg', 'wn', 'wp', 'rs', 'rg', 'rb', 'ct', 'gp', 'gs', 'bl', 'fv', 'ce', 'sd', 'yp', 'pv', 'pc', 'ss', 'pw', 'rc'].includes(code || '');"
);

// 2. Add rc template patch to getTemplate
if (!content.includes("lowerCode === 'rc'")) {
    const patch = `    if (lowerCode === 'rc' && !('manufacture' in patchedTemplate)) {
      patchedTemplate.manufacture = "";
      patchedTemplate.model_type = "";
      patchedTemplate.material = "";
      patchedTemplate.pipe_cls = "";
      patchedTemplate.serial_no = "";
      patchedTemplate.repair_comp_t = "";
      patchedTemplate.po_no = "";
      patchedTemplate.installed_date = "";
      patchedTemplate.desg_press = "";
      patchedTemplate.op_press = "";
      patchedTemplate.no_bolts = "";
      patchedTemplate.diameter = "";
    }`;
    content = content.replace("if (lowerCode === 'ss' && !('supo_typ' in patchedTemplate)) {", patch + "\n    if (lowerCode === 'ss' && !('supo_typ' in patchedTemplate)) {");
}

// 3. Update field deletion logic
// Locations: inside useEffect for view/edit mode and create mode
// We need to handle 'pw' and 'rc'
const ssMatch = "} else if (code === 'ss') {";

// Deletion for rc
if (!content.includes("code === 'rc'")) {
    const rcDeletion = `} else if (code === 'rc') {
              delete info.wall_thk;
              delete info.depth;
            } else if (code === 'ss') {`;
    content = content.replace(/\} else if \(code === 'ss'\) \{/g, rcDeletion);
}

// Deletion for pw (stop deleting wall_thk and diameter)
content = content.replace(
    /\} else if \(code === 'pw'\) \{\s*delete info\.wall_thk;\s*delete info\.depth;\s*delete info\.diameter;\s*\}/g,
    "} else if (code === 'pw') {\n              delete info.depth;\n            }"
);

// 4. Add label mappings
const labels = `if (key === 'fj_typ' && lowerCode === 'pw') label = 'Field Joint Wrappings';
                        if (key === 'manufacture') label = 'Manufacture';
                        if (key === 'model_type') label = 'Model Type';
                        if (key === 'repair_comp_t') label = 'Repair Comp. T';
                        if (key === 'po_no') label = 'PO No.';
                        if (key === 'installed_date') label = 'Installed Date';
                        if (key === 'condition') label = 'Condition';`;

content = content.replace("if (key === 'fj_typ' && lowerCode === 'pw') label = 'Field Joint Wrappings';", labels);

// 5. Add renderSelect for rc
if (!content.includes("lowerCode === 'rc'")) {
    const renderSelect = `if (key === 'fj_typ' && lowerCode === 'pw') return renderSelect(key, "Select field joint wrapping", fjTypData);
                        if (key === 'pipe_cls' && lowerCode === 'rc') return renderSelect(key, "Select pipe class", pipeClsData);
                        if (key === 'material' && lowerCode === 'rc') return renderSelect(key, "Select material", pipeMatData);`;
    content = content.replace("if (key === 'fj_typ' && lowerCode === 'pw') return renderSelect(key, \"Select field joint wrapping\", fjTypData);", renderSelect);
}

// 6. Add condition to col-span-2 check
content = content.replace(
    /key === 'has_gas_seepage' && "col-span-2"/g,
    "(key === 'has_gas_seepage' || key === 'condition') && \"col-span-2\""
);

fs.writeFileSync('components/dialogs/component-spec-dialog.tsx', content);
console.log('Successfully updated component-spec-dialog.tsx comprehensively');
