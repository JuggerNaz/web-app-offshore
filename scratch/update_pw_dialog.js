const fs = require('fs');
let content = fs.readFileSync('components/dialogs/component-spec-dialog.tsx', 'utf-8');

// 1. Remove wall_thk and diameter deletion for pw
// There are two locations for this logic (edit/view mode and create mode)
const pwDeleteRegex = /\} else if \(code === 'pw'\) \{\s*delete info\.wall_thk;\s*delete info\.depth;\s*delete info\.diameter;\s*\}/g;
content = content.replace(pwDeleteRegex, "} else if (code === 'pw') {\n              delete info.depth;\n            }");

// 2. Add condition label mapping
if (content.includes("if (key === 'installed_date') label = 'Installed Date';")) {
    content = content.replace(
        "if (key === 'installed_date') label = 'Installed Date';",
        "if (key === 'installed_date') label = 'Installed Date';\n                        if (key === 'condition') label = 'Condition';"
    );
}

// 3. Add condition to col-span-2 check
content = content.replace(
    /key === 'has_gas_seepage' && "col-span-2"/g,
    "(key === 'has_gas_seepage' || key === 'condition') && \"col-span-2\""
);

fs.writeFileSync('components/dialogs/component-spec-dialog.tsx', content);
console.log('Successfully updated component-spec-dialog.tsx safely');
